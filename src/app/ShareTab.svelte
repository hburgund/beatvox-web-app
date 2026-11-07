<script lang="ts">
  import type { Session } from './session.svelte';
  let { s }: { s: Session } = $props();
</script>

<section class="share">
  <h2>Make an MP3 of Your Beat</h2>
  <div class="soon">
    <p><strong>Coming next.</strong> Sharing will capture 8 loops of your beat, with your own voice first, and let you:</p>
    <ul>
      <li>save the MP3 to your device, or</li>
      <li>share it to BeatVox, with where you made it and the option to let others reVox your voice.</li>
    </ul>
    <button class="pill" disabled>RECORD</button>
    {#if !s.slices.length}<p class="hint">Record your voice first.</p>{/if}
  </div>
</section>

<style>
  .share {
    padding: 10px 18px 22px;
  }
  h2 {
    text-align: center;
    font-size: 15px;
    margin: 4px 0 14px;
  }
  .soon {
    max-width: 460px;
    margin: 0 auto;
    background: #fff;
    border: 1px solid var(--bv-panel-edge);
    border-radius: 8px;
    padding: 12px 16px 16px;
  }
  ul {
    padding-left: 20px;
  }
</style>
