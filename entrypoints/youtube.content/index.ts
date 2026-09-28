import { mount, unmount } from 'svelte';
import { isChatEvent } from '@/utils/chat';
import { loadSettings } from '@/utils/settings.svelte';
import Overlay from './Overlay.svelte';
import { handleChatEvent, PAGE_CSS, resetChat, syncNativeChatVisibility } from './chat.svelte';
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
    ctx.onInvalidated(syncNativeChatVisibility());

    ctx.addEventListener(window, 'message', (event) => {
      if (event.origin !== location.origin || !isChatEvent(event.data)) return;
      handleChatEvent(event.data, event.source);
    });

    // Leaving the video: drop its messages and give YouTube its chat panel back
    // until the next video's chat frame reports in.
    ctx.addEventListener(document, 'yt-navigate-start', () => resetChat(false));

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

    // YouTube is a single-page app: the player can be created, replaced or
    // removed without a page load. autoMount watches for the anchor and
    // mounts/unmounts the overlay as it comes and goes.
    ui.autoMount();
  },
});
