export const CHAT_EVENT_SOURCE = 'chat-overlay';

export type ChatRun = { text: string } | { emoji: string; alt: string };

export interface ChatMessage {
  id: string;
  /** As YouTube shows it: wall-clock time for live chat, video offset for replays. */
  time: string;
  author: string;
  /** YouTube's author-type attribute: '', 'owner', 'moderator' or 'member'. */
  authorType: string;
  runs: ChatRun[];
}

/** YouTube's "Top chat" vs "Live chat" (all messages). */
export type ChatMode = 'top' | 'all';

/** Sent from the chat iframe to the watch page via postMessage. */
export type ChatEvent =
  | { source: typeof CHAT_EVENT_SOURCE; type: 'reset' }
  | { source: typeof CHAT_EVENT_SOURCE; type: 'update'; added: ChatMessage[]; removed: string[] }
  | { source: typeof CHAT_EVENT_SOURCE; type: 'mode'; mode: ChatMode };

/** Sent from the watch page to the chat iframe. */
export type ChatCommand = { source: typeof CHAT_EVENT_SOURCE; type: 'set-mode'; mode: ChatMode };

function isChatMode(value: unknown): value is ChatMode {
  return value === 'top' || value === 'all';
}

export function isChatEvent(data: unknown): data is ChatEvent {
  if (typeof data !== 'object' || data === null) return false;
  const event = data as Record<string, unknown>;
  if (event.source !== CHAT_EVENT_SOURCE) return false;
  return (
    event.type === 'reset' ||
    (event.type === 'update' && Array.isArray(event.added) && Array.isArray(event.removed)) ||
    (event.type === 'mode' && isChatMode(event.mode))
  );
}

export function isChatCommand(data: unknown): data is ChatCommand {
  if (typeof data !== 'object' || data === null) return false;
  const command = data as Record<string, unknown>;
  return command.source === CHAT_EVENT_SOURCE && command.type === 'set-mode' && isChatMode(command.mode);
}
