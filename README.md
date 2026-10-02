# Chatglide

<img src="assets/brand/icon.svg" alt="" width="96" align="right" />

Read YouTube live chat on top of the video instead of beside it. Chatglide is a browser extension that shows a customizable, read-only chat overlay on YouTube live streams and replays, so chat no longer takes space from the video.

Built with [WXT](https://wxt.dev) + Svelte 5 + TypeScript, Manifest V3. Targets Chromium browsers (Chrome, Edge, Brave).

## Develop

```sh
bun install
bun run dev        # opens Chrome with the extension loaded and hot reload
bun run dev:edge   # same, in Edge
```

## Build

```sh
bun run build       # .output/chrome-mv3 (also works in Brave)
bun run build:edge  # .output/edge-mv3
bun run zip         # store-ready zip in .output/
bun run check       # svelte-check + TypeScript
```

To load a build by hand: open `chrome://extensions`, enable Developer mode, click "Load unpacked" and pick `.output/chrome-mv3`.

## Layout

- `entrypoints/youtube-chat.content.ts` — runs inside YouTube's live chat iframe (live and replay), reads each new message from the DOM and posts it to the watch page.
- `entrypoints/youtube.content/` — content script that mounts the Svelte overlay in a Shadow DOM root inside `#movie_player`, so it stays visible in fullscreen and YouTube CSS can't leak in. `autoMount()` re-mounts it when YouTube swaps the player during in-app navigation. While a chat is active it moves YouTube's own chat panel off-screen (it keeps loading messages) so the video gets the full width.
- `utils/chat.ts` — message types shared by both content scripts.
- `entrypoints/youtube.content/visibility.svelte.ts` — whether the overlay shows on the current video: a temporary per-video on/off, then per-channel rules (keyed by `@handle` or channel ID), then the global default. Driven by the player-controls button (`PlayerButton.svelte`), the overlay header, the popup and the `Alt+C` command (forwarded by `entrypoints/background.ts`).
- `utils/locales.ts`, `utils/i18n.ts` — UI translations (en, uk, es, pt-BR, de, fr, it, ja, ko, zh-CN) and `t()`. The language defaults to the first supported browser language, else English. `public/_locales/` translates the extension's name and description.
- `utils/settings-schema.ts` — every setting with its default and valid range, plus versioned migrations. Stored settings and imported files both go through `normalizeSettings()`, so data from older or newer versions loads safely: new settings get defaults, unknown or invalid values are skipped.
- `utils/settings.svelte.ts` — settings stored in `browser.storage.local`, shared by the popup and the overlay (which also saves its dragged position and size there), and settings export/import.
- `entrypoints/popup/` — toolbar popup with the overlay settings (all-messages mode, time in 12- or 24-hour format, scrolling or disappearing messages, entry animations, header auto-hide, overlay/message backgrounds, font size, text shadow, paddings, size, position, YouTube's own chat panel). The overlay header also switches between Top chat and all messages. The popup follows the system light/dark theme (or a forced one) and uses its own controls in `entrypoints/popup/ui/`.
- `public/icon/` — extension icons, rendered from `assets/brand/icon.svg` (48 px and up) and `assets/brand/icon-small.svg` (16 and 32 px, simplified to stay legible).
- `store/` — Chrome Web Store listing: [`LISTING.md`](store/LISTING.md) (descriptions, privacy answers, upload steps) and `images/` (screenshots, promo tiles, store icon).

## Publishing

Bump `version` in `package.json`, run `bun run zip`, and upload `.output/chatglide-<version>-chrome.zip` with the text and images from [`store/LISTING.md`](store/LISTING.md). Privacy policy: [PRIVACY.md](PRIVACY.md).

## License

See [LICENSE](LICENSE).
