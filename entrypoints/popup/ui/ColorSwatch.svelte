<script lang="ts">
  interface Props {
    label: string;
    value: string;
    onchange: (value: string) => void;
  }

  let { label, value, onchange }: Props = $props();
</script>

<!-- The native picker opens from an invisible input stretched over the swatch. -->
<label class="swatch" style:background={value} title={label}>
  <input
    type="color"
    aria-label={label}
    {value}
    oninput={(e) => onchange(e.currentTarget.value)}
  />
</label>

<style>
  .swatch {
    position: relative;
    flex: none;
    width: 26px;
    height: 26px;
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
  }

  .swatch:focus-within {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }

  input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }
</style>
