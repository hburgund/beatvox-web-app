<script lang="ts">
  // The header's 4 × 4 beat indicator: lights the current step.
  let { step }: { step: number } = $props();
</script>

<div class="leds" aria-hidden="true">
  {#each Array(16) as _, i (i)}
    <span class="led" class:on={i === step}></span>
  {/each}
</div>

<style>
  .leds {
    display: flex;
    gap: 2px;
  }
  .led {
    width: 11px;
    height: 11px;
    border: 1px solid #555;
    background: #fff;
    box-sizing: border-box;
  }
  .led:nth-child(4n + 1):not(:first-child) {
    margin-left: 7px;
  }
  .led.on {
    background: var(--bv-led);
  }
</style>
