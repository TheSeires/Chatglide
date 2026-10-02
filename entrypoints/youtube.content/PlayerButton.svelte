<script lang="ts">
  import { t } from '@/utils/i18n';
  import { settings } from '@/utils/settings.svelte';
  import { chat } from './chat.svelte';
  import { overlayEnabled, toggleVideo } from './visibility.svelte';

  const on = $derived(overlayEnabled());
  const label = $derived(on ? t('playerButtonHide') : t('playerButtonShow'));
</script>

<!-- In YouTube's control bar (not a shadow root): inline styles plus YouTube's ytp-button class. -->
{#if settings.playerButton && chat.active}
  <button
    type="button"
    class="ytp-button"
    aria-pressed={on}
    aria-label={label}
    title={label}
    style="display: inline-flex; align-items: center; justify-content: center;"
    onclick={toggleVideo}
  >
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="3" stroke="#fff" stroke-width="2" />
      <rect x="10" y="8.5" width="8" height="2" rx="1" fill="#fff" />
      <rect x="10" y="11.5" width="5" height="2" rx="1" fill="#fff" />
      <rect x="10" y="14.5" width="7" height="2" rx="1" fill="#fff" />
      {#if !on}
        <path d="M3 3 21 21" stroke="#fff" stroke-width="2" stroke-linecap="round" />
      {/if}
    </svg>
  </button>
{/if}
