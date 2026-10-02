# Chrome Web Store listing

Everything needed to fill in the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole). Images are in [`images/`](images/).

## Package

1. `bun run zip` → upload `.output/chatglide-<version>-chrome.zip`.
2. For Microsoft Edge Add-ons: `bun run zip:edge` → `.output/chatglide-<version>-edge.zip` (same listing text and images).

The name, short name and short description in the store come from the package itself (`public/_locales/*/messages.json`), in all 10 languages.

## Store listing tab

**Category:** Entertainment
**Language:** English (the package is also translated into uk, es, pt-BR, de, fr, it, ja, ko, zh-CN)

### Detailed description (English)

```
Chatglide shows YouTube live chat on top of the video instead of beside it, so theater mode and fullscreen get their full width back. It's a read-only overlay: you read the chat, the video stays big.

• Chat right on the video: a clean overlay in the corner of the player, also in fullscreen.
• YouTube's chat panel steps aside, so the video uses the whole width.
• All messages or Top chat: switch right from the overlay header, or always open in all-messages mode.
• Replays stay in sync: seeking back or forward in a chat replay updates the overlay.
• Disappearing messages: new messages show for a few seconds, then fade away. Keep the newest few on screen, or none.
• Entry animations for new messages: fade, slide up, glide in from the side or pop.
• Make it yours: overlay or per-message backgrounds, colors, opacity and blur, font size, text shadow, paddings, message time (12- or 24-hour).
• Drag it anywhere, resize it from any edge or corner, or snap it to a corner.
• You decide where it shows: turn it on or off for a video (player button, popup or Alt+C), set Always or Never per channel, or show it only when you ask.
• Auto-hide the header so only the messages stay on screen until you hover.
• Settings popup in light and dark theme, with export and import of your settings.
• 10 languages: English, Ukrainian, Spanish, Portuguese, German, French, Italian, Japanese, Korean and Chinese. Picks your browser's language automatically.

Private by design: no accounts, no tracking, no data leaves your browser. Settings are saved on your device only.

Chatglide is not affiliated with or endorsed by YouTube or Google.
```

### Detailed description (Ukrainian)

```
Chatglide показує чат YouTube поверх відео, а не збоку, тож режим кінотеатру та повноекранний режим знову отримують усю ширину. Це оверлей лише для читання: ви читаєте чат, а відео залишається великим.

• Чат прямо на відео: акуратний оверлей у куті плеєра, зокрема в повноекранному режимі.
• Панель чату YouTube відходить убік, і відео займає всю ширину.
• Усі повідомлення або найкраще в чаті: перемикайте просто в заголовку оверлею або завжди відкривайте всі повідомлення.
• Записи трансляцій синхронізовані: перемотування вперед чи назад оновлює оверлей.
• Зникаючі повідомлення: нові повідомлення показуються кілька секунд, а потім зникають. Кілька найновіших можна залишати на екрані.
• Анімації появи нових повідомлень: поява, виїзд знизу, виїзд збоку або пружинка.
• Налаштуйте під себе: фон усього оверлею або кожного повідомлення, кольори, непрозорість і розмиття, розмір шрифту, тінь тексту, відступи, час повідомлень (12- або 24-годинний формат).
• Перетягуйте куди завгодно, змінюйте розмір за будь-який край чи кут або прикріплюйте до кута.
• Ви вирішуєте, де він з’являється: вмикайте чи вимикайте його для відео (кнопка в плеєрі, вікно налаштувань або Alt+C), задавайте «Завжди» чи «Ніколи» для каналів або показуйте лише на вимогу.
• Автоматично ховайте заголовок, щоб на екрані залишалися лише повідомлення, доки ви не наведете курсор.
• Вікно налаштувань у світлій і темній темі, з експортом та імпортом налаштувань.
• 10 мов: англійська, українська, іспанська, португальська, німецька, французька, італійська, японська, корейська та китайська. Мова браузера обирається автоматично.

Приватність за замовчуванням: без облікових записів, без відстеження, жодні дані не залишають ваш браузер. Налаштування зберігаються лише на вашому пристрої.

Chatglide не пов'язаний з YouTube чи Google і не схвалений ними.
```

### Graphic assets

| Field | File |
| --- | --- |
| Store icon (128×128) | `images/store-icon-128.png` |
| Screenshots (1280×800) | `images/screenshot-1-overlay.jpg` … `screenshot-5-languages.jpg`, in that order |
| Small promo tile (440×280) | `images/promo-small-440x280.jpg` |
| Marquee promo tile (1400×560) | `images/promo-marquee-1400x560.jpg` |

The screenshots use a public-domain NASA video and made-up chat messages and usernames, so no real viewers appear in the listing.

## Privacy practices tab

**Single purpose:**

```
Chatglide shows the live chat of the YouTube video you are watching as a customizable, read-only overlay on top of the video player.
```

**Permission justifications:**

- `storage`:
  ```
  Saves the user's overlay settings (position, size, colors, language, theme) locally on their device.
  ```
- Host permission `*://*.youtube.com/*` (content scripts):
  ```
  Needed to read the chat messages YouTube already displays on the watch page and render them in an overlay on top of the video player. The extension only runs on youtube.com.
  ```

**Remote code:** No, I am not using remote code. (All JavaScript is bundled in the package.)

**Data usage:** tick none of the data types. The extension does not collect or transmit user data. Then tick all three certifications (no selling, no unrelated use, no creditworthiness use).

**Privacy policy URL:** link to `PRIVACY.md` in the GitHub repository, e.g.
`https://github.com/TheSeires/Chatglide/blob/main/PRIVACY.md` (the repo must be public so the policy is reachable).

## Distribution tab

- Visibility: Public (or Unlisted for a soft launch)
- Regions: all regions
