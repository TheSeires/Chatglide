<script lang="ts" generics="T extends string">
  interface Props {
    label: string;
    value: T;
    options: { value: T; label: string }[];
    onchange: (value: T) => void;
  }

  let { label, value, options, onchange }: Props = $props();
</script>

<div class="segmented" role="radiogroup" aria-label={label}>
  {#each options as option (option.value)}
    <button
      type="button"
      role="radio"
      aria-checked={option.value === value}
      class:active={option.value === value}
      onclick={() => onchange(option.value)}
    >
      {option.label}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: flex;
    gap: 2px;
    padding: 2px;
    border-radius: 8px;
    background: var(--soft);
  }

  button {
    flex: 1;
    padding: 5px 8px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--muted);
    font-weight: 500;
    cursor: pointer;
  }

  button:hover {
    color: var(--fg);
  }

  button.active {
    background: var(--bg);
    color: var(--fg);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.15);
  }
</style>
