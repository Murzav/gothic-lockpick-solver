<script lang="ts">
  import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
  import { playbackStore } from "$lib/features/solve-lock/model/playback-store.svelte";
  import { physicalDirection } from "$lib/features/solve-lock/lib/moves";
  import { DpadIcon } from "$lib/shared/ui";
  import { createWakeLock } from "$lib/shared/lib/wake-lock";
  import { m } from "$lib/paraglide/messages.js";

  const grouped = $derived(playbackStore.grouped);
  const step = $derived(grouped[playbackStore.stepIndex]);
  const direction = $derived(
    step ? physicalDirection(step.dir, lockStore.convention) : "right",
  );
  const progress = $derived(
    grouped.length ? (playbackStore.stepIndex / grouped.length) * 100 : 0,
  );

  // Keep the display awake only while the bar is on screen and playing.
  const wakeLock = createWakeLock();
  $effect(() => {
    if (!playbackStore.active) return;
    void wakeLock.acquire();
    return () => wakeLock.release();
  });

  function handleKey(e: KeyboardEvent): void {
    // The window listener lives at the component's top level (svelte:window
    // cannot sit inside a block); release the keys whenever the bar is hidden.
    if (!playbackStore.active) return;
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target;
    if (
      target instanceof HTMLElement &&
      target.closest(
        'input, textarea, select, button, [contenteditable="true"]',
      )
    ) {
      return; // native controls keep their own Space/Enter — no double-advance
    }
    switch (e.key) {
      case "ArrowRight":
      case " ":
        playbackStore.next();
        break;
      case "ArrowLeft":
        playbackStore.prev();
        break;
      case "Home":
        playbackStore.toFirst();
        break;
      case "End":
        playbackStore.toLast();
        break;
      default:
        return;
    }
    // Playback owns these keys while the bar is visible — always, even at a
    // dead stop or Done, so the page never also scrolls.
    e.preventDefault();
  }
</script>

<svelte:window onkeydown={handleKey} />

{#if playbackStore.active}
  <div class="bar">
    <div class="progress" style:width="{progress}%" aria-hidden="true"></div>

    <button
      type="button"
      class="nav"
      disabled={playbackStore.stepIndex === 0}
      onclick={() => playbackStore.prev()}
    >
      {m.playback_prev()}
    </button>

    <div class="instruction" aria-live="polite">
      {#if playbackStore.atDone}
        <span class="done">
          {m.playback_done()}
          <span class="check" aria-hidden="true">✓</span>
        </span>
      {:else if step}
        <span class="line">
          <span class="plate">{m.plate_name({ n: step.plate + 1 })}</span>
          <DpadIcon {direction} size={40} />
          <span class="dir"
            >{direction === "right" ? m.dir_right() : m.dir_left()}</span
          >
          {#if step.count > 1}<span class="count mono">×{step.count}</span>{/if}
        </span>
      {/if}
    </div>

    <span class="counter mono">
      {m.playback_step({
        step: Math.min(playbackStore.stepIndex + 1, grouped.length),
        total: grouped.length,
      })}
    </span>

    <button
      type="button"
      class="restart"
      aria-label={m.playback_restart()}
      title={m.playback_restart()}
      onclick={() => playbackStore.restart()}
    >
      ↻
    </button>

    <button
      type="button"
      class="nav primary"
      disabled={playbackStore.atDone}
      onclick={() => playbackStore.next()}
    >
      {m.playback_next()}
    </button>

    <label class="follow">
      <input type="checkbox" bind:checked={playbackStore.followBoard} />
      {m.playback_follow()}
    </label>
  </div>
{/if}

<style>
  .bar {
    position: fixed;
    inset-inline: 0;
    bottom: 0;
    z-index: 20;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.9rem;
    padding: 0.75rem 1rem;
    padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
    background: color-mix(in oklch, var(--bg) 92%, transparent);
    backdrop-filter: blur(8px);
    border-top: 1px solid var(--border);
  }

  .progress {
    position: absolute;
    top: 0;
    left: 0;
    height: 3px;
    background: var(--ember);
    transition: width var(--transition-base);
  }

  .instruction {
    flex: 1 1 12rem;
    min-width: 0;
    display: flex;
    align-items: center;
  }

  .line {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.75rem;
    font-weight: 600;
  }

  .count {
    color: var(--ember);
  }

  .done {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 1.75rem;
    font-weight: 600;
    color: var(--goal);
  }

  .counter {
    color: var(--text-muted);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }

  .nav {
    touch-action: manipulation;
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.6rem 1rem;
    cursor: pointer;
    transition:
      border-color var(--transition-fast),
      opacity var(--transition-fast);
  }

  .nav:hover:not(:disabled) {
    border-color: var(--brass);
  }

  .nav:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .nav.primary {
    color: var(--bg);
    background: var(--ember);
    border-color: var(--ember);
    font-weight: 600;
  }

  .restart {
    touch-action: manipulation;
    font-size: 1.1rem;
    line-height: 1;
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.5rem 0.65rem;
    cursor: pointer;
    transition: border-color var(--transition-fast);
  }

  .restart:hover {
    border-color: var(--brass);
  }

  .follow {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    color: var(--text-muted);
    cursor: pointer;
  }
</style>
