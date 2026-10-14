import { mount, unmount } from 'svelte';
import { isChatEvent } from '@/utils/chat';
import { loadSettings } from '@/utils/settings.svelte';
import { isVisibilityRequest } from '@/utils/visibility';
import Overlay, { noteUserScroll } from './Overlay.svelte';
import PlayerButton from './PlayerButton.svelte';
import { handleChatEvent, PAGE_CSS, resetChat, syncNativeChatVisibility } from './chat.svelte';
import {
  overlayEnabled,
  setVideoOverride,
  toggleVideo,
  visibilityState,
  watchPage,
} from './visibility.svelte';
import './style.css';

// YouTube's player root. It is the element that goes fullscreen, so anything
// mounted inside it stays visible in fullscreen mode.
const PLAYER_SELECTOR = '#movie_player';

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    const pageStyle = document.createElement('style');
    pageStyle.textContent = PAGE_CSS;
    document.head.append(pageStyle);
    ctx.onInvalidated(() => pageStyle.remove());
    ctx.onInvalidated(syncNativeChatVisibility(overlayEnabled));
    ctx.onInvalidated(watchPage());

    ctx.addEventListener(window, 'message', (event) => {
      if (event.origin !== location.origin || !isChatEvent(event.data)) return;
      handleChatEvent(event.data, event.source);
    });

    // Leaving the video: drop its messages and give YouTube its chat panel back
    // until the next video's chat frame reports in.
    ctx.addEventListener(document, 'yt-navigate-start', () => resetChat(false));

    // The popup's "This video" card and the keyboard shortcut (via the background script).
    const onMessage = (message: unknown, _sender: unknown, respond: (state: unknown) => void) => {
      if (!isVisibilityRequest(message)) return;
      if (message.type === 'chatglide:set-video') setVideoOverride(message.on);
      else if (message.type === 'chatglide:toggle-video') toggleVideo();
      respond(visibilityState());
    };
    browser.runtime.onMessage.addListener(onMessage);
    ctx.onInvalidated(() => browser.runtime.onMessage.removeListener(onMessage));

    ctx.onInvalidated(await loadSettings());

    const ui = await createShadowRootUi(ctx, {
      name: 'chat-overlay',
      position: 'inline',
      anchor: PLAYER_SELECTOR,
      append: 'last',
      onMount: (container) => mount(Overlay, { target: container }),
      onRemove: (app) => {
        if (app) unmount(app);
      },
    });

    // Keep clicks on the overlay from reaching YouTube's player, which would toggle
    // playback or fullscreen. Stopped at the host so Svelte's delegated handlers inside still run.
    for (const type of ['pointerdown', 'mousedown', 'click', 'dblclick']) {
      ui.shadowHost.addEventListener(type, (event) => event.stopPropagation());
    }

    // In fullscreen YouTube opens its suggested videos on wheel scrolls over the player.
    // Caught on window in the capture phase so none of YouTube's wheel listeners see scrolls
    // over the overlay; the overlay's own lists still scroll, as that's the browser's default action.
    ctx.addEventListener(
      window,
      'wheel',
      (event) => {
        const path = event.composedPath();
        const hostIndex = path.indexOf(ui.shadowHost);
        if (hostIndex < 0 || event.ctrlKey) return;
        event.stopPropagation();
        noteUserScroll();
        // Nothing in the overlay left to scroll: don't let the scroll chain on to the page.
        if (!path.slice(0, hostIndex).some((node) => canScroll(node, event))) event.preventDefault();
      },
      { capture: true, passive: false },
    );

    // YouTube is a single-page app: the player can be created, replaced or
    // removed without a page load. autoMount watches for the anchor and
    // mounts/unmounts the overlay as it comes and goes.
    ui.autoMount();

    const button = createIntegratedUi(ctx, {
      position: 'inline',
      anchor: '.ytp-right-controls',
      append: 'first',
      onMount: (wrapper) => {
        wrapper.style.display = 'contents';
        return mount(PlayerButton, { target: wrapper });
      },
      onRemove: (app) => {
        if (app) unmount(app);
      },
    });
    button.autoMount();
  },
});

/** True if `node` is an element that can still scroll in the wheel's direction. */
function canScroll(node: EventTarget, event: WheelEvent): boolean {
  if (!(node instanceof Element)) return false;
  const { overflowY, overflowX } = getComputedStyle(node);
  if (event.deltaY !== 0 && /auto|scroll/.test(overflowY)) {
    const max = node.scrollHeight - node.clientHeight;
    if (event.deltaY < 0 ? node.scrollTop > 0 : node.scrollTop < max - 1) return true;
  }
  if (event.deltaX !== 0 && /auto|scroll/.test(overflowX)) {
    const max = node.scrollWidth - node.clientWidth;
    if (event.deltaX < 0 ? node.scrollLeft > 0 : node.scrollLeft < max - 1) return true;
  }
  return false;
}
