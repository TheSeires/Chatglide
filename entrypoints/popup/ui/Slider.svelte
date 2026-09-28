<script lang="ts">
  interface Props {
    /** Omit to render just the track, e.g. next to a color swatch. */
    label?: string;
    /** Accessible name when there is no visible label. */
    ariaLabel?: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    onchange: (value: number) => void;
  }

  let { label, ariaLabel, value, min, max, step = 1, unit = 'px', onchange }: Props = $props();

  const fill = $derived(((value - min) / (max - min)) * 100);
</script>

<label class="field" class:bare={!label}>
  {#if label}
    <span class="head">
      <span>{label}</span>
      <output>{value}{unit}</output>
    </span>
  {/if}
  <span class="track-row">
    <input
      type="range"
      {min}
      {max}
      {step}
      {value}
      aria-label={label ?? ariaLabel}
      style:--fill="{fill}%"
      oninput={(e) => onchange(Number(e.currentTarget.value))}
    />
    {#if !label}
      <output>{value}{unit}</output>
    {/if}
  </span>
</label>

<style>
  .field {
    display: block;
    padding: 4px 0;
  }

  .field.bare {
    flex: 1;
    padding: 0;
  }

  .head {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .track-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  output {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .bare output {
    min-width: 34px;
    text-align: right;
  }

  input {
    flex: 1;
    height: 16px;
    margin: 0;
    background: transparent;
    cursor: pointer;
    appearance: none;
  }

  input:focus-visible {
    outline: none;
  }

  input::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 999px;
    background:
      linear-gradient(var(--primary), var(--primary)) 0 / var(--fill) 100% no-repeat,
      var(--soft);
  }

  input::-webkit-slider-thumb {
    width: 16px;
    height: 16px;
    margin-top: -5px;
    border: 2px solid var(--primary);
    border-radius: 50%;
    background: var(--bg);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
    appearance: none;
  }

  input:focus-visible::-webkit-slider-thumb {
    box-shadow: 0 0 0 3px var(--ring);
  }
</style>
