import {
  CHAT_EVENT_SOURCE,
  isAvatarUrl,
  isChatCommand,
  type ChatEvent,
  type ChatMessage,
  type EmojiCategory,
  type ChatMode,
  type ChatRun,
} from '@/utils/chat';
import { loadSettings, settings } from '@/utils/settings.svelte';
import { isParticipantNode, readEmojis, readInputState, readParticipants, sendText } from './chatbox';

const MESSAGE_TAG = 'YT-LIVE-CHAT-TEXT-MESSAGE-RENDERER';
// Items of the chat mode dropdown. In every language the first is "Top chat" and
// the second is "Live chat" (all messages); the replay variants follow the same order.
const MODE_ITEMS = '#live-chat-view-selector-sub-menu tp-yt-paper-listbox a';

// Runs inside YouTube's live chat iframe (live and replay) and mirrors its message
// list to the watch page, where the overlay renders it. Removals are mirrored too:
// seeking in a replay makes YouTube swap the whole list for the new position.
export default defineContentScript({
  matches: ['*://*.youtube.com/live_chat*'],
  allFrames: true,

  async main(ctx) {
    // Popped-out chat has no player to overlay.
    if (window.top === window) return;

    ctx.onInvalidated(await loadSettings());

    let forceChecked = false;
    let reportedMode: ChatMode | null = null;
    const syncMode = () => {
      const mode = currentMode();
      if (!mode) return;
      // Only once per chat load, so switching back to Top chat by hand still sticks.
      if (!forceChecked && settings.forceAllMessages) {
        forceChecked = true;
        if (mode === 'top') return setMode('all');
      }
      if (mode !== reportedMode) {
        reportedMode = mode;
        post({ source: CHAT_EVENT_SOURCE, type: 'mode', mode });
      }
    };

    // Emojis are read once and kept; reading means briefly opening YouTube's picker.
    let emojis: Promise<EmojiCategory[]> | null = null;
    const loadEmojis = () => {
      emojis ??= readEmojis().then((categories) => {
        if (!categories.length) emojis = null; // Try again on the next request.
        return categories;
      });
      return emojis.then((categories) =>
        post({ source: CHAT_EVENT_SOURCE, type: 'emojis', categories }),
      );
    };

    let reportedInput = '';
    const syncInputState = () => {
      const state = readInputState();
      const key = JSON.stringify(state);
      if (key === reportedInput) return;
      reportedInput = key;
      post({ source: CHAT_EVENT_SOURCE, type: 'input-state', state });
      // Preload so the overlay's emoji popover is complete the moment it opens.
      if (state.available && settings.chatInput && settings.chatInputEmoji) {
        setTimeout(loadEmojis, 1000);
      }
    };

    // Mention suggestions also offer viewers who haven't written yet, from YouTube's participant list.
    let reportedParticipants = '';
    let participantsTimer: ReturnType<typeof setTimeout> | undefined;
    const syncParticipants = () => {
      participantsTimer = undefined;
      if (!settings.chatInput) return;
      const participants = readParticipants();
      const key = JSON.stringify(participants);
      if (key === reportedParticipants) return;
      reportedParticipants = key;
      post({ source: CHAT_EVENT_SOURCE, type: 'participants', participants });
    };
    const scheduleParticipants = () => {
      participantsTimer ??= setTimeout(syncParticipants, 1000);
    };
    // Names inside existing rows can change without rows being added, so also re-check now and then.
    ctx.setInterval(scheduleParticipants, 15000);

    ctx.addEventListener(window, 'message', (event) => {
      if (event.source !== window.parent || event.origin !== location.origin) return;
      const command = event.data;
      if (!isChatCommand(command)) return;
      if (command.type === 'set-mode') {
        setMode(command.mode);
      } else if (command.type === 'send') {
        sendText(command.text).then((ok) =>
          post({ source: CHAT_EVENT_SOURCE, type: 'send-result', requestId: command.requestId, ok }),
        );
      } else if (command.type === 'get-emojis') {
        loadEmojis();
      }
    });

    post({ source: CHAT_EVENT_SOURCE, type: 'reset' });
    sendUpdate([...document.querySelectorAll(MESSAGE_TAG)], []);
    syncMode();
    syncInputState();
    syncParticipants();

    // Watch the whole document rather than the item list: YouTube may rebuild the
    // list, e.g. when switching between Top chat and Live chat.
    const observer = new MutationObserver((records) => {
      const added = new Set<Element>();
      const removed = new Set<Element>();
      let participantsChanged = false;
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element && node.tagName === MESSAGE_TAG) added.add(node);
          else participantsChanged ||= isParticipantNode(node);
        }
        for (const node of record.removedNodes) {
          if (node instanceof Element && node.tagName === MESSAGE_TAG) removed.add(node);
          else participantsChanged ||= isParticipantNode(node);
        }
      }
      if (participantsChanged) scheduleParticipants();
      // A node moved within one batch shows up in both lists; its final state wins.
      sendUpdate(
        [...added].filter((el) => el.isConnected),
        [...removed].filter((el) => !el.isConnected),
      );
      // Switching modes rebuilds the list, so a mode change always lands here too.
      syncMode();
      syncInputState();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    ctx.onInvalidated(() => {
      observer.disconnect();
      clearTimeout(participantsTimer);
    });
  },
});

function modeItems() {
  return document.querySelectorAll<HTMLElement>(MODE_ITEMS);
}

function currentMode(): ChatMode | null {
  const [top, all] = modeItems();
  if (!top || !all) return null;
  return all.classList.contains('iron-selected') ? 'all' : 'top';
}

function setMode(mode: ChatMode) {
  const item = modeItems()[mode === 'all' ? 1 : 0];
  if (item && !item.classList.contains('iron-selected')) item.click();
}

function sendUpdate(addedElements: Element[], removedElements: Element[]) {
  const added = addedElements.map(parseMessage).filter((m) => m !== null);
  const removed = removedElements.map((el) => el.id).filter(Boolean);
  if (added.length || removed.length) {
    post({ source: CHAT_EVENT_SOURCE, type: 'update', added, removed });
  }
}

function parseMessage(el: Element): ChatMessage | null {
  const message = el.querySelector('#message');
  if (!el.id || !message) return null;

  const runs: ChatRun[] = [];
  for (const node of message.childNodes) {
    if (node instanceof HTMLImageElement) {
      if (node.src.startsWith('https://')) runs.push({ emoji: node.src, alt: node.alt });
      else if (node.alt) runs.push({ text: node.alt });
    } else if (node.textContent) {
      runs.push({ text: node.textContent });
    }
  }

  return {
    id: el.id,
    time: el.querySelector('#timestamp')?.textContent?.trim() ?? '',
    author: el.querySelector('#author-name')?.textContent?.trim() ?? '',
    authorType: el.getAttribute('author-type') ?? '',
    avatar: parseAvatar(el),
    runs,
  };
}

function parseAvatar(el: Element): string {
  const src = el.querySelector<HTMLImageElement>('#author-photo img')?.src ?? '';
  return isAvatarUrl(src) ? src : '';
}

function post(event: ChatEvent) {
  window.parent.postMessage(event, location.origin);
}
