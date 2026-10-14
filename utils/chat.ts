export const CHAT_EVENT_SOURCE = 'chat-overlay';

export type ChatRun = { text: string } | { emoji: string; alt: string };

export interface ChatMessage {
  id: string;
  /** As YouTube shows it: wall-clock time for live chat, video offset for replays. */
  time: string;
  author: string;
  /** YouTube's author-type attribute: '', 'owner', 'moderator' or 'member'. */
  authorType: string;
  /** Author's profile picture URL, or '' if YouTube didn't provide one. */
  avatar: string;
  runs: ChatRun[];
}

// Channels without their own picture use their Google account photo from lh*.googleusercontent.com.
const AVATAR_URL = /^https:\/\/(?:yt\d\.(?:ggpht|googleusercontent)|lh\d\.googleusercontent)\.com\//;

/** Only YouTube's own image hosts are accepted, so a page script can't inject other URLs. */
export function isAvatarUrl(url: string): boolean {
  return AVATAR_URL.test(url);
}

/** YouTube's "Top chat" vs "Live chat" (all messages). */
export type ChatMode = 'top' | 'all';

/** Whether YouTube's chat box lets the user type, and if not, YouTube's own explanation. */
export interface InputState {
  available: boolean;
  /** E.g. "Sign in to chat"; empty when there's nothing to show (replays). */
  reason: string;
  maxLength: number;
}

export interface EmojiItem {
  /** Inserted into the message: the emoji character, or a ":shortcut:" for YouTube/channel emojis. */
  text: string;
  /** YouTube's image for the emoji. */
  image: string;
  /** The ":shortcut:" YouTube shows on hover. */
  label: string;
  /** Lowercase words the search matches against. */
  search: string;
}

/** Someone in YouTube's live participant list (includes viewers who haven't written yet). */
export interface ChatParticipant {
  name: string;
  avatar: string;
}

export interface EmojiCategory {
  title: string;
  /** Sponsor emojis of a channel the user isn't a member of: shown, but not usable. */
  locked: boolean;
  /** YouTube's explanation for locked emojis ("Become a member…"). */
  lockedHint: string;
  emojis: EmojiItem[];
}

const EMOJI_IMAGE_URL = /^https:\/\/(?:yt\d\.(?:ggpht|googleusercontent)\.com|fonts\.gstatic\.com)\//;

export function isEmojiImageUrl(url: string): boolean {
  return EMOJI_IMAGE_URL.test(url);
}

type Tagged<T> = T & { source: typeof CHAT_EVENT_SOURCE };

/** Sent from the chat iframe to the watch page via postMessage. */
export type ChatEvent = Tagged<
  | { type: 'reset' }
  | { type: 'update'; added: ChatMessage[]; removed: string[] }
  | { type: 'mode'; mode: ChatMode }
  | { type: 'input-state'; state: InputState }
  | { type: 'send-result'; requestId: string; ok: boolean }
  | { type: 'emojis'; categories: EmojiCategory[] }
  | { type: 'participants'; participants: ChatParticipant[] }
  | { type: 'self'; self: ChatParticipant }
>;

/** Sent from the watch page to the chat iframe. */
export type ChatCommand = Tagged<
  | { type: 'set-mode'; mode: ChatMode }
  | { type: 'send'; requestId: string; text: string }
  | { type: 'get-emojis' }
>;

function isChatMode(value: unknown): value is ChatMode {
  return value === 'top' || value === 'all';
}

function tagged(data: unknown): Record<string, unknown> | null {
  if (typeof data !== 'object' || data === null) return null;
  const message = data as Record<string, unknown>;
  return message.source === CHAT_EVENT_SOURCE ? message : null;
}

export function isChatEvent(data: unknown): data is ChatEvent {
  const event = tagged(data);
  if (!event) return false;
  switch (event.type) {
    case 'reset':
      return true;
    case 'update':
      return Array.isArray(event.added) && Array.isArray(event.removed);
    case 'mode':
      return isChatMode(event.mode);
    case 'input-state':
      return typeof event.state === 'object' && event.state !== null;
    case 'send-result':
      return typeof event.requestId === 'string' && typeof event.ok === 'boolean';
    case 'emojis':
      return Array.isArray(event.categories);
    case 'participants':
      return Array.isArray(event.participants);
    case 'self':
      return typeof event.self === 'object' && event.self !== null;
    default:
      return false;
  }
}

export function isChatCommand(data: unknown): data is ChatCommand {
  const command = tagged(data);
  if (!command) return false;
  switch (command.type) {
    case 'set-mode':
      return isChatMode(command.mode);
    case 'send':
      return typeof command.requestId === 'string' && typeof command.text === 'string';
    case 'get-emojis':
      return true;
    default:
      return false;
  }
}
