// Drives YouTube's own chat box inside the chat iframe: the overlay's input types into it and
// presses its Send button, so messages go through YouTube exactly as if typed there.
import {
  isAvatarUrl,
  isEmojiImageUrl,
  type ChatParticipant,
  type EmojiCategory,
  type EmojiItem,
  type InputState,
} from '@/utils/chat';

const INPUT = [
  'yt-live-chat-text-input-field-renderer #input[contenteditable]',
  '#input-panel #input[contenteditable]',
].join(',');
// Tried in order: the real <button> first, then YouTube's wrapper elements around it.
const SEND_BUTTON = ['#send-button button', '#send-button yt-icon-button', '#send-button #button'];
const EMOJI_BUTTON = [
  '#emoji-picker-button button',
  'yt-live-chat-icon-toggle-button-renderer#emoji button',
  '#emoji-picker-button yt-icon-button',
  '#emoji-picker-button #button',
];
const EMOJI_PICKER = 'yt-emoji-picker-renderer';
const INPUT_PANEL = '#input-panel';
// YouTube's limit for a chat message.
const MAX_LENGTH = 200;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor<T>(find: () => T | null | undefined, timeoutMs: number): Promise<T | null> {
  for (let waited = 0; waited < timeoutMs; waited += 100) {
    const found = find();
    if (found) return found;
    await sleep(100);
  }
  return find() ?? null;
}

function findInput() {
  return document.querySelector<HTMLElement>(INPUT);
}

function queryFirst(selectors: string[]) {
  for (const selector of selectors) {
    const found = document.querySelector<HTMLElement>(selector);
    if (found) return found;
  }
  return null;
}

export function readInputState(): InputState {
  // Replays have no chat box and nothing worth explaining.
  if (location.pathname.startsWith('/live_chat_replay')) {
    return { available: false, reason: '', maxLength: MAX_LENGTH };
  }
  if (findInput()) return { available: true, reason: '', maxLength: MAX_LENGTH };
  // Signed out, members-only, subscribers-only…: YouTube explains why in the panel; its last line is the gist.
  const panel = document.querySelector<HTMLElement>(INPUT_PANEL);
  const lines = (panel?.innerText ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
  return { available: false, reason: lines.at(-1) ?? '', maxLength: MAX_LENGTH };
}

/** Types `text` into YouTube's chat box and sends it. Resolves true once YouTube accepted it. */
export async function sendText(text: string): Promise<boolean> {
  const input = findInput();
  const message = text.trim().slice(0, MAX_LENGTH);
  if (!input || !message) return false;

  // execCommand fires the same input events as real typing, so YouTube's own state updates too.
  input.focus();
  document.execCommand('selectAll');
  document.execCommand('delete');
  document.execCommand('insertText', false, message);
  if (!input.textContent?.trim()) return false;

  const button = await waitFor(
    () => {
      const found = queryFirst(SEND_BUTTON);
      return found && !found.hasAttribute('disabled') ? found : null;
    },
    1500,
  );
  if (!button) return false;
  button.click();

  // YouTube empties the box once the message is accepted.
  return Boolean(await waitFor(() => !input.textContent?.trim(), 3000));
}

const EMOJI_CHARACTER = /\p{Extended_Pictographic}/u;
// Categories in YouTube's order: channel (sponsor) emojis, YouTube's own, then the Unicode groups.
// Sponsor emojis of a channel the user hasn't joined live in an "upsell" category.
const CATEGORY = 'yt-emoji-picker-category-renderer';
const UPSELL_CATEGORY = 'yt-emoji-picker-upsell-category-renderer';
const MAX_EMOJIS = 5000;

const pickerImageCount = () => document.querySelectorAll(`${EMOJI_PICKER} img`).length;

/** Reads every emoji in YouTube's picker, grouped like YouTube groups them. */
export async function readEmojis(): Promise<EmojiCategory[]> {
  // YouTube only builds the picker the first time it's opened, so open and close it once.
  if (!pickerImageCount()) {
    const button = queryFirst(EMOJI_BUTTON);
    if (!button) return [];
    const hadFocus = document.hasFocus();
    button.click();
    await waitFor(() => pickerImageCount(), 3000);
    button.click();
    // Opening the picker can focus its search field; don't keep focus in this hidden frame.
    if (!hadFocus) (document.activeElement as HTMLElement | null)?.blur();
  }
  // Categories fill in over a few frames; wait until the count stops growing.
  for (let last = -1, waited = 0; pickerImageCount() !== last && waited < 3000; waited += 200) {
    last = pickerImageCount();
    await sleep(200);
  }

  const categories: EmojiCategory[] = [];
  const seen = new Set<string>();
  let total = 0;
  for (const category of document.querySelectorAll(`${EMOJI_PICKER} :is(${CATEGORY}, ${UPSELL_CATEGORY})`)) {
    const locked = category.tagName.toLowerCase() === UPSELL_CATEGORY;
    const emojis: EmojiItem[] = [];
    let lockedHint = '';
    for (const img of category.querySelectorAll<HTMLImageElement>('img')) {
      const emoji = readEmoji(img);
      if (!emoji || seen.has(emoji.text) || total >= MAX_EMOJIS) continue;
      seen.add(emoji.text);
      total++;
      emojis.push(emoji);
      if (locked && !lockedHint) lockedHint = img.getAttribute('shared-tooltip-text') ?? '';
    }
    if (emojis.length) categories.push({ title: categoryTitle(category), locked, lockedHint, emojis });
  }
  if (categories.length) return categories;

  // If YouTube ever renames its category elements, still offer every emoji, just ungrouped.
  const emojis = [...document.querySelectorAll<HTMLImageElement>(`${EMOJI_PICKER} img`)]
    .map(readEmoji)
    .filter((emoji) => emoji && !seen.has(emoji.text) && seen.add(emoji.text))
    .slice(0, MAX_EMOJIS) as EmojiItem[];
  return emojis.length ? [{ title: '', locked: false, lockedHint: '', emojis }] : [];
}

function readEmoji(img: HTMLImageElement): EmojiItem | null {
  const alt = img.alt ?? '';
  // The ":shortcut:" is in aria-label; on sponsor emojis the tooltip holds YouTube's upsell text instead.
  const shortcut = [img.getAttribute('aria-label'), img.getAttribute('shared-tooltip-text'), alt].find(
    (value) => value?.startsWith(':'),
  );
  // Standard emojis are inserted as the character itself, YouTube/channel emojis as their ":shortcut:".
  const text = EMOJI_CHARACTER.test(alt) && !alt.startsWith(':') ? alt : shortcut;
  if (!text) return null;
  const label = shortcut ?? alt;
  return {
    text,
    image: isEmojiImageUrl(img.src) ? img.src : '',
    label,
    search: `${label} ${alt}`.toLowerCase().replace(/[:_-]+/g, ' ').trim(),
  };
}

const PARTICIPANT = 'yt-live-chat-participant-renderer';
const MAX_PARTICIPANTS = 2000;

/** True if a DOM change touched YouTube's participant list. */
export function isParticipantNode(node: Node): boolean {
  return node instanceof Element && (node.tagName.toLowerCase() === PARTICIPANT || !!node.querySelector?.(PARTICIPANT));
}

// YouTube keeps its "Participants" list up to date in the page even while that panel is closed;
// it's also what YouTube's own @-suggestions draw from.
export function readParticipants(): ChatParticipant[] {
  const participants: ChatParticipant[] = [];
  const seen = new Set<string>();
  for (const el of document.querySelectorAll(PARTICIPANT)) {
    const name = el.querySelector('#author-name')?.textContent?.trim() ?? '';
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const src = el.querySelector<HTMLImageElement>('img#img, #author-photo img')?.src ?? '';
    participants.push({ name, avatar: isAvatarUrl(src) ? src : '' });
    if (participants.length >= MAX_PARTICIPANTS) break;
  }
  return participants;
}

function categoryTitle(category: Element): string {
  const title = category.querySelector('#title') ?? category.querySelector('yt-formatted-string');
  return title?.textContent?.trim() ?? '';
}
