<script lang="ts">
  interface Props {
    label: string;
    checked: boolean;
    onchange: (checked: boolean) => void;
  }

  let { label, checked, onchange }: Props = $props();
</script>

<label class="field">
  <span>{label}</span>
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    class="switch"
    class:on={checked}
    onclick={() => onchange(!checked)}
  >
    <span class="thumb"></span>
  </button>
</label>

<style>
  .field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 28px;
    cursor: pointer;
  }

  .switch {
    position: relative;
    flex: none;
    width: 36px;
    height: 20px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: var(--switch-off);
    cursor: pointer;
    transition: background 0.15s;
  }

  .switch.on {
    background: var(--primary);
  }

  .thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--bg);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.3);
    transition: transform 0.15s;
  }

  .on .thumb {
    transform: translateX(16px);
    background: var(--primary-fg);
  }
</style>
