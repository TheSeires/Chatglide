import type { ChannelRuleMode } from './settings-schema';

/** What the popup needs to show the "This video" card. */
export interface VisibilityState {
  /** Null when the tab isn't on a YouTube video. */
  videoId: string | null;
  channel: { key: string; name: string } | null;
  /** The video has live chat or chat replay loaded. */
  hasChat: boolean;
  /** The overlay is currently shown for this video. */
  enabled: boolean;
  rule: ChannelRuleMode | null;
}

/** Messages from the popup or background to the watch page's content script. */
export type VisibilityRequest =
  | { type: 'chatglide:get-state' }
  | { type: 'chatglide:set-video'; on: boolean }
  | { type: 'chatglide:toggle-video' };

const TYPES = new Set(['chatglide:get-state', 'chatglide:set-video', 'chatglide:toggle-video']);

export function isVisibilityRequest(message: unknown): message is VisibilityRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    TYPES.has((message as { type?: unknown }).type as string)
  );
}
