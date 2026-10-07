import {
  CHAT_EVENT_SOURCE,
  isAvatarUrl,
  isEmojiImageUrl,
  type ChatCommand,
  type ChatEvent,
  type ChatMessage,
  type ChatMode,
  type ChatParticipant,
  type EmojiCategory,
  type EmojiItem,
  type InputState,
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
  /** Whether YouTube's chat box accepts messages (and why not). */
  input: { available: false, reason: '', maxLength: 200 } as InputState,
  /** YouTube's emoji set, loaded the first time the emoji popover opens. */
  emojiCategories: [] as EmojiCategory[],
  /** Viewers in YouTube's participant list, for mention suggestions. */
  participants: [] as ChatParticipant[],
});

const ids = new Set<string>();
/** The chat iframe's window, learned from the messages it sends. */
let chatFrame: MessageEventSource | null = null;
const pendingSends = new Map<string, (ok: boolean) => void>();

export function resetChat(active: boolean, frame: MessageEventSource | null = null) {
  chat.active = active;
  chat.messages = [];
  chat.mode = null;
  chat.input = { available: false, reason: '', maxLength: 200 };
  chat.emojiCategories = [];
  chat.participants = [];
  chat.revision++;
  ids.clear();
  chatFrame = frame;
}

function command(message: ChatCommand) {
  (chatFrame as Window | null)?.postMessage(message, location.origin);
}

export function setChatMode(mode: ChatMode) {
  command({ source: CHAT_EVENT_SOURCE, type: 'set-mode', mode });
}

export function requestEmojis() {
  command({ source: CHAT_EVENT_SOURCE, type: 'get-emojis' });
}

/** Sends a message through YouTube's own chat box; resolves false if YouTube didn't take it. */
export function sendChatMessage(text: string): Promise<boolean> {
  if (!chatFrame) return Promise.resolve(false);
  const requestId = crypto.randomUUID();
  return new Promise((resolve) => {
    const timer = setTimeout(() => finish(false), 8000);
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      pendingSends.delete(requestId);
      resolve(ok);
    };
    pendingSends.set(requestId, finish);
    command({ source: CHAT_EVENT_SOURCE, type: 'send', requestId, text });
  });
}

export function handleChatEvent(event: ChatEvent, frame: MessageEventSource | null) {
  if (event.type === 'reset' || !chat.active) resetChat(true, frame);
  if (event.type === 'update') updateChat(event.added, event.removed);
  else if (event.type === 'mode') chat.mode = event.mode;
  else if (event.type === 'input-state') chat.input = sanitizeInputState(event.state);
  else if (event.type === 'send-result') pendingSends.get(event.requestId)?.(event.ok);
  else if (event.type === 'emojis') {
    chat.emojiCategories = sanitizeCategories(event.categories);
    releaseFocusFromChatFrame();
  } else if (event.type === 'participants') chat.participants = sanitizeParticipants(event.participants);
}

// Loading emojis opens YouTube's picker in the hidden chat frame, which can pull focus into it;
// keyboard focus there would break YouTube's player shortcuts, so hand it back to the page.
function releaseFocusFromChatFrame() {
  const active = document.activeElement;
  if (active instanceof HTMLIFrameElement && active.contentWindow === chatFrame) active.blur();
}

function sanitizeInputState(state: InputState): InputState {
  return {
    available: state.available === true,
    reason: typeof state.reason === 'string' ? state.reason.slice(0, 200) : '',
    maxLength: typeof state.maxLength === 'number' ? Math.min(Math.max(state.maxLength, 1), 500) : 200,
  };
}

const str = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '');

function sanitizeEmojis(emojis: unknown): EmojiItem[] {
  if (!Array.isArray(emojis)) return [];
  return emojis
    .filter((e) => typeof e?.text === 'string' && e.text.length > 0 && e.text.length <= 100)
    .map((e) => ({
      text: e.text,
      image: typeof e.image === 'string' && isEmojiImageUrl(e.image) ? e.image : '',
      label: str(e.label, 100),
      search: str(e.search, 300),
    }));
}

function sanitizeParticipants(participants: ChatParticipant[]): ChatParticipant[] {
  return participants
    .filter((p) => typeof p?.name === 'string' && p.name.trim().length > 0)
    .slice(0, 2000)
    .map((p) => ({
      name: p.name.trim().slice(0, 100),
      avatar: typeof p.avatar === 'string' && isAvatarUrl(p.avatar) ? p.avatar : '',
    }));
}

function sanitizeCategories(categories: EmojiCategory[]): EmojiCategory[] {
  return categories
    .filter((c) => typeof c === 'object' && c !== null)
    .map((c) => ({
      title: str(c.title, 100),
      locked: c.locked === true,
      lockedHint: str(c.lockedHint, 300),
      emojis: sanitizeEmojis(c.emojis),
    }))
    .filter((c) => c.emojis.length > 0);
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
