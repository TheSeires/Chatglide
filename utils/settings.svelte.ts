import { storage } from '#imports';

import type { Locale } from './locales';

export type PopupTheme = 'system' | 'light' | 'dark';

export interface OverlaySettings {
  /** UI language; 'auto' follows the browser's languages. */
  language: 'auto' | Locale;
  /** Color theme of the settings popup (not the overlay). */
  popupTheme: PopupTheme;

  /** Keep YouTube's own chat panel visible instead of hiding it. */
  showNativeChat: boolean;
  /** Switch YouTube's chat from "Top chat" to "Live chat" (all messages) when it loads. */
  forceAllMessages: boolean;
  showTime: boolean;
  /** Show live chat times as 24-hour ("19:41") instead of YouTube's 12-hour style. */
  time24h: boolean;
  fontSize: number;

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
  showNativeChat: false,
  forceAllMessages: true,
  showTime: false,
  time24h: false,
  fontSize: 14,

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

  headerPadding: 8,
  listPadding: 8,
  messagePadding: 2,
  messageGap: 4,

  width: 340,
  height: 360,
  x: 1,
  y: 0,
};

// Partial so settings added in later versions fall back to their defaults.
const settingsItem = storage.defineItem<Partial<OverlaySettings>>('local:settings', {
  fallback: {},
});

export const settings = $state<OverlaySettings>({ ...DEFAULT_SETTINGS });

/** Loads stored settings and keeps `settings` in sync with changes from other pages. */
export async function loadSettings(): Promise<() => void> {
  Object.assign(settings, DEFAULT_SETTINGS, await settingsItem.getValue());
  return settingsItem.watch((value) => Object.assign(settings, DEFAULT_SETTINGS, value));
}

export function saveSettings(patch: Partial<OverlaySettings> = {}) {
  Object.assign(settings, patch);
  return settingsItem.setValue($state.snapshot(settings));
}

/** '#rrggbb' + opacity percent -> CSS color. */
export function withOpacity(hex: string, opacity: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${opacity / 100})`;
}
