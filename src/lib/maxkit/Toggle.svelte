<script lang="ts">
  // The Max ☒ toggle.
  interface Props {
    checked: boolean;
    label: string;
    showLabel?: boolean;
    onchange: (v: boolean) => void;
  }
  let { checked, label, showLabel = true, onchange }: Props = $props();
</script>

<button class="toggle" role="switch" aria-checked={checked} aria-label={label} onclick={() => onchange(!checked)}>
  <span class="box" class:on={checked}></span>
  {#if showLabel}<span class="text">{label}</span>{/if}
</button>

<style>
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: none;
    border: none;
    padding: 2px;
    cursor: pointer;
    font-size: 12px;
    touch-action: manipulation;
  }
  .box {
    width: 13px;
    height: 13px;
    border: 1px solid #555;
    background: #fff;
    position: relative;
    flex: none;
  }
  .box.on::before,
  .box.on::after {
    content: '';
    position: absolute;
    left: 50%;
    top: -1px;
    bottom: -1px;
    width: 1.3px;
    background: #222;
  }
  .box.on::before { transform: translateX(-50%) rotate(45deg); }
  .box.on::after { transform: translateX(-50%) rotate(-45deg); }
  .toggle:focus-visible { outline: 2px solid var(--bv-blue); }
</style>
