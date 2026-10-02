import {
  CHAT_EVENT_SOURCE,
  type ChatCommand,
  type ChatEvent,
  type ChatMessage,
  type ChatMode,
} from '@/utils/chat';
import { settings } from '@/utils/settings.svelte';

const MAX_MESSAGES = 150;
const HIDE_NATIVE_ATTR = 'data-chat-overlay';

export interface ShownMessage extends ChatMessage {
  /** Date.now() when the overlay received it. */
  receivedAt: number;
  /** Arrived in a bulk load (chat opened, replay seek) rather than as a new message. */
  backlog: boolean;
}

// Lives outside the component so messages survive the overlay being re-mounted
// when YouTube swaps the player.
export const chat = $state({
  /** A chat frame is feeding us messages for the current video. */
  active: false,
  messages: [] as ShownMessage[],
  /** Bumped on every update so the list knows to auto-scroll. */
  revision: 0,
  /** Null until the chat frame has reported it. */
  mode: null as ChatMode | null,
});

const ids = new Set<string>();
/** The chat iframe's window, learned from the messages it sends. */
let chatFrame: MessageEventSource | null = null;

export function resetChat(active: boolean, frame: MessageEventSource | null = null) {
  chat.active = active;
  chat.messages = [];
  chat.mode = null;
  chat.revision++;
  ids.clear();
  chatFrame = frame;
}

export function setChatMode(mode: ChatMode) {
  const command: ChatCommand = { source: CHAT_EVENT_SOURCE, type: 'set-mode', mode };
  (chatFrame as Window | null)?.postMessage(command, location.origin);
}

export function handleChatEvent(event: ChatEvent, frame: MessageEventSource | null) {
  if (event.type === 'reset' || !chat.active) resetChat(true, frame);
  if (event.type === 'update') updateChat(event.added, event.removed);
  else if (event.type === 'mode') chat.mode = event.mode;
}

function updateChat(added: ChatMessage[], removed: string[]) {
  let messages = chat.messages;
  // The first batch after a reset, or one that replaces everything (a replay seek), is history.
  const backlog = messages.length === 0 || removed.length >= messages.length;
  if (removed.length) {
    for (const id of removed) ids.delete(id);
    messages = messages.filter((m) => ids.has(m.id));
  }

  const receivedAt = Date.now();
  const fresh = added
    .filter((m) => !ids.has(m.id))
    .map((m): ShownMessage => ({ ...m, receivedAt, backlog }));
  for (const m of fresh) ids.add(m.id);
  messages = messages.concat(fresh);

  if (messages.length > MAX_MESSAGES) {
    for (const m of messages.slice(0, messages.length - MAX_MESSAGES)) ids.delete(m.id);
    messages = messages.slice(-MAX_MESSAGES);
  }

  chat.messages = messages;
  chat.revision++;
}

/** Hides YouTube's chat panel via PAGE_CSS while the overlay replaces it. */
export function syncNativeChatVisibility(overlayEnabled: () => boolean) {
  return $effect.root(() => {
    $effect(() => {
      const hide = chat.active && overlayEnabled() && !settings.showNativeChat;
      document.documentElement.toggleAttribute(HIDE_NATIVE_ATTR, hide);
    });
  });
}

/**
 * Page-level CSS (outside the shadow root). The chat iframe is moved off-screen
 * rather than removed, so it keeps loading messages for us.
 */
export const PAGE_CSS = `
html[${HIDE_NATIVE_ATTR}] ytd-live-chat-frame#chat {
  position: fixed !important;
  top: 0 !important;
  left: -10000px !important;
  width: 400px !important;
  height: 600px !important;
}
/* In theater mode this empty column reserves the chat's width next to the player. */
html[${HIDE_NATIVE_ATTR}] ytd-watch-flexy[fixed-panels] #panels-full-bleed-container {
  display: none !important;
}
/* In fullscreen YouTube moves the chat into this column beside the player. Collapse it
   unless another panel (description, transcript, playlist) is open there. */
html[${HIDE_NATIVE_ATTR}] ytd-watch-flexy[fullscreen] #panels-full-bleed-container:not(:has(
  ytd-engagement-panel-section-list-renderer[visibility='ENGAGEMENT_PANEL_VISIBILITY_EXPANDED'],
  #playlist:not([hidden])
)) {
  flex: 0 0 0 !important;
  width: 0 !important;
  min-width: 0 !important;
}
`;
