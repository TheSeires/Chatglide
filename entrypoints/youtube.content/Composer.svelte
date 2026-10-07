<script lang="ts">
  import { tick } from 'svelte';
  import { t } from '@/utils/i18n';
  import { settings, withOpacity } from '@/utils/settings.svelte';
  import { isAvatarUrl, type EmojiItem } from '@/utils/chat';
  import { chat, requestEmojis, sendChatMessage } from './chat.svelte';
  import { COMMON_EMOJIS } from './emojis';

  let { hovering }: { hovering: boolean } = $props();

  let draft = $state('');
  let input: HTMLInputElement | undefined = $state();
  let focused = $state(false);
  let sending = $state(false);
  let failed = $state(false);
  let pickerOpen = $state(false);
  let hidden = $state(false);

  // Own auto-hide timer; never hides while the user is typing or picking an emoji.
  $effect(() => {
    if (!settings.chatInputAutoHide || hovering || focused || pickerOpen || sending || draft) {
      hidden = false;
      return;
    }
    const timer = setTimeout(() => (hidden = true), settings.chatInputHideDelay * 1000);
    return () => clearTimeout(timer);
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    sending = true;
    failed = false;
    pickerOpen = false;
    const ok = await sendChatMessage(text);
    sending = false;
    if (ok) {
      draft = '';
      caret = 0;
    }
    else failed = true;
    // Sending focuses YouTube's hidden chat box, so take focus back once the input is enabled again.
    await tick();
    input?.focus();
  }

  function insert(emoji: string) {
    const start = input?.selectionStart ?? draft.length;
    const end = input?.selectionEnd ?? start;
    // YouTube only turns ":shortcut:" into a channel emoji when it stands apart from other text.
    const text = emoji.startsWith(':')
      ? `${start > 0 && !/\s$/.test(draft.slice(0, start)) ? ' ' : ''}${emoji} `
      : emoji;
    draft = draft.slice(0, start) + text + draft.slice(end);
    caret = start + text.length;
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + text.length, start + text.length);
    });
  }

  let query = $state('');
  let search: HTMLInputElement | undefined = $state();

  function togglePicker() {
    pickerOpen = !pickerOpen;
    query = '';
    if (pickerOpen && chat.emojiCategories.length === 0) requestEmojis();
    if (pickerOpen) requestAnimationFrame(() => search?.focus());
  }

  // Searching flattens all categories; locked sponsor emojis stay visible but can't be picked.
  const results = $derived.by(() => {
    const words = query.trim().toLowerCase();
    if (!words) return null;
    return chat.emojiCategories
      .flatMap((category) =>
        category.emojis.map((emoji) => ({ ...emoji, locked: category.locked, hint: category.lockedHint })),
      )
      .filter((emoji) => emoji.search.includes(words) || emoji.text === words);
  });

  // YouTube's set has ~1,500 emojis; rendering them all made the popover take a second to open.
  // So the list is laid out as fixed-height rows and only the rows in view are rendered.
  type ShownEmoji = EmojiItem & { locked: boolean; hint: string };
  type Row =
    | { key: string; top: number; height: number; header: { title: string; locked: boolean; hint: string } }
    | { key: string; top: number; height: number; emojis: ShownEmoji[] };

  const PER_ROW = 8;
  const ROW_HEIGHT = 32;
  const HEADER_HEIGHT = 26;
  const OVERSCAN = 160;

  let scroller: HTMLDivElement | undefined = $state();
  let scrollTop = $state(0);
  let viewportHeight = $state(0);

  const layout = $derived.by(() => {
    const plain = (emojis: EmojiItem[]) => emojis.map((emoji) => ({ ...emoji, locked: false, hint: '' }));
    const groups = results
      ? [{ title: '', locked: false, hint: '', emojis: results }]
      : chat.emojiCategories.length
        ? chat.emojiCategories.map((category) => ({
            title: category.title,
            locked: category.locked,
            hint: category.lockedHint,
            emojis: category.emojis.map((emoji) => ({ ...emoji, locked: category.locked, hint: category.lockedHint })),
          }))
        : // YouTube's set is still loading (or unavailable): offer common emojis meanwhile.
          [{ title: '', locked: false, hint: '', emojis: plain(COMMON_EMOJIS.map((text) => ({ text, image: '', label: text, search: '' }))) }];

    const rows: Row[] = [];
    let top = 0;
    groups.forEach((group, g) => {
      if (group.title) {
        rows.push({ key: `h${g}`, top, height: HEADER_HEIGHT, header: group });
        top += HEADER_HEIGHT;
      }
      for (let i = 0; i < group.emojis.length; i += PER_ROW) {
        rows.push({ key: `r${g}-${i}`, top, height: ROW_HEIGHT, emojis: group.emojis.slice(i, i + PER_ROW) });
        top += ROW_HEIGHT;
      }
    });
    return { rows, height: top };
  });

  const visibleRows = $derived(
    layout.rows.filter(
      (row) => row.top + row.height >= scrollTop - OVERSCAN && row.top <= scrollTop + viewportHeight + OVERSCAN,
    ),
  );

  $effect(() => {
    // A new search starts at the top of its results.
    query;
    if (scroller) scroller.scrollTop = 0;
    scrollTop = 0;
  });

  // --- @mentions: suggest chat authors while typing "@name", like YouTube's own input ---

  const MAX_SUGGESTIONS = 6;
  let caret = $state(0);
  let selected = $state(0);
  let mentionsDismissed = $state(false);

  /** The "@partial" right before the caret, if any. */
  const mention = $derived.by(() => {
    const match = /(?:^|\s)@([^\s@]*)$/.exec(draft.slice(0, caret));
    return match ? { query: match[1]!.toLowerCase(), start: caret - match[1]!.length - 1 } : null;
  });

  // Most recent authors first, then YouTube's participants (who may not have written yet);
  // names starting with the query rank above names containing it.
  const suggestions = $derived.by(() => {
    if (!mention || mentionsDismissed || pickerOpen) return [];
    const starts: { name: string; avatar: string }[] = [];
    const contains: { name: string; avatar: string }[] = [];
    const seen = new Set<string>();
    const consider = (name: string, avatar: string) => {
      const handle = name.replace(/^@/, '').toLowerCase();
      if (!handle || seen.has(handle)) return;
      seen.add(handle);
      if (handle.startsWith(mention.query)) starts.push({ name, avatar });
      else if (handle.includes(mention.query)) contains.push({ name, avatar });
    };
    for (let i = chat.messages.length - 1; i >= 0; i--) consider(chat.messages[i]!.author, chat.messages[i]!.avatar);
    for (const participant of chat.participants) consider(participant.name, participant.avatar);
    return starts.concat(contains).slice(0, MAX_SUGGESTIONS);
  });

  $effect(() => {
    // A new query starts from the top of the list again.
    mention?.query;
    selected = 0;
  });

  function trackCaret() {
    caret = input?.selectionStart ?? draft.length;
    mentionsDismissed = false;
  }

  function completeMention(name: string) {
    if (!mention) return;
    const handle = name.startsWith('@') ? name : `@${name}`;
    const before = draft.slice(0, mention.start) + handle + ' ';
    draft = before + draft.slice(caret).replace(/^\s+/, '');
    caret = before.length;
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(before.length, before.length);
    });
  }

  // Keys typed here must not reach YouTube's player shortcuts (space, F, J/K/L, numbers…).
  function keyboard(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.type !== 'keydown') return;
    if (suggestions.length) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        selected = (selected + step + suggestions.length) % suggestions.length;
        return;
      }
      if (event.key === 'Tab' || event.key === 'Enter') {
        event.preventDefault();
        completeMention(suggestions[selected]!.name);
        return;
      }
      if (event.key === 'Escape') {
        mentionsDismissed = true;
        return;
      }
    }
    // Esc closes the emoji popover first, and leaves the field on a second press.
    if (event.key === 'Escape') {
      if (pickerOpen) pickerOpen = false;
      else input?.blur();
    }
  }

  function searchKeyboard(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.type !== 'keydown') return;
    if (event.key === 'Escape') {
      pickerOpen = false;
      tick().then(() => input?.focus());
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const first = results?.find((emoji) => !emoji.locked);
      if (first) insert(first.text);
    }
  }
</script>

{#snippet emojiButton(emoji: { text: string; image: string; label: string }, locked: boolean, hint: string)}
  <button
    type="button"
    class:locked
    title={locked && hint ? `${emoji.label} · ${hint}` : emoji.label}
    aria-label={emoji.label}
    aria-disabled={locked}
    onclick={() => !locked && insert(emoji.text)}
  >
    {#if emoji.image}
      <img src={emoji.image} alt={emoji.label} loading="lazy" />
    {:else}
      {emoji.text}
    {/if}
  </button>
{/snippet}

<div
  class="composer-wrap"
  class:hidden
  style:--input-font="{settings.inputFontSize}px"
  style:--input-color={settings.inputTextColor}
  style:--input-bg={withOpacity(settings.inputBackgroundColor, settings.inputBackgroundOpacity)}
  style:--input-border={settings.inputBorder
    ? `${settings.inputBorderWidth}px solid ${withOpacity(settings.inputBorderColor, settings.inputBorderOpacity)}`
    : 'none'}
  style:--input-radius="{settings.inputRadius}px"
  style:--input-padding="{settings.inputPadding}px"
>
  <div class="composer-clip">
    {#if chat.input.available}
      <form class="composer" onsubmit={submit}>
        <input
          bind:this={input}
          bind:value={draft}
          type="text"
          maxlength={chat.input.maxLength}
          placeholder={t('chatPlaceholder')}
          aria-label={t('chatPlaceholder')}
          disabled={sending}
          onfocus={() => (focused = true)}
          onblur={() => (focused = false)}
          onkeydown={keyboard}
          onkeyup={(event) => {
            keyboard(event);
            if (!['ArrowUp', 'ArrowDown', 'Tab', 'Enter', 'Escape'].includes(event.key)) trackCaret();
          }}
          onkeypress={keyboard}
          onclick={trackCaret}
          oninput={() => {
            failed = false;
            trackCaret();
          }}
        />
        {#if settings.chatInputEmoji}
          <button
            type="button"
            class="emoji-button"
            class:active={pickerOpen}
            title={t('emoji')}
            aria-label={t('emoji')}
            aria-expanded={pickerOpen}
            onclick={togglePicker}
          >
            😊
          </button>
        {/if}
      </form>
      {#if failed}
        <p class="note error" role="alert">{t('sendFailed')}</p>
      {/if}
    {:else if chat.input.reason}
      <p class="note">{chat.input.reason}</p>
    {/if}
  </div>

  {#if suggestions.length && chat.input.available}
    <ul class="mentions" role="listbox" aria-label={t('mentionSuggestions')}>
      {#each suggestions as suggestion, index (suggestion.name)}
        <li
          role="option"
          aria-selected={index === selected}
          class:selected={index === selected}
          onpointerdown={(event) => {
            event.preventDefault();
            completeMention(suggestion.name);
          }}
          onpointerenter={() => (selected = index)}
        >
          {#if suggestion.avatar && isAvatarUrl(suggestion.avatar)}
            <img src={suggestion.avatar} alt="" referrerpolicy="no-referrer" />
          {:else}
            <span class="initial">{suggestion.name.replace(/^@/, '').charAt(0).toUpperCase()}</span>
          {/if}
          <span class="name">{suggestion.name}</span>
        </li>
      {/each}
    </ul>
  {/if}

  {#if pickerOpen && chat.input.available}
    <div class="emoji-popover" role="dialog" aria-label={t('emoji')}>
      <input
        bind:this={search}
        bind:value={query}
        class="emoji-search"
        type="search"
        placeholder={t('searchEmojis')}
        aria-label={t('searchEmojis')}
        onkeydown={searchKeyboard}
        onkeyup={searchKeyboard}
        onkeypress={searchKeyboard}
      />
      <div
        class="emoji-scroll"
        bind:this={scroller}
        bind:clientHeight={viewportHeight}
        onscroll={(event) => (scrollTop = event.currentTarget.scrollTop)}
      >
        {#if results && !results.length}
          <p class="empty">{t('noEmojisFound')}</p>
        {:else}
          <div class="emoji-canvas" style:height="{layout.height}px">
            {#each visibleRows as row (row.key)}
              <div class="emoji-row" style:top="{row.top}px" style:height="{row.height}px">
                {#if 'header' in row}
                  <h3 title={row.header.locked ? row.header.hint : undefined}>
                    {row.header.locked ? '🔒 ' : ''}{row.header.title}
                  </h3>
                {:else}
                  <div class="emoji-grid">
                    {#each row.emojis as emoji (emoji.text)}
                      {@render emojiButton(emoji, emoji.locked, emoji.hint)}
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .composer-wrap {
    position: relative;
    display: grid;
    grid-template-rows: 1fr;
    padding: 0 var(--list-padding) var(--list-padding);
    transition:
      grid-template-rows 0.25s ease,
      opacity 0.25s ease,
      padding 0.25s ease;
  }

  .composer-wrap.hidden {
    grid-template-rows: 0fr;
    padding-bottom: 0;
    opacity: 0;
  }

  .composer-clip {
    min-height: 0;
    overflow: hidden;
  }

  .composer {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: var(--input-padding);
    border: var(--input-border);
    border-radius: var(--input-radius);
    background: var(--input-bg);
  }

  input {
    flex: 1;
    min-width: 0;
    padding: 2px 4px;
    border: 0;
    outline: none;
    background: transparent;
    color: var(--input-color);
    font: inherit;
    font-size: var(--input-font);
    text-shadow: none;
  }

  input::placeholder {
    color: var(--input-color);
    opacity: 0.6;
  }

  .emoji-button {
    flex: none;
    padding: 0 4px;
    border: 0;
    background: none;
    font-size: var(--input-font);
    line-height: 1;
    opacity: 0.8;
    cursor: pointer;
  }

  .emoji-button:hover,
  .emoji-button.active {
    opacity: 1;
    background: none;
  }

  .note {
    margin: 0;
    font-size: 0.85em;
    opacity: 0.75;
  }

  .note.error {
    margin-top: 4px;
    color: #fca5a5;
    opacity: 1;
  }

  .mentions {
    position: absolute;
    left: var(--list-padding);
    right: var(--list-padding);
    bottom: calc(100% + 4px);
    z-index: 1;
    margin: 0;
    padding: 4px;
    list-style: none;
    border-radius: 8px;
    background: rgb(24 24 27 / 0.96);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.5);
    text-shadow: none;
  }

  .mentions li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
  }

  .mentions li.selected {
    background: rgb(255 255 255 / 0.14);
  }

  .mentions img,
  .mentions .initial {
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
  }

  .mentions .initial {
    display: grid;
    place-items: center;
    background: rgb(255 255 255 / 0.2);
    font-size: 11px;
    font-weight: 600;
  }

  .mentions .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .emoji-popover {
    position: absolute;
    right: var(--list-padding);
    bottom: calc(100% + 4px);
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 300px;
    height: 300px;
    padding: 8px;
    box-sizing: border-box;
    border-radius: 8px;
    background: rgb(24 24 27 / 0.96);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.5);
    text-shadow: none;
  }

  .emoji-search {
    flex: none;
    padding: 6px 8px;
    border: 1px solid rgb(255 255 255 / 0.15);
    border-radius: 6px;
    outline: none;
    background: rgb(255 255 255 / 0.06);
    color: #fff;
    font: inherit;
    font-size: 13px;
  }

  .emoji-search:focus {
    border-color: rgb(255 255 255 / 0.35);
  }

  .emoji-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgb(255 255 255 / 0.3) transparent;
  }

  .emoji-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 2px;
  }

  .emoji-canvas {
    position: relative;
  }

  .emoji-row {
    position: absolute;
    left: 0;
    right: 0;
  }

  h3 {
    margin: 0;
    padding: 6px 2px 0;
    overflow: hidden;
    font-size: 12px;
    font-weight: 500;
    line-height: 20px;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: rgb(255 255 255 / 0.6);
  }

  .empty {
    margin: 16px 0;
    text-align: center;
    font-size: 13px;
    opacity: 0.7;
  }

  .emoji-popover button.locked {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .emoji-popover button {
    display: grid;
    place-items: center;
    height: 30px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: none;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
  }

  .emoji-popover button:hover {
    background: rgb(255 255 255 / 0.12);
  }

  .emoji-popover img {
    width: 24px;
    height: 24px;
  }
</style>
