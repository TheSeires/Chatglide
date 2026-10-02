<script lang="ts" generics="T extends string">
  interface Props {
    label: string;
    value: T;
    options: { value: T; label: string }[];
    onchange: (value: T) => void;
  }

  let { label, value, options, onchange }: Props = $props();
</script>

<label class="field">
  <span>{label}</span>
  <select {value} onchange={(e) => onchange(e.currentTarget.value as T)}>
    {#each options as option (option.value)}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
</label>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px 0;
  }

  select {
    width: 100%;
    height: 30px;
    padding: 0 26px 0 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")
        right 6px center / 14px no-repeat,
      var(--bg);
    color: var(--fg);
    font: inherit;
    text-overflow: ellipsis;
    cursor: pointer;
    appearance: none;
  }

  select:hover {
    background-color: var(--soft);
  }

  option {
    background: var(--bg);
    color: var(--fg);
  }
</style>
