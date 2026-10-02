<script lang="ts">
  import { browserLocale, currentLocale, t } from '@/utils/i18n';
  import { LANGUAGE_NAMES, LOCALES, type Locale, type MessageKey } from '@/utils/locales';
  import {
    DEFAULT_SETTINGS,
    exportSettings,
    importSettings,
    loadSettings,
    saveSettings,
    setChannelRule,
    settings,
    type ChannelRuleMode,
    type DisplayMode,
    type EnterAnimation,
    type OverlaySettings,
    type PopupTheme,
    type VisibilityDefault,
  } from '@/utils/settings.svelte';
  import type { VisibilityRequest, VisibilityState } from '@/utils/visibility';
  import ColorSwatch from './ui/ColorSwatch.svelte';
  import Segmented from './ui/Segmented.svelte';
  import Select from './ui/Select.svelte';
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

  const DISPLAY_MODES: { value: DisplayMode; label: MessageKey }[] = [
    { value: 'list', label: 'displayList' },
    { value: 'fade', label: 'displayFade' },
  ];

  const ANIMATIONS: { value: EnterAnimation; label: MessageKey }[] = [
    { value: 'none', label: 'animNone' },
    { value: 'fade', label: 'animFade' },
    { value: 'slide', label: 'animSlide' },
    { value: 'glide', label: 'animGlide' },
    { value: 'pop', label: 'animPop' },
  ];

  // --- "This video" card: talks to the content script in the active YouTube tab ---

  let tabId: number | undefined;
  let tabState = $state<VisibilityState | null>(null);
  let shortcut = $state('');

  async function ask(request: VisibilityRequest) {
    if (tabId === undefined) return;
    try {
      tabState = await browser.tabs.sendMessage(tabId, request, { frameId: 0 });
    } catch {
      tabState = null; // Not a YouTube tab, or the page loaded before the extension.
    }
  }

  $effect(() => {
    browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      tabId = tab?.id;
      ask({ type: 'chatglide:get-state' });
    });
    browser.commands.getAll().then((commands) => {
      shortcut = commands.find((c) => c.name === 'toggle-overlay')?.shortcut ?? '';
    });
  });

  const RULE_OPTIONS: { value: ChannelRuleMode | 'default'; label: MessageKey }[] = [
    { value: 'default', label: 'ruleDefault' },
    { value: 'always', label: 'ruleAlways' },
    { value: 'never', label: 'ruleNever' },
  ];

  const VISIBILITY_OPTIONS: { value: VisibilityDefault; label: MessageKey }[] = [
    { value: 'auto', label: 'visibilityAuto' },
    { value: 'manual', label: 'visibilityManual' },
  ];

  async function changeChannelRule(key: string, name: string, mode: ChannelRuleMode | null) {
    await setChannelRule(key, name, mode);
    // Give the tab a moment to receive the storage change before asking for its new state.
    setTimeout(() => ask({ type: 'chatglide:get-state' }), 150);
  }

  function openShortcutSettings() {
    browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
  }

  let fileInput: HTMLInputElement | undefined = $state();
  let backupStatus = $state<{ text: string; error: boolean } | null>(null);

  function downloadSettings() {
    const json = exportSettings(browser.runtime.getManifest().version);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `chatglide-settings-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    backupStatus = null;
  }

  async function uploadSettings(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const result = await importSettings(await file.text());
    if (!result.ok) {
      backupStatus = { text: t('importFailed'), error: true };
      return;
    }
    const applied = t('importDone', { count: String(result.applied) });
    const skipped = result.skipped.length
      ? ' ' + t('importSkipped', { count: String(result.skipped.length) })
      : '';
    backupStatus = { text: applied + skipped, error: false };
  }
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
      <h2>{t('sectionThisVideo')}</h2>
      {#if tabState?.videoId}
        {#if tabState.channel}
          <p class="channel">{tabState.channel.name}</p>
        {/if}
        {#if tabState.hasChat}
          <Switch
            label={t('showOnThisVideo')}
            checked={tabState.enabled}
            onchange={(on) => ask({ type: 'chatglide:set-video', on })}
          />
        {:else}
          <p class="hint">{t('noChatHere')}</p>
        {/if}
        {#if tabState.channel}
          {@const channel = tabState.channel}
          <span class="field-label">{t('onThisChannel')}</span>
          <Segmented
            label={t('onThisChannel')}
            value={tabState.rule ?? 'default'}
            options={RULE_OPTIONS.map((option) => ({ value: option.value, label: t(option.label) }))}
            onchange={(mode) => changeChannelRule(channel.key, channel.name, mode === 'default' ? null : mode)}
          />
        {/if}
      {:else}
        <p class="hint">{t('noVideo')}</p>
      {/if}
    </section>

    <section>
      <h2>{t('sectionVisibility')}</h2>
      <Select
        label={t('visibilityDefault')}
        value={settings.visibilityDefault}
        options={VISIBILITY_OPTIONS.map((option) => ({ value: option.value, label: t(option.label) }))}
        onchange={(visibilityDefault) => {
          saveSettings({ visibilityDefault });
          setTimeout(() => ask({ type: 'chatglide:get-state' }), 150);
        }}
      />
      {@render toggle('playerButton', 'playerButton')}
      <div class="shortcut-row">
        <span>{t('shortcut')}</span>
        <span class="shortcut-value">
          <kbd>{shortcut || t('shortcutNotSet')}</kbd>
          <button type="button" class="link" onclick={openShortcutSettings}>
            {t('changeShortcut')}
          </button>
        </span>
      </div>
    </section>

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
      <h2>{t('sectionMessages')}</h2>
      <Segmented
        label={t('displayMode')}
        value={settings.displayMode}
        options={DISPLAY_MODES.map((mode) => ({ value: mode.value, label: t(mode.label) }))}
        onchange={(displayMode) => saveSettings({ displayMode })}
      />
      {#if settings.displayMode === 'fade'}
        {@render slider('messageLifetime', 'messageLifetime', 2, 60, 's')}
        {@render slider('keepLast', 'keepLast', 0, 20, '')}
        <p class="hint">{t('keepLastHint')}</p>
      {/if}
      <Select
        label={t('animation')}
        value={settings.enterAnimation}
        options={ANIMATIONS.map((animation) => ({ value: animation.value, label: t(animation.label) }))}
        onchange={(enterAnimation) => saveSettings({ enterAnimation })}
      />
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
      {#if settings.overlayBackground || settings.messageBackground}
        {@render slider('backgroundBlur', 'backgroundBlur', 0, 20)}
      {/if}
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

    <section>
      <h2>{t('sectionChannelRules')}</h2>
      {#each Object.entries(settings.channelRules) as [key, rule] (key)}
        <div class="rule-row">
          <span class="rule-name" title={key}>{rule.name}</span>
          <span class="rule-mode {rule.mode}">
            {t(rule.mode === 'always' ? 'ruleAlways' : 'ruleNever')}
          </span>
          <button
            type="button"
            class="remove"
            title={t('removeRule', { channel: rule.name })}
            aria-label={t('removeRule', { channel: rule.name })}
            onclick={() => changeChannelRule(key, rule.name, null)}
          >
            ✕
          </button>
        </div>
      {:else}
        <p class="hint">{t('noChannelRules')}</p>
      {/each}
    </section>

    <section>
      <h2>{t('sectionBackup')}</h2>
      <div class="backup-buttons">
        <button type="button" class="outline" onclick={downloadSettings}>{t('exportSettings')}</button>
        <button type="button" class="outline" onclick={() => fileInput?.click()}>
          {t('importSettings')}
        </button>
      </div>
      <input
        bind:this={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onchange={uploadSettings}
      />
      {#if backupStatus}
        <p class="hint" class:error={backupStatus.error} role="status">{backupStatus.text}</p>
      {/if}
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
            channelRules: $state.snapshot(settings.channelRules),
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

  .hint.error {
    color: #dc2626;
  }

  .channel {
    margin: 0;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .field-label {
    margin-top: 4px;
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 28px;
  }

  .shortcut-value {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  kbd {
    padding: 2px 6px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--soft);
    font: 12px ui-monospace, monospace;
  }

  .link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--primary);
    cursor: pointer;
  }

  .link:hover {
    text-decoration: underline;
  }

  .rule-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 28px;
  }

  .rule-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rule-mode {
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
  }

  .rule-mode.always {
    background: var(--primary);
    color: var(--primary-fg);
  }

  .rule-mode.never {
    background: var(--soft);
    color: var(--muted);
  }

  .remove {
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }

  .remove:hover {
    background: var(--soft);
    color: var(--fg);
  }

  .backup-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
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
