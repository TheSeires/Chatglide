import type { VisibilityRequest } from '@/utils/visibility';

// Keyboard shortcuts are only delivered to the background, so it forwards them to the tab.
export default defineBackground(() => {
  browser.commands.onCommand.addListener((command, tab) => {
    if (command !== 'toggle-overlay' || tab?.id === undefined) return;
    const request: VisibilityRequest = { type: 'chatglide:toggle-video' };
    // Fails harmlessly on tabs without our content script (not YouTube).
    browser.tabs.sendMessage(tab.id, request, { frameId: 0 }).catch(() => {});
  });
});
