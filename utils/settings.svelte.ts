import { storage } from '#imports';

import {
  DEFAULT_SETTINGS,
  isRecord,
  normalizeSettings,
  SCHEMA_VERSION,
  type ChannelRuleMode,
  type OverlaySettings,
  type RawSettings,
} from './settings-schema';

export * from './settings-schema';

// --- Storage -----------------------------------------------------------------

const settingsItem = storage.defineItem<RawSettings>('local:settings', { fallback: {} });

export const settings = $state<OverlaySettings>({ ...DEFAULT_SETTINGS });

function apply(raw: unknown) {
  Object.assign(settings, DEFAULT_SETTINGS, normalizeSettings(raw).settings);
}

/** Loads stored settings and keeps `settings` in sync with changes from other pages. */
export async function loadSettings(): Promise<() => void> {
  apply(await settingsItem.getValue());
  return settingsItem.watch(apply);
}

export function saveSettings(patch: Partial<OverlaySettings> = {}) {
  Object.assign(settings, patch);
  return settingsItem.setValue({ ...$state.snapshot(settings), schema: SCHEMA_VERSION });
}

/** Sets or (with `mode` null) removes the rule for a channel. */
export function setChannelRule(key: string, name: string, mode: ChannelRuleMode | null) {
  const rules = { ...$state.snapshot(settings.channelRules) };
  if (mode) rules[key] = { mode, name };
  else delete rules[key];
  return saveSettings({ channelRules: rules });
}

// --- Import / export ---------------------------------------------------------

const EXPORT_APP = 'chatglide';

export function exportSettings(appVersion: string): string {
  const file = {
    app: EXPORT_APP,
    schema: SCHEMA_VERSION,
    appVersion,
    exportedAt: new Date().toISOString(),
    settings: $state.snapshot(settings),
  };
  return JSON.stringify(file, null, 2);
}

export type ImportResult =
  | { ok: true; applied: number; skipped: string[] }
  | { ok: false };

/**
 * Applies an exported settings file. Settings missing from the file are reset to defaults,
 * except channel rules: files from before they existed shouldn't wipe the current ones.
 */
export async function importSettings(text: string): Promise<ImportResult> {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return { ok: false };
  }
  if (!isRecord(file) || file.app !== EXPORT_APP || !isRecord(file.settings)) return { ok: false };

  const schema = typeof file.schema === 'number' ? file.schema : 1;
  const { settings: imported, skipped } = normalizeSettings({ ...file.settings, schema });
  Object.assign(settings, DEFAULT_SETTINGS, { channelRules: settings.channelRules });
  await saveSettings(imported);
  return { ok: true, applied: Object.keys(imported).length, skipped };
}

/** '#rrggbb' + opacity percent -> CSS color. */
export function withOpacity(hex: string, opacity: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${opacity / 100})`;
}
