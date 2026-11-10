<script lang="ts">
  // The round ? beside the BEATVOX wordmark: opens About over the page.
  import { about } from './aboutState.svelte';
</script>

<button class="btn q" aria-label="About BeatVox" aria-haspopup="dialog" onclick={() => about.show()}>?</button>

<style>
  .q {
    width: 40px;
    min-height: 40px;
    height: 40px;
    padding: 0;
    flex: none;
    border-radius: 50%;
    font: 700 19px/1 var(--mono);
  }
</style>
