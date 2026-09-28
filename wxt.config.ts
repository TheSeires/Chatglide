import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-svelte'],
  srcDir: '.',
  manifest: {
    // Translated in public/_locales.
    name: '__MSG_extName__',
    short_name: '__MSG_extShortName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    permissions: ['storage'],
    action: {
      default_title: '__MSG_extShortName__',
    },
  },
});
