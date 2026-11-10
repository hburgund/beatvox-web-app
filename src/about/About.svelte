<script lang="ts">
  // The About overlay: a sheet from the bottom on a phone, a panel on the
  // right on a bigger screen. It sits over the page, so a beat or Wander keeps
  // playing; on the map, a line at the top shows what's playing, with Skip.
  import AboutContent from './AboutContent.svelte';
  import { about } from './aboutState.svelte';

  interface Wander {
    title: string;
    skip: () => void;
    stop: () => void;
  }
  let { wander = null }: { wander?: Wander | null } = $props();

  let dlg: HTMLDialogElement;
  let scroller: HTMLDivElement;
  let pageTitle = '';

  $effect(() => {
    if (about.open && !dlg.open) {
      pageTitle = document.title;
      document.title = 'About · BeatVox';
      dlg.showModal();
      if (!about.section) scroller.scrollTop = 0;
    } else if (!about.open && dlg.open) {
      dlg.close();
      document.title = pageTitle || 'BeatVox';
    }
  });

  // open a section and bring it into view
  $effect(() => {
    const sec = about.section;
    if (!about.open || !sec) return;
    requestAnimationFrame(() => {
      const el = scroller.querySelector<HTMLElement>(`#about-${sec}`);
      if (!el) return;
      if (el instanceof HTMLDetailsElement) el.open = true;
      el.scrollIntoView({ block: 'start' });
    });
  });
</script>

<dialog
  bind:this={dlg}
  aria-labelledby="about-title"
  oncancel={(e) => {
    e.preventDefault();
    about.hide();
  }}
  onclick={(e) => {
    // a tap on the backdrop closes it
    if (e.target === dlg) about.hide();
  }}
>
  <div class="frame">
    <div class="head">
      <div class="grab" aria-hidden="true"></div>
      <div class="bar">
        <span class="label">ABOUT BEATVOX</span>
        <button class="btn close" aria-label="Close About" onclick={() => about.hide()}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2.4" /></svg>
        </button>
      </div>
      {#if wander}
        <div class="np" aria-live="polite">
          <span class="np-text"><span class="label">WANDERING</span> {wander.title}</span>
          <button class="btn small" onclick={wander.skip}>SKIP</button>
          <button class="btn small" onclick={wander.stop}>STOP</button>
        </div>
      {/if}
    </div>
    <div class="scroll" bind:this={scroller}>
      <AboutContent />
    </div>
  </div>
</dialog>

<style>
  /* a phone: a sheet from the bottom, nearly the whole height */
  dialog {
    position: fixed;
    inset: auto 0 0 0;
    margin: 0;
    width: 100%;
    max-width: none;
    height: calc(100dvh - 28px);
    max-height: none;
    box-sizing: border-box;
    padding: 0;
    border: none;
    border-top: 2px solid var(--ink);
    border-radius: 14px 14px 0 0;
    background: var(--paper);
    color: var(--ink);
    overflow: hidden;
  }
  dialog[open] {
    animation: up 240ms ease;
  }
  dialog::backdrop {
    background: rgb(29 27 22 / 0.4);
  }
  .frame {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .head {
    flex: none;
    padding: 8px 16px 10px;
    border-bottom: 2px solid var(--ink);
    background: var(--paper);
  }
  .grab {
    width: 44px;
    height: 5px;
    margin: 0 auto 6px;
    border-radius: 3px;
    background: var(--soft);
  }
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .close {
    width: 44px;
    padding: 0;
  }
  .np {
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 6px 6px 10px;
    border: 2px solid var(--ink);
    border-radius: 8px;
    background: var(--now);
  }
  .np-text {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 700;
  }
  .np .label {
    font-size: 11px;
    margin-right: 4px;
  }
  .btn.small {
    min-height: 36px;
    padding: 0 10px;
    font-size: 12px;
  }
  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 20px 18px calc(28px + env(safe-area-inset-bottom));
  }

  /* a bigger screen: a panel on the right, the page still in view */
  @media (min-width: 900px) {
    dialog {
      inset: 0 0 0 auto;
      width: 480px;
      height: 100dvh;
      border-top: none;
      border-left: 2px solid var(--ink);
      border-radius: 0;
    }
    dialog[open] {
      animation: in 240ms ease;
    }
    dialog::backdrop {
      background: rgb(29 27 22 / 0.15);
    }
    .grab {
      display: none;
    }
    .head {
      padding-top: 12px;
    }
    .scroll {
      padding: 24px 28px 40px;
    }
  }
  @keyframes up {
    from {
      transform: translateY(100%);
    }
  }
  @keyframes in {
    from {
      transform: translateX(100%);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    dialog[open] {
      animation: none;
    }
  }
</style>
