import { browser } from "$app/environment";
import { applyMove } from "$lib/entities/lock/model/lock";
import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
import type { LockState } from "$lib/entities/lock/model/types";
import { groupMoves } from "$lib/features/solve-lock/lib/moves";
import { computeAutoplayDwell } from "$lib/features/solve-lock/lib/autoplay";
import { speaker } from "$lib/shared/lib/speech";

// The pending auto-advance handle. Kept at module scope (one singleton store)
// rather than as $state: it is scheduling plumbing, never rendered, and making
// it reactive would only invite spurious effect runs. Speech is *not* driven
// from here — the store just moves stepIndex and lets PlaybackBar's step effect
// speak — so it stays free of the announce.ts import cycle.
let autoplayTimer: ReturnType<typeof setTimeout> | null = null;

const STORAGE_KEY = "gls:playback:v1";
const SPEECH_STORAGE_KEY = "gls:playback-speech:v1";
const RATE_STORAGE_KEY = "gls:playback-speech-rate:v1";

/** The only speech rates the UI offers; any other stored value is untrusted and
 * coerced back to the default, so a hand-edited or corrupt key can never yield
 * an unusable rate. 0.9 (slightly slow) reads clearest by ear. */
const VOICE_RATES = [0.75, 0.9, 1.1] as const;

/**
 * Drives the second-screen replay: which grouped step the player is on and
 * whether the board mirrors the solution. Class-level `$derived` fields (a
 * first in this codebase) keep the visibility guard and the replayed board
 * state in exactly one place, shared by ResultPanel, PlaybackBar and LockBoard.
 */
class PlaybackStore {
  /** 0..grouped.length inclusive; grouped.length is the explicit Done step. */
  stepIndex = $state(0);
  /** Board mirrors the solution; sticky preference, persisted here. */
  followBoard = $state(true);
  /** Announce each step by voice; sticky preference, off by default (opt-in,
   * no surprise audio), persisted under its own key. */
  voiceEnabled = $state(false);
  /** Spoken playback rate; one of VOICE_RATES, persisted under its own key. */
  voiceRate = $state(0.9);
  /** Autoplay is running: the transport advances itself on a dwell timer.
   * Not persisted — every visit starts stopped, so nothing plays unprompted. */
  isPlaying = $state(false);

  grouped = $derived(
    lockStore.result?.solvable && lockStore.result.moves ? groupMoves(lockStore.result.moves) : [],
  );
  /** The only place the playback-visibility condition lives. */
  active = $derived(lockStore.result?.solvable === true && this.grouped.length > 0);
  atDone = $derived(this.active && this.stepIndex === this.grouped.length);

  /**
   * The board state the player should be looking at right now: a pure fold of
   * applyMove over the raw-move prefix that precedes the current group. At Done
   * every move is applied (the goal state). Never mutates lockStore.positions.
   */
  positionsBeforeStep = $derived.by<LockState>(() => {
    if (!this.active) return lockStore.positions;
    const moves = lockStore.result?.moves ?? [];
    const end =
      this.stepIndex < this.grouped.length ? this.grouped[this.stepIndex].startIndex : moves.length;
    let state: LockState = lockStore.positions;
    for (let k = 0; k < end; k++) {
      state = applyMove(state, moves[k].plate, moves[k].dir, lockStore.coupling);
    }
    return state;
  });

  /** Cancel any pending auto-advance. Idempotent; safe on an already-fired timer. */
  private clearTimer(): void {
    if (autoplayTimer !== null) {
      clearTimeout(autoplayTimer);
      autoplayTimer = null;
    }
  }

  /**
   * Arm the next auto-advance. Dwell inputs (count, voice on/off, rate) are read
   * here, at schedule time, so a mid-run change to voice or speed is honoured on
   * the very next tick without restarting playback.
   */
  private scheduleAdvance(): void {
    this.clearTimer();
    const step = this.grouped[this.stepIndex];
    const dwell = computeAutoplayDwell(step ? step.count : 1, {
      speaking: this.voiceEnabled && speaker.supported,
      voiceRate: this.voiceRate,
    });
    autoplayTimer = setTimeout(() => this.autoAdvance(), dwell);
  }

  /**
   * The timer body: step forward one group and either stop at Done or arm the
   * next dwell. Deliberately separate from the public next() — that one pauses
   * first (manual control wins), whereas this one is the running engine.
   */
  private autoAdvance(): void {
    this.stepIndex = Math.min(this.grouped.length, this.stepIndex + 1);
    if (this.stepIndex === this.grouped.length) {
      // Reached Done: park here, do not loop.
      autoplayTimer = null;
      this.isPlaying = false;
      return;
    }
    this.scheduleAdvance();
  }

  /** Start autoplay; from Done it rewinds to the first step first. Speech, if
   * on, is kicked off by PlaybackBar reacting to isPlaying — not from here. */
  play(): void {
    if (!this.active) return;
    if (this.atDone) this.stepIndex = 0;
    this.isPlaying = true;
    this.scheduleAdvance();
  }

  /** Halt autoplay but let any in-flight phrase finish — cancelling speech
   * mid-word is jarring, so we only stop the timer, never the voice. */
  pause(): void {
    this.clearTimer();
    this.isPlaying = false;
  }

  next(): void {
    this.pause();
    this.stepIndex = Math.min(this.grouped.length, this.stepIndex + 1);
  }

  prev(): void {
    this.pause();
    this.stepIndex = Math.max(0, this.stepIndex - 1);
  }

  restart(): void {
    this.pause();
    this.stepIndex = 0;
  }

  toFirst(): void {
    this.pause();
    this.stepIndex = 0;
  }

  /** End key: the last instruction step, not the Done pseudo-step. */
  toLast(): void {
    this.pause();
    this.stepIndex = Math.max(0, this.grouped.length - 1);
  }

  /** Read the sticky follow preference; default true when the key is unset. */
  loadFollowBoard(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.followBoard = raw == null ? true : JSON.parse(raw) === true;
    } catch {
      this.followBoard = true;
    }
  }

  /** Read the sticky voice preference; default false (opt-in) when unset or corrupt. */
  loadVoiceEnabled(): void {
    try {
      const raw = localStorage.getItem(SPEECH_STORAGE_KEY);
      this.voiceEnabled = raw == null ? false : JSON.parse(raw) === true;
    } catch {
      this.voiceEnabled = false;
    }
  }

  /** Read the sticky speech-rate preference; only a preset value is trusted, so
   * an unset, corrupt or out-of-set number falls back to the clearer 0.9. */
  loadVoiceRate(): void {
    try {
      const raw = localStorage.getItem(RATE_STORAGE_KEY);
      const parsed = raw == null ? null : JSON.parse(raw);
      this.voiceRate = VOICE_RATES.includes(parsed) ? parsed : 0.9;
    } catch {
      this.voiceRate = 0.9;
    }
  }
}

export const playbackStore = new PlaybackStore();

// Client-only wiring, mirroring the persistence pattern in
// lock-store.svelte.ts:140-156. localStorage does not exist during prerender.
if (browser) {
  playbackStore.loadFollowBoard();
  playbackStore.loadVoiceEnabled();
  playbackStore.loadVoiceRate();

  $effect.root(() => {
    // Persist the sticky follow preference under its own key (PersistedLock
    // is never touched).
    $effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(playbackStore.followBoard));
      } catch {
        // storage may be unavailable (private mode); ignore
      }
    });

    // Persist the voice preference under its own key, same guard style.
    $effect(() => {
      try {
        localStorage.setItem(SPEECH_STORAGE_KEY, JSON.stringify(playbackStore.voiceEnabled));
      } catch {
        // storage may be unavailable (private mode); ignore
      }
    });

    // Persist the speech-rate preference under its own key, same guard style.
    $effect(() => {
      try {
        localStorage.setItem(RATE_STORAGE_KEY, JSON.stringify(playbackStore.voiceRate));
      } catch {
        // storage may be unavailable (private mode); ignore
      }
    });

    // A freshly computed result always restarts the playback — and stops any
    // autoplay left running for the previous lock.
    $effect(() => {
      if (lockStore.result) {
        playbackStore.pause();
        playbackStore.stepIndex = 0;
      }
    });

    // Losing the playable surface (unsolvable/already-open result, or the board
    // being edited) must halt a running autoplay; a timer firing against a
    // hidden bar would be invisible motion.
    $effect(() => {
      if (!playbackStore.active) playbackStore.pause();
    });

    // Light up the plate about to move (null at Done): the solution becomes
    // something you watch on the board, not only read.
    $effect(() => {
      lockStore.highlightedPlate =
        playbackStore.active && playbackStore.stepIndex < playbackStore.grouped.length
          ? playbackStore.grouped[playbackStore.stepIndex].plate
          : null;
    });
  });
}
