import { settings } from '@/utils/settings.svelte';
import type { VisibilityState } from '@/utils/visibility';
import { chat } from './chat.svelte';

/** The video and channel the tab is on, read from YouTube's watch page. */
export const page = $state({
  videoId: null as string | null,
  channel: null as { key: string; name: string } | null,
});

// "On/off for this video" is a temporary override: it is dropped as soon as the video changes.
let override = $state<{ videoId: string; on: boolean } | null>(null);

/** Precedence: this-video override, then the channel rule, then the global default. */
export function overlayEnabled(): boolean {
  if (override && override.videoId === page.videoId) return override.on;
  const rule = page.channel ? settings.channelRules[page.channel.key] : undefined;
  if (rule) return rule.mode === 'always';
  return settings.visibilityDefault === 'auto';
}

export function setVideoOverride(on: boolean) {
  if (page.videoId) override = { videoId: page.videoId, on };
}

export function toggleVideo() {
  setVideoOverride(!overlayEnabled());
}

export function visibilityState(): VisibilityState {
  return {
    videoId: page.videoId,
    channel: page.channel,
    hasChat: chat.active,
    enabled: chat.active && overlayEnabled(),
    rule: (page.channel && settings.channelRules[page.channel.key]?.mode) ?? null,
  };
}

const CHANNEL_HREF = /^\/(?:(@[^/?#]+)|channel\/(UC[\w-]+))/;

function readPage() {
  const onWatch = location.pathname === '/watch' || location.pathname.startsWith('/live/');
  const videoId = onWatch
    ? (document.querySelector('ytd-watch-flexy')?.getAttribute('video-id') ??
      new URLSearchParams(location.search).get('v'))
    : null;
  if (videoId !== page.videoId) {
    page.videoId = videoId;
    override = null;
  }

  const owner = document.querySelector('ytd-watch-metadata ytd-video-owner-renderer a[href]');
  const match = CHANNEL_HREF.exec(owner?.getAttribute('href') ?? '');
  const key = match ? decodeURIComponent(match[1] ?? match[2]!) : null;
  const name =
    document.querySelector('ytd-watch-metadata ytd-channel-name a')?.textContent?.trim() || key;
  if (key !== page.channel?.key || name !== page.channel?.name) {
    page.channel = videoId && key ? { key, name: name! } : null;
  }
}

/** Syncs `page` with YouTube navigation; polling also catches the channel name, which fills in late. */
export function watchPage(): () => void {
  readPage();
  const timer = setInterval(readPage, 500);
  document.addEventListener('yt-navigate-finish', readPage);
  return () => {
    clearInterval(timer);
    document.removeEventListener('yt-navigate-finish', readPage);
  };
}
