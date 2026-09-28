import {
  CHAT_EVENT_SOURCE,
  isChatCommand,
  type ChatEvent,
  type ChatMessage,
  type ChatMode,
  type ChatRun,
} from '@/utils/chat';
import { loadSettings, settings } from '@/utils/settings.svelte';

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

    ctx.addEventListener(window, 'message', (event) => {
      if (event.source !== window.parent || event.origin !== location.origin) return;
      if (isChatCommand(event.data)) setMode(event.data.mode);
    });

    post({ source: CHAT_EVENT_SOURCE, type: 'reset' });
    sendUpdate([...document.querySelectorAll(MESSAGE_TAG)], []);
    syncMode();

    // Watch the whole document rather than the item list: YouTube may rebuild the
    // list, e.g. when switching between Top chat and Live chat.
    const observer = new MutationObserver((records) => {
      const added = new Set<Element>();
      const removed = new Set<Element>();
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element && node.tagName === MESSAGE_TAG) added.add(node);
        }
        for (const node of record.removedNodes) {
          if (node instanceof Element && node.tagName === MESSAGE_TAG) removed.add(node);
        }
      }
      // A node moved within one batch shows up in both lists; its final state wins.
      sendUpdate(
        [...added].filter((el) => el.isConnected),
        [...removed].filter((el) => !el.isConnected),
      );
      // Switching modes rebuilds the list, so a mode change always lands here too.
      syncMode();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    ctx.onInvalidated(() => observer.disconnect());
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
    runs,
  };
}

function post(event: ChatEvent) {
  window.parent.postMessage(event, location.origin);
}
