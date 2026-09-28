import { LOCALES, MESSAGES, type Locale, type MessageKey } from './locales';
import { settings } from './settings.svelte';

/** First browser language we have a translation for, else English. */
export function browserLocale(): Locale {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const locale = matchLocale(tag.toLowerCase());
    if (locale) return locale;
  }
  return 'en';
}

function matchLocale(tag: string): Locale | null {
  const base = tag.split('-')[0];
  // Only Simplified Chinese is translated; zh-TW/zh-HK readers fall through to their next language.
  if (base === 'zh') return tag === 'zh' || /^zh-(hans|cn|sg)\b/.test(tag) ? 'zh' : null;
  return (LOCALES as readonly string[]).includes(base!) ? (base as Locale) : null;
}

export function currentLocale(): Locale {
  const chosen = settings.language;
  return (LOCALES as readonly string[]).includes(chosen) ? (chosen as Locale) : browserLocale();
}

/** Translates `key`, filling `{name}` placeholders from `params`. Reactive in Svelte templates. */
export function t(key: MessageKey, params: Record<string, string> = {}): string {
  const message = MESSAGES[currentLocale()][key];
  return message.replace(/\{(\w+)\}/g, (_, name: string) => params[name] ?? '');
}
