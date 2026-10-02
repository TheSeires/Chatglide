<script lang="ts">
  import { backOut, cubicOut } from 'svelte/easing';
  import { fade, fly, scale, slide, type TransitionConfig } from 'svelte/transition';
  import { saveSettings, settings, withOpacity } from '@/utils/settings.svelte';
  import type { ChatMode } from '@/utils/chat';
  import { t } from '@/utils/i18n';
  import { to24Hour } from '@/utils/time';
  import { chat, setChatMode, type ShownMessage } from './chat.svelte';
  import { overlayEnabled, setVideoOverride } from './visibility.svelte';

  const MARGIN = 12;
  // Keeps the overlay clear of YouTube's control bar and progress bar.
  const BOTTOM_MARGIN = 72;
  const MIN_WIDTH = 200;
  const MIN_HEIGHT = 120;
  const HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;

  let collapsed = $state(false);
  let list: HTMLOListElement | undefined = $state();
  // Follow new messages unless the user has scrolled up to read older ones.
  let followLatest = true;

  // Player size (the frame fills the shadow host, which covers the player).
  let frameWidth = $state(0);
  let frameHeight = $state(0);
  let boxHeight = $state(0);

  const width = $derived(clamp(settings.width, MIN_WIDTH, frameWidth - 2 * MARGIN));
  const height = $derived(clamp(settings.height, MIN_HEIGHT, frameHeight - MARGIN - BOTTOM_MARGIN));
  const left = $derived(MARGIN + settings.x * freeSpace(frameWidth, width, MARGIN));
  const top = $derived(MARGIN + settings.y * freeSpace(frameHeight, boxHeight, BOTTOM_MARGIN));

  function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(value, max));
  }

  function freeSpace(frameSize: number, boxSize: number, endMargin: number) {
    return Math.max(0, frameSize - boxSize - MARGIN - endMargin);
  }

  /** Inverse of the left/top formulas: pixel offset -> 0–1 position. */
  function toFraction(offset: number, frameSize: number, boxSize: number, endMargin: number) {
    const free = freeSpace(frameSize, boxSize, endMargin);
    return free > 0 ? clamp((offset - MARGIN) / free, 0, 1) : 0;
  }

  function onScroll() {
    if (!list) return;
    followLatest = list.scrollHeight - list.scrollTop - list.clientHeight < 24;
  }

  function scrollToLatest() {
    if (list && followLatest) list.scrollTop = list.scrollHeight;
  }

  $effect(() => {
    chat.revision;
    settings.fontSize;
    settings.showTime;
    scrollToLatest();
  });

  // The list changes size when the header hides/shows or the overlay is resized.
  $effect(() => {
    if (!list) return;
    const observer = new ResizeObserver(scrollToLatest);
    observer.observe(list);
    return () => observer.disconnect();
  });

  let hovering = $state(false);
  let headerHidden = $state(false);

  $effect(() => {
    if (!settings.autoHideHeader || collapsed || hovering) {
      headerHidden = false;
      return;
    }
    const timer = setTimeout(() => (headerHidden = true), settings.autoHideDelay * 1000);
    return () => clearTimeout(timer);
  });

  const textShadow = $derived(
    settings.textShadow
      ? `0 ${settings.textShadowOffset}px ${settings.textShadowBlur}px ${withOpacity(settings.textShadowColor, settings.textShadowOpacity)}`
      : 'none',
  );

  const modeLabel = (mode: ChatMode) => t(mode === 'all' ? 'modeAll' : 'modeTop');

  const fadeMode = $derived(settings.displayMode === 'fade');
  let now = $state(Date.now());

  $effect(() => {
    if (!fadeMode) return;
    const timer = setInterval(() => (now = Date.now()), 250);
    return () => clearInterval(timer);
  });

  // In fade mode a message shows for `messageLifetime` seconds; the newest `keepLast` always stay.
  const visibleMessages = $derived.by(() => {
    if (!fadeMode) return chat.messages;
    const lifetime = settings.messageLifetime * 1000;
    const keepFrom = chat.messages.length - settings.keepLast;
    return chat.messages.filter(
      (m, i) => i >= keepFrom || (!m.backlog && m.receivedAt + lifetime > now),
    );
  });

  function enterAnimation(node: Element): TransitionConfig | null {
    switch (settings.enterAnimation) {
      case 'fade':
        return fade(node, { duration: 250 });
      case 'slide':
        return fly(node, { y: 16, duration: 250, easing: cubicOut });
      case 'glide':
        return fly(node, { x: settings.x >= 0.5 ? 48 : -48, duration: 320, easing: cubicOut });
      case 'pop':
        return scale(node, { start: 0.8, duration: 260, easing: backOut });
      default:
        return null;
    }
  }

  /** Runs several transitions on one node at once, each with its own duration and easing. */
  function combine(...configs: TransitionConfig[]): TransitionConfig {
    const duration = Math.max(...configs.map((c) => c.duration ?? 0));
    return {
      duration,
      css: (t) =>
        configs
          .map((c) => {
            const local = Math.min(1, (t * duration) / (c.duration || 1));
            const eased = (c.easing ?? ((x: number) => x))(local);
            return c.css?.(eased, 1 - eased) ?? '';
          })
          .join(';'),
    };
  }

  // Fade mode: messages grow/shrink in height, so the bottom-anchored list never jumps or shows an empty panel.
  function enter(node: Element, message: ShownMessage): TransitionConfig {
    if (message.backlog) return { duration: 0 };
    const animation = enterAnimation(node);
    if (!fadeMode) return animation ?? { duration: 0 };
    const grow = slide(node, { duration: 250, easing: cubicOut });
    return animation ? combine(grow, animation) : grow;
  }

  function leave(node: Element): TransitionConfig {
    if (!fadeMode) return { duration: 0 };
    return combine(slide(node, { duration: 400, easing: cubicOut }), fade(node, { duration: 300 }));
  }

  /** Runs `onMove(dx, dy)` while the pointer is held, then persists the settings. */
  function track(event: PointerEvent, onMove: (dx: number, dy: number) => void) {
    if (event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    const startX = event.clientX;
    const startY = event.clientY;
    target.setPointerCapture(event.pointerId);

    const move = (e: PointerEvent) => onMove(e.clientX - startX, e.clientY - startY);
    const end = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', end);
      target.removeEventListener('pointercancel', end);
      saveSettings();
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
  }

  function startDrag(event: PointerEvent) {
    if ((event.target as Element).closest('button')) return;
    const startLeft = left;
    const startTop = top;
    track(event, (dx, dy) => {
      settings.x = toFraction(startLeft + dx, frameWidth, width, MARGIN);
      settings.y = toFraction(startTop + dy, frameHeight, boxHeight, BOTTOM_MARGIN);
    });
  }

  function startResize(event: PointerEvent, handle: (typeof HANDLES)[number]) {
    const start = { left, top, width, height };
    const right = start.left + start.width;
    const bottom = start.top + start.height;
    track(event, (dx, dy) => {
      let w = start.width;
      let h = start.height;
      // Each edge may grow only as far as the player's margin.
      if (handle.includes('e')) w = clamp(w + dx, MIN_WIDTH, frameWidth - MARGIN - start.left);
      if (handle.includes('w')) w = clamp(w - dx, MIN_WIDTH, right - MARGIN);
      if (handle.includes('s')) h = clamp(h + dy, MIN_HEIGHT, frameHeight - BOTTOM_MARGIN - start.top);
      if (handle.includes('n')) h = clamp(h - dy, MIN_HEIGHT, bottom - MARGIN);
      const l = handle.includes('w') ? right - w : start.left;
      const t = handle.includes('n') ? bottom - h : start.top;
      settings.width = w;
      settings.height = h;
      settings.x = toFraction(l, frameWidth, w, MARGIN);
      settings.y = toFraction(t, frameHeight, h, BOTTOM_MARGIN);
    });
  }
</script>

<div class="frame" bind:clientWidth={frameWidth} bind:clientHeight={frameHeight}>
  {#if chat.active && overlayEnabled()}
    <!-- svelte-ignore a11y_no_static_element_interactions (hover only reveals the header) -->
    <div
      class="overlay"
      class:collapsed
      class:fade-mode={fadeMode}
      style:left="{left}px"
      style:top="{top}px"
      style:width="{width}px"
      style:height={collapsed ? null : `${height}px`}
      style:font-size="{settings.fontSize}px"
      style:text-shadow={textShadow}
      style:--overlay-bg={settings.overlayBackground
        ? withOpacity(settings.overlayColor, settings.overlayOpacity)
        : 'transparent'}
      style:--message-bg={settings.messageBackground
        ? withOpacity(settings.messageColor, settings.messageOpacity)
        : 'transparent'}
      style:--header-padding="{settings.headerPadding}px"
      style:--list-padding="{settings.listPadding}px"
      style:--message-padding="{settings.messagePadding}px"
      style:--message-gap="{settings.messageGap}px"
      style:--blur="{settings.backgroundBlur}px"
      class:no-background={!settings.overlayBackground}
      class:message-background={settings.messageBackground}
      bind:offsetHeight={boxHeight}
      onmouseenter={() => (hovering = true)}
      onmouseleave={() => (hovering = false)}
    >
      <div class="header-wrap" class:hidden={headerHidden}>
        <div class="header-clip">
          <!-- svelte-ignore a11y_no_static_element_interactions (mouse-only drag handle) -->
          <header onpointerdown={startDrag}>
            {#if chat.mode}
              {@const other = chat.mode === 'all' ? 'top' : 'all'}
              <button
                type="button"
                title={t('switchTo', { mode: modeLabel(other) })}
                onclick={() => setChatMode(other)}
              >
                {modeLabel(chat.mode)} ⇄
              </button>
            {:else}
              <span>{t('liveChat')}</span>
            {/if}
            <span class="header-actions">
              <button type="button" onclick={() => (collapsed = !collapsed)}>
                {collapsed ? t('show') : t('hide')}
              </button>
              <button
                type="button"
                class="close"
                title={t('turnOffForVideo')}
                aria-label={t('turnOffForVideo')}
                onclick={() => setVideoOverride(false)}
              >
                ✕
              </button>
            </span>
          </header>
        </div>
      </div>
      {#if !collapsed}
        <ol
          bind:this={list}
          onscroll={onScroll}
          class:emptying={fadeMode && visibleMessages.length === 0}
        >
          {#each visibleMessages as message (message.id)}
            <li in:enter={message} out:leave>
              {#if settings.showTime && message.time}
                <span class="time">{settings.time24h ? to24Hour(message.time) : message.time}</span>
              {/if}
              <span class="author {message.authorType}">{message.author}</span>
              {#each message.runs as run}
                {#if 'emoji' in run}
                  <img class="emoji" src={run.emoji} alt={run.alt} />
                {:else}
                  {run.text}
                {/if}
              {/each}
            </li>
          {:else}
            {#if !fadeMode}
              <li class="placeholder">{t('waiting')}</li>
            {/if}
          {/each}
        </ol>
        {#each HANDLES as handle}
          <!-- svelte-ignore a11y_no_static_element_interactions (mouse-only resize handle) -->
          <div class="handle {handle}" onpointerdown={(e) => startResize(e, handle)}></div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .frame {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .overlay {
    position: absolute;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    border-radius: 8px;
    background: var(--overlay-bg);
    color: #fff;
    font-family: Roboto, Arial, sans-serif;
    line-height: 1.4;
    pointer-events: auto;
    backdrop-filter: blur(var(--blur));
  }

  .overlay.no-background {
    backdrop-filter: none;
  }

  /* Collapses to zero height (grid 1fr -> 0fr) so the message list takes the space. */
  .header-wrap {
    display: grid;
    grid-template-rows: 1fr;
    transition:
      grid-template-rows 0.25s ease,
      opacity 0.25s ease;
  }

  .header-wrap.hidden {
    grid-template-rows: 0fr;
    opacity: 0;
  }

  .header-clip {
    min-height: 0;
    overflow: hidden;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: var(--header-padding) calc(var(--header-padding) + 4px);
    font-weight: 500;
    cursor: move;
    user-select: none;
    touch-action: none;
  }

  .no-background.message-background header {
    backdrop-filter: blur(var(--blur));
  }

  .no-background header {
    margin-bottom: var(--message-gap);
    border-radius: 8px;
    background: var(--message-bg);
  }

  button {
    border: 0;
    border-radius: 4px;
    padding: 2px 8px;
    background: rgb(255 255 255 / 0.15);
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  button:hover {
    background: rgb(255 255 255 / 0.25);
  }

  .header-actions {
    display: flex;
    gap: 4px;
  }

  button.close {
    padding: 2px 6px;
  }

  ol {
    flex: 1;
    min-height: 0;
    margin: 0;
    padding: 0 var(--list-padding) var(--list-padding);
    list-style: none;
    overflow-y: auto;
    overflow-wrap: anywhere;
    scrollbar-width: thin;
    scrollbar-color: rgb(255 255 255 / 0.3) transparent;
  }

  /* Fade mode: a fixed see-through area where messages stack from the bottom, like stream chat overlays. */
  .overlay.fade-mode {
    background: transparent;
    backdrop-filter: none;
  }

  .fade-mode:not(.no-background) header {
    margin-bottom: var(--message-gap);
    border-radius: 8px;
    background: var(--overlay-bg);
    backdrop-filter: blur(var(--blur));
  }

  .fade-mode ol {
    flex: 0 1 auto;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    margin-top: auto;
    padding: var(--list-padding);
    border-radius: 8px;
    background: var(--overlay-bg);
    overflow: hidden;
    transition: opacity 0.3s ease;
    /* Replays each time the panel reappears (from display: none), so it fades in with its first message. */
    animation: panel-in 0.25s ease;
  }

  @keyframes panel-in {
    from {
      opacity: 0;
    }
  }

  /* The last message is leaving: fade the whole panel with it. */
  .fade-mode ol.emptying {
    opacity: 0;
  }

  .fade-mode:not(.no-background) ol {
    backdrop-filter: blur(var(--blur));
  }

  .fade-mode ol:not(:has(li)) {
    display: none;
  }

  li {
    padding: var(--message-padding);
    border-radius: 4px;
    background: var(--message-bg);
  }

  .message-background li {
    backdrop-filter: blur(var(--blur));
  }

  li + li {
    margin-top: var(--message-gap);
  }

  .time {
    margin-right: 6px;
    font-size: 0.85em;
    color: rgb(255 255 255 / 0.5);
  }

  .author {
    margin-right: 6px;
    font-weight: 500;
    color: rgb(255 255 255 / 0.7);
  }

  .author.owner {
    color: #ffd600;
  }

  .author.moderator {
    color: #5e84f1;
  }

  .author.member {
    color: #2ba640;
  }

  .emoji {
    width: 1.3em;
    height: 1.3em;
    vertical-align: middle;
  }

  .placeholder {
    opacity: 0.7;
  }

  .handle {
    position: absolute;
    touch-action: none;
  }

  .handle.n,
  .handle.s {
    left: 8px;
    right: 8px;
    height: 6px;
    cursor: ns-resize;
  }

  .handle.e,
  .handle.w {
    top: 8px;
    bottom: 8px;
    width: 6px;
    cursor: ew-resize;
  }

  .handle.n {
    top: -3px;
  }

  .handle.s {
    bottom: -3px;
  }

  .handle.e {
    right: -3px;
  }

  .handle.w {
    left: -3px;
  }

  .handle.ne,
  .handle.nw,
  .handle.se,
  .handle.sw {
    width: 12px;
    height: 12px;
  }

  .handle.ne {
    top: -3px;
    right: -3px;
    cursor: nesw-resize;
  }

  .handle.sw {
    bottom: -3px;
    left: -3px;
    cursor: nesw-resize;
  }

  .handle.nw {
    top: -3px;
    left: -3px;
    cursor: nwse-resize;
  }

  .handle.se {
    bottom: -3px;
    right: -3px;
    cursor: nwse-resize;
  }
</style>
