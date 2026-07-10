<script lang="ts">
  import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
  import type { Solution } from "$lib/entities/lock/model/types";
  import { playbackStore } from "$lib/features/solve-lock/model/playback-store.svelte";
  import { physicalDirection } from "$lib/features/solve-lock/lib/moves";
  import { announceStep } from "$lib/features/solve-lock/lib/announce";
  import { DpadIcon } from "$lib/shared/ui";
  import { createWakeLock } from "$lib/shared/lib/wake-lock";
  import { speaker } from "$lib/shared/lib/speech";
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

  // Announce each step by voice. Trackers persist across effect runs (plain
  // vars, not $state — reading them must not create dependencies) so we can tell
  // a genuine change from an incidental re-run. The first run only primes them:
  // it is the page-load/hydration restore, with no user gesture, and speaking
  // then would be blocked by the autoplay policy anyway.
  //
  // This is also the single funnel for autoplay's voice: the store only moves
  // stepIndex, and each move lands here as a step change. Pressing Play at the
  // current step (no index change) is caught separately via the isPlaying
  // false→true edge, so starting playback speaks the step you are already on.
  let primed = false;
  let prevStepIndex = 0;
  let prevResult: Solution | null = null;
  let prevIsPlaying = false;
  $effect(() => {
    // Read every dependency up front so the effect re-runs on any of them, even
    // on the early-return paths below.
    const active = playbackStore.active;
    const voiceEnabled = playbackStore.voiceEnabled;
    const stepIndex = playbackStore.stepIndex;
    const isPlaying = playbackStore.isPlaying;
    const result = lockStore.result;

    if (!primed) {
      primed = true;
      prevStepIndex = stepIndex;
      prevResult = result;
      prevIsPlaying = isPlaying;
      return;
    }

    if (!active || !voiceEnabled || !speaker.supported) {
      // Silence anything in flight and re-arm, so re-activation does not replay
      // a diff that accrued while muted.
      speaker.cancel();
      prevStepIndex = stepIndex;
      prevResult = result;
      prevIsPlaying = isPlaying;
      return;
    }

    const changed = stepIndex !== prevStepIndex || result !== prevResult;
    const startedPlaying = isPlaying && !prevIsPlaying;
    prevStepIndex = stepIndex;
    prevResult = result;
    prevIsPlaying = isPlaying;
    // Play-from-Done both rewinds stepIndex and flips isPlaying in one flush;
    // the single announceStep plus the speaker's 80ms coalescing collapse that
    // to one utterance, so no extra guard is needed here.
    if (changed || startedPlaying) announceStep(stepIndex);
  });

  // Backgrounding the tab throttles timers and makes speech unreliable, so a
  // hidden tab stops autoplay outright and cuts any phrase; the user resumes
  // explicitly when they return.
  function onVisibilityChange(): void {
    if (document.visibilityState === "hidden") {
      playbackStore.pause();
      speaker.cancel();
    }
  }
  // Reads nothing reactive — the listener is set up once on mount, torn down on
  // unmount.
  $effect(() => {
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  });

  // Silence any in-flight announcement when the bar leaves the screen. This
  // effect reads nothing reactive, so its cleanup runs only on unmount.
  $effect(() => () => speaker.cancel());

  function togglePlay(): void {
    if (playbackStore.isPlaying) playbackStore.pause();
    else playbackStore.play();
  }

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
    // Named keys (ArrowRight, Home…) keep their exact spelling; single-character
    // keys are lowercased so Shift-held letters still match "r"/"p".
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    switch (key) {
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
      case "r":
        // One-shot repeat: read the current step aloud regardless of the voice
        // toggle — it is an explicit ask, not the ambient narration.
        announceStep(playbackStore.stepIndex);
        break;
      case "p":
        togglePlay();
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

    {#if speaker.supported}
      <button
        type="button"
        class="restart"
        aria-label={m.playback_repeat()}
        title={m.playback_repeat()}
        onclick={() => announceStep(playbackStore.stepIndex)}
      >
        <!-- Speaker glyph: fill-based body + stroked sound waves, matching
             DpadIcon's currentColor / 24-unit-grid style. Purely decorative. -->
        <svg
          class="icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" fill="currentColor" />
          <path
            d="M16 8.5 A4.5 4.5 0 0 1 16 15.5"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          />
          <path
            d="M18 6 A8 8 0 0 1 18 18"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          />
        </svg>
      </button>
    {/if}

    <button
      type="button"
      class="restart"
      aria-label={playbackStore.isPlaying
        ? m.playback_pause()
        : m.playback_play()}
      title={playbackStore.isPlaying ? m.playback_pause() : m.playback_play()}
      onclick={togglePlay}
    >
      {playbackStore.isPlaying ? "⏸" : "▶"}
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
    display: inline-flex;
    align-items: center;
    justify-content: center;
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

  .restart .icon {
    display: block;
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
