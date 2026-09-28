<script lang="ts">
  import { browserLocale, currentLocale, t } from '@/utils/i18n';
  import { LANGUAGE_NAMES, LOCALES, type Locale, type MessageKey } from '@/utils/locales';
  import {
    DEFAULT_SETTINGS,
    loadSettings,
    saveSettings,
    settings,
    type OverlaySettings,
    type PopupTheme,
  } from '@/utils/settings.svelte';
  import ColorSwatch from './ui/ColorSwatch.svelte';
  import Slider from './ui/Slider.svelte';
  import Switch from './ui/Switch.svelte';

  type BooleanKey = {
    [K in keyof OverlaySettings]: OverlaySettings[K] extends boolean ? K : never;
  }[keyof OverlaySettings];
  type NumberKey = {
    [K in keyof OverlaySettings]: OverlaySettings[K] extends number ? K : never;
  }[keyof OverlaySettings];
  type ColorKey = 'overlayColor' | 'messageColor' | 'textShadowColor';

  const CORNERS: { label: MessageKey; x: number; y: number }[] = [
    { label: 'topLeft', x: 0, y: 0 },
    { label: 'topRight', x: 1, y: 0 },
    { label: 'bottomLeft', x: 0, y: 1 },
    { label: 'bottomRight', x: 1, y: 1 },
  ];

  const THEMES: { value: PopupTheme; label: MessageKey }[] = [
    { value: 'system', label: 'themeSystem' },
    { value: 'light', label: 'themeLight' },
    { value: 'dark', label: 'themeDark' },
  ];

  let loaded = $state(false);

  $effect(() => {
    let unwatch: (() => void) | undefined;
    loadSettings().then((stop) => {
      unwatch = stop;
      loaded = true;
    });
    return () => unwatch?.();
  });

  $effect(() => {
    const root = document.documentElement;
    if (settings.popupTheme === 'system') delete root.dataset.theme;
    else root.dataset.theme = settings.popupTheme;
  });

  $effect(() => {
    document.documentElement.lang = currentLocale();
  });

  function cycleTheme() {
    const index = THEMES.findIndex((theme) => theme.value === settings.popupTheme);
    saveSettings({ popupTheme: THEMES[(index + 1) % THEMES.length]!.value });
  }

  const themeLabel = $derived(
    t(THEMES.find((theme) => theme.value === settings.popupTheme)?.label ?? 'themeSystem'),
  );
</script>

{#snippet toggle(key: BooleanKey, label: MessageKey)}
  <Switch
    label={t(label)}
    checked={settings[key]}
    onchange={(checked) => saveSettings({ [key]: checked })}
  />
{/snippet}

{#snippet slider(key: NumberKey, label: MessageKey, min: number, max: number, unit = 'px', step = 1)}
  <Slider
    label={t(label)}
    value={settings[key]}
    {min}
    {max}
    {step}
    {unit}
    onchange={(value) => saveSettings({ [key]: value })}
  />
{/snippet}

<!-- A switch that reveals a color swatch + opacity slider when on. -->
{#snippet colorOption(enabledKey: BooleanKey, colorKey: ColorKey, opacityKey: NumberKey, label: MessageKey)}
  {@render toggle(enabledKey, label)}
  {#if settings[enabledKey]}
    <div class="color-row">
      <ColorSwatch
        label={t('color')}
        value={settings[colorKey]}
        onchange={(value) => saveSettings({ [colorKey]: value })}
      />
      <Slider
        ariaLabel={t('opacity')}
        value={settings[opacityKey]}
        min={0}
        max={100}
        unit="%"
        onchange={(value) => saveSettings({ [opacityKey]: value })}
      />
    </div>
  {/if}
{/snippet}

<main>
  <header>
    <h1><img src="/icon/32.png" alt="" width="22" height="22" />Chatglide</h1>
    <div class="header-actions">
      <select
        class="language"
        aria-label={t('language')}
        title={t('language')}
        value={settings.language}
        onchange={(e) => saveSettings({ language: e.currentTarget.value as 'auto' | Locale })}
      >
        <option value="auto">{t('languageAuto', { language: LANGUAGE_NAMES[browserLocale()] })}</option>
        {#each LOCALES as locale}
          <option value={locale} lang={locale}>{LANGUAGE_NAMES[locale]}</option>
        {/each}
      </select>
      <button
        type="button"
        class="icon-button"
        title={t('theme', { theme: themeLabel })}
        aria-label={t('theme', { theme: themeLabel })}
        onclick={cycleTheme}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {#if settings.popupTheme === 'light'}
            <circle cx="12" cy="12" r="4" />
            <path
              d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
            />
          {:else if settings.popupTheme === 'dark'}
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          {:else}
            <rect width="20" height="14" x="2" y="3" rx="2" />
            <path d="M8 21h8M12 17v4" />
          {/if}
        </svg>
      </button>
    </div>
  </header>

  {#if loaded}
    <section>
      <h2>{t('sectionChat')}</h2>
      {@render toggle('forceAllMessages', 'forceAllMessages')}
      {@render toggle('showTime', 'showTime')}
      {#if settings.showTime}
        {@render toggle('time24h', 'time24h')}
      {/if}
      {@render toggle('showNativeChat', 'showNativeChat')}
    </section>

    <section>
      <h2>{t('sectionHeader')}</h2>
      {@render toggle('autoHideHeader', 'autoHideHeader')}
      {#if settings.autoHideHeader}
        {@render slider('autoHideDelay', 'hideAfter', 1, 30, 's')}
      {/if}
    </section>

    <section>
      <h2>{t('sectionBackground')}</h2>
      {@render colorOption('overlayBackground', 'overlayColor', 'overlayOpacity', 'overlayBackground')}
      {@render colorOption('messageBackground', 'messageColor', 'messageOpacity', 'messageBackground')}
    </section>

    <section>
      <h2>{t('sectionText')}</h2>
      {@render slider('fontSize', 'fontSize', 10, 28)}
      {@render colorOption('textShadow', 'textShadowColor', 'textShadowOpacity', 'textShadow')}
      {#if settings.textShadow}
        {@render slider('textShadowBlur', 'shadowBlur', 0, 10)}
        {@render slider('textShadowOffset', 'shadowOffset', 0, 5)}
      {/if}
    </section>

    <section>
      <h2>{t('sectionSpacing')}</h2>
      {@render slider('headerPadding', 'headerPadding', 0, 24)}
      {@render slider('listPadding', 'listPadding', 0, 24)}
      {@render slider('messagePadding', 'messagePadding', 0, 16)}
      {@render slider('messageGap', 'messageGap', 0, 16)}
    </section>

    <section>
      <h2>{t('sectionSize')}</h2>
      {@render slider('width', 'width', 200, 800, 'px', 10)}
      {@render slider('height', 'height', 120, 900, 'px', 10)}
      <div class="corners" role="radiogroup" aria-label={t('position')}>
        {#each CORNERS as corner}
          {@const active = settings.x === corner.x && settings.y === corner.y}
          <button
            type="button"
            role="radio"
            aria-checked={active}
            class:active
            onclick={() => saveSettings({ x: corner.x, y: corner.y })}
          >
            {t(corner.label)}
          </button>
        {/each}
      </div>
      <p class="hint">{t('dragHint')}</p>
    </section>

    <footer>
      <button
        type="button"
        class="outline"
        onclick={() =>
          saveSettings({
            ...DEFAULT_SETTINGS,
            language: settings.language,
            popupTheme: settings.popupTheme,
          })}
      >
        {t('reset')}
      </button>
    </footer>
  {/if}
</main>

<style>
  main {
    width: 320px;
  }

  header {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
  }

  h1 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
  }

  .header-actions {
    display: flex;
    gap: 6px;
    min-width: 0;
  }

  .language {
    min-width: 0;
    max-width: 128px;
    height: 30px;
    padding: 0 26px 0 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")
        right 6px center / 14px no-repeat,
      var(--bg);
    text-overflow: ellipsis;
    cursor: pointer;
    appearance: none;
  }

  .language:hover {
    background-color: var(--soft);
  }

  .language option {
    background: var(--bg);
    color: var(--fg);
  }

  .icon-button {
    display: grid;
    flex: none;
    place-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    cursor: pointer;
  }

  .icon-button:hover {
    background: var(--soft);
  }

  .icon-button svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }

  h2 {
    margin: 0 0 2px;
    font-size: 12px;
    font-weight: 500;
    color: var(--muted);
  }

  .color-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-bottom: 4px;
  }

  .corners {
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin-top: 6px;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 6px;
  }

  .corners button {
    padding: 6px;
    border: 0;
    background: var(--bg);
    cursor: pointer;
  }

  .corners button:nth-child(odd) {
    border-right: 1px solid var(--border);
  }

  .corners button:nth-child(-n + 2) {
    border-bottom: 1px solid var(--border);
  }

  .corners button:hover {
    background: var(--soft);
  }

  .corners button.active {
    background: var(--primary);
    color: var(--primary-fg);
  }

  .hint {
    margin: 4px 0 0;
    color: var(--muted);
    font-size: 12px;
  }

  footer {
    padding: 12px 16px;
  }

  .outline {
    width: 100%;
    padding: 7px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    font-weight: 500;
    cursor: pointer;
  }

  .outline:hover {
    background: var(--soft);
  }
</style>
