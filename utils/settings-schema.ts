import { LOCALES, type Locale } from './locales';

export const POPUP_THEMES = ['system', 'light', 'dark'] as const;
export type PopupTheme = (typeof POPUP_THEMES)[number];

/** 'list' keeps a scrolling history; 'fade' shows each new message for a while, then hides it. */
export const DISPLAY_MODES = ['list', 'fade'] as const;
export type DisplayMode = (typeof DISPLAY_MODES)[number];

export const ENTER_ANIMATIONS = ['none', 'fade', 'slide', 'glide', 'pop'] as const;
export type EnterAnimation = (typeof ENTER_ANIMATIONS)[number];

/** 'auto' shows the overlay on every video with chat; 'manual' only when turned on. */
export const VISIBILITY_DEFAULTS = ['auto', 'manual'] as const;
export type VisibilityDefault = (typeof VISIBILITY_DEFAULTS)[number];

export const CHANNEL_RULE_MODES = ['always', 'never'] as const;
export type ChannelRuleMode = (typeof CHANNEL_RULE_MODES)[number];

export interface ChannelRule {
  mode: ChannelRuleMode;
  /** Display name when the rule was set; the key is the channel's handle or ID. */
  name: string;
}

export interface OverlaySettings {
  /** UI language; 'auto' follows the browser's languages. */
  language: 'auto' | Locale;
  /** Color theme of the settings popup (not the overlay). */
  popupTheme: PopupTheme;

  visibilityDefault: VisibilityDefault;
  /** Show a Chatglide on/off button in YouTube's player controls. */
  playerButton: boolean;
  /** Per-channel overrides of `visibilityDefault`, keyed by "@handle" or "UC…" channel ID. */
  channelRules: Record<string, ChannelRule>;

  /** Keep YouTube's own chat panel visible instead of hiding it. */
  showNativeChat: boolean;
  /** Switch YouTube's chat from "Top chat" to "Live chat" (all messages) when it loads. */
  forceAllMessages: boolean;
  showTime: boolean;
  /** Show live chat times as 24-hour ("19:41") instead of YouTube's 12-hour style. */
  time24h: boolean;
  fontSize: number;

  displayMode: DisplayMode;
  /** Seconds a message stays visible in 'fade' mode. */
  messageLifetime: number;
  /** In 'fade' mode, the newest this-many messages never disappear. */
  keepLast: number;
  enterAnimation: EnterAnimation;

  /** Hide the header after `autoHideDelay` seconds without the pointer over the overlay. */
  autoHideHeader: boolean;
  autoHideDelay: number;

  textShadow: boolean;
  textShadowColor: string;
  /** Percent. */
  textShadowOpacity: number;
  /** px. */
  textShadowBlur: number;
  textShadowOffset: number;

  overlayBackground: boolean;
  overlayColor: string;
  /** Percent. */
  overlayOpacity: number;
  messageBackground: boolean;
  messageColor: string;
  /** Percent. */
  messageOpacity: number;
  /** px of backdrop blur behind the overlay and message backgrounds. */
  backgroundBlur: number;

  /** Paddings and gap in px. */
  headerPadding: number;
  listPadding: number;
  messagePadding: number;
  messageGap: number;

  width: number;
  height: number;
  /** Position within the player's free space, 0–1 per axis (x 1, y 0 = top right). */
  x: number;
  y: number;
}

export const DEFAULT_SETTINGS: OverlaySettings = {
  language: 'auto',
  popupTheme: 'system',
  visibilityDefault: 'auto',
  playerButton: true,
  channelRules: {},
  showNativeChat: false,
  forceAllMessages: true,
  showTime: false,
  time24h: false,
  fontSize: 14,

  displayMode: 'list',
  messageLifetime: 10,
  keepLast: 3,
  enterAnimation: 'none',

  autoHideHeader: false,
  autoHideDelay: 3,

  textShadow: true,
  textShadowColor: '#000000',
  textShadowOpacity: 90,
  textShadowBlur: 2,
  textShadowOffset: 1,

  overlayBackground: true,
  overlayColor: '#000000',
  overlayOpacity: 55,
  messageBackground: false,
  messageColor: '#000000',
  messageOpacity: 55,
  backgroundBlur: 4,

  headerPadding: 8,
  listPadding: 8,
  messagePadding: 2,
  messageGap: 4,

  width: 340,
  height: 360,
  x: 1,
  y: 0,
};

// --- Schema: what a valid value looks like for every setting -----------------

type FieldSpec =
  | { type: 'boolean' }
  | { type: 'number'; min: number; max: number }
  | { type: 'color' }
  | { type: 'enum'; values: readonly string[] }
  | { type: 'channelRules' };

const bool = { type: 'boolean' } as const;
const color = { type: 'color' } as const;
const num = (min: number, max: number) => ({ type: 'number', min, max }) as const;
const oneOf = (values: readonly string[]) => ({ type: 'enum', values }) as const;

// Bounds are what the overlay can handle, not the popup slider ranges (dragging can exceed those).
const SCHEMA: Record<keyof OverlaySettings, FieldSpec> = {
  language: oneOf(['auto', ...LOCALES]),
  popupTheme: oneOf(POPUP_THEMES),
  visibilityDefault: oneOf(VISIBILITY_DEFAULTS),
  playerButton: bool,
  channelRules: { type: 'channelRules' },
  showNativeChat: bool,
  forceAllMessages: bool,
  showTime: bool,
  time24h: bool,
  fontSize: num(8, 48),
  displayMode: oneOf(DISPLAY_MODES),
  messageLifetime: num(1, 600),
  keepLast: num(0, 100),
  enterAnimation: oneOf(ENTER_ANIMATIONS),
  autoHideHeader: bool,
  autoHideDelay: num(1, 120),
  textShadow: bool,
  textShadowColor: color,
  textShadowOpacity: num(0, 100),
  textShadowBlur: num(0, 40),
  textShadowOffset: num(0, 20),
  overlayBackground: bool,
  overlayColor: color,
  overlayOpacity: num(0, 100),
  messageBackground: bool,
  messageColor: color,
  messageOpacity: num(0, 100),
  backgroundBlur: num(0, 40),
  headerPadding: num(0, 64),
  listPadding: num(0, 64),
  messagePadding: num(0, 64),
  messageGap: num(0, 64),
  width: num(100, 8000),
  height: num(60, 8000),
  x: num(0, 1),
  y: num(0, 1),
};

function isValid(spec: FieldSpec, value: unknown): boolean {
  switch (spec.type) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'color':
      return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
    case 'enum':
      return typeof value === 'string' && spec.values.includes(value);
    case 'channelRules':
      return isRecord(value);
  }
}

const MAX_CHANNEL_RULES = 1000;

/** Keeps only well-formed rules; a broken entry doesn't invalidate the others. */
function sanitizeChannelRules(value: RawSettings): Record<string, ChannelRule> {
  const rules: Record<string, ChannelRule> = {};
  for (const [key, rule] of Object.entries(value).slice(0, MAX_CHANNEL_RULES)) {
    if (!/^(@[^\s/?#]{1,100}|UC[\w-]{10,40})$/.test(key) || !isRecord(rule)) continue;
    if (!CHANNEL_RULE_MODES.includes(rule.mode as ChannelRuleMode)) continue;
    const name = typeof rule.name === 'string' && rule.name.trim() ? rule.name.slice(0, 200) : key;
    rules[key] = { mode: rule.mode as ChannelRuleMode, name };
  }
  return rules;
}

// Bump SCHEMA_VERSION and add a migration only when a setting is renamed, removed or changes meaning.

export const SCHEMA_VERSION = 2;

export type RawSettings = Record<string, unknown>;

/** MIGRATIONS[n] upgrades data from version n - 1 to n. */
const MIGRATIONS: Record<number, (data: RawSettings) => void> = {
  2: (data) => {
    // 1.0 development builds had a single background "opacity".
    if (data.overlayOpacity === undefined) data.overlayOpacity = data.opacity;
    delete data.opacity;
  },
};

export function isRecord(value: unknown): value is RawSettings {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface NormalizeResult {
  settings: Partial<OverlaySettings>;
  /** Keys that were present but unknown to this version or had invalid values. */
  skipped: string[];
}

/** Makes settings from any version valid for this one: migrates, drops unknown or invalid keys, clamps numbers. */
export function normalizeSettings(raw: unknown): NormalizeResult {
  if (!isRecord(raw)) return { settings: {}, skipped: [] };
  const data: RawSettings = { ...raw };
  const from = typeof data.schema === 'number' ? data.schema : 1;
  delete data.schema;
  for (let version = from + 1; version <= SCHEMA_VERSION; version++) MIGRATIONS[version]?.(data);

  const settings: RawSettings = {};
  const skipped: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    const spec = Object.hasOwn(SCHEMA, key) ? SCHEMA[key as keyof OverlaySettings] : undefined;
    if (!spec || !isValid(spec, value)) {
      if (value !== undefined) skipped.push(key);
      continue;
    }
    if (spec.type === 'number') {
      settings[key] = Math.min(spec.max, Math.max(spec.min, value as number));
    } else if (spec.type === 'channelRules') {
      settings[key] = sanitizeChannelRules(value as RawSettings);
    } else {
      settings[key] = value;
    }
  }
  return { settings: settings as Partial<OverlaySettings>, skipped };
}
