<script lang="ts">
  // Four beat lights in the header: the current beat of the bar is lit.
  let { step }: { step: number } = $props();
  const beat = $derived(step < 0 ? -1 : Math.floor(step / 4));
</script>

<div class="leds" aria-hidden="true">
  {#each [0, 1, 2, 3] as b (b)}
    <span class="led" class:on={b === beat}></span>
  {/each}
</div>

<style>
  .leds {
    display: flex;
    gap: 4px;
  }
  .led {
    width: 9px;
    height: 9px;
    box-sizing: border-box;
    border: 1.5px solid var(--ink);
  }
  .led.on {
    background: var(--yellow);
  }
</style>
