<script lang="ts">
  // The popup while a BeatVox goes to the map, then what to do next.
  import { mapUrl, SEND_STEPS } from '../lib/roundware';
  import type { Session } from './session.svelte';

  let { s, open, onclose, onanother }: { s: Session; open: boolean; onclose: () => void; onanother: () => void } = $props();

  const STEP_TEXT = { voice: 'Your voice', mix: 'The loop', instrument: 'The slices', card: 'The picture', recipe: 'The beat' };
  let dlg: HTMLDialogElement;
  let note = $state('');

  $effect(() => {
    if (open && !dlg.open) {
      note = '';
      dlg.showModal();
    } else if (!open && dlg.open) dlg.close();
  });

  // a reVox sends only its loop and beat: the vox and slices are already there
  const steps = $derived(s.revoxOf ? SEND_STEPS.filter((x) => x === 'mix' || x === 'card' || x === 'recipe') : SEND_STEPS);
  const at = $derived(s.sendStep ? steps.indexOf(s.sendStep) : s.send === 'sent' ? steps.length : -1);

  async function shareIt() {
    const r = await s.shareLink();
    note = r === 'copied' ? 'Link copied.' : r === 'failed' ? "Couldn't share the link." : '';
  }
</script>

<dialog
  bind:this={dlg}
  aria-labelledby="send-title"
  oncancel={(e) => {
    e.preventDefault();
    if (s.send !== 'sending') onclose();
  }}
>
  {#if s.send === 'sent' && s.sentMix}
    <h2 id="send-title">ON THE MAP!</h2>
    <p>Your loop is BeatVox #{s.sentMix.mixAsset}.</p>
    <div class="actions">
      <a class="btn primary" href={mapUrl(s.sentMix.mixAsset)}>GLOBAL MAP</a>
      <button class="btn" onclick={onanother}>MAKE ANOTHER</button>
      <button class="btn" onclick={shareIt}>SHARE YOUR BEATVOX</button>
    </div>
    {#if note}<p class="note" aria-live="polite">{note}</p>{/if}
    <button class="link close" onclick={onclose}>close</button>
  {:else if s.send === 'sending'}
    <h2 id="send-title">SENDING YOUR BEATVOX</h2>
    <ol>
      {#each steps as st, i (st)}
        <li class:done={i < at} class:now={i === at}><span class="box" aria-hidden="true"></span>{STEP_TEXT[st]}</li>
      {/each}
    </ol>
    <p class="note">Keep this page open.</p>
  {:else}
    <h2 id="send-title">IT DIDN'T SEND</h2>
    <p class="error">{s.sendError || 'Something went wrong.'}</p>
    <p class="note">Anything already sent won't be sent twice.</p>
    <div class="actions">
      <button class="btn primary" onclick={() => s.sendToMap()}>TRY AGAIN</button>
      <button class="btn" onclick={onclose}>CLOSE</button>
    </div>
  {/if}
</dialog>

<style>
  dialog {
    width: min(340px, calc(100vw - 32px));
    box-sizing: border-box;
    border: 2px solid var(--ink);
    border-radius: 8px;
    background: var(--card);
    color: var(--ink);
    padding: 20px;
    box-shadow: 5px 5px 0 var(--blue);
    font: 14px/1.35 var(--mono);
  }
  dialog::backdrop {
    background: rgba(20, 18, 14, 0.45);
  }
  h2 {
    margin: 0 0 12px;
    font-size: 18px;
    letter-spacing: 0.04em;
    text-shadow: 2px 2px 0 var(--pink);
  }
  p {
    margin: 0 0 12px;
  }
  ol {
    list-style: none;
    margin: 0 0 14px;
    padding: 0;
    display: grid;
    gap: 10px;
  }
  li {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--muted);
  }
  li.done,
  li.now {
    color: var(--ink);
    font-weight: 700;
  }
  .box {
    width: 20px;
    height: 20px;
    box-sizing: border-box;
    border: 2px solid currentColor;
    border-radius: 3px;
    position: relative;
  }
  li.now .box {
    background: var(--pink);
    animation: blink 0.7s steps(2) infinite;
  }
  li.done .box::before,
  li.done .box::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 1px;
    bottom: 1px;
    width: 2px;
    background: var(--ink);
  }
  li.done .box::before {
    transform: translateX(-50%) rotate(45deg);
  }
  li.done .box::after {
    transform: translateX(-50%) rotate(-45deg);
  }
  @keyframes blink {
    50% {
      opacity: 0.4;
    }
  }
  .actions {
    display: grid;
    gap: 10px;
  }
  .actions .btn {
    text-decoration: none;
    color: var(--ink);
  }
  .note {
    font-size: 13px;
    color: var(--muted);
    margin-top: 10px;
  }
  .error {
    color: var(--error);
  }
  .close {
    display: block;
    margin: 6px auto 0;
    font-weight: 700;
  }
</style>
