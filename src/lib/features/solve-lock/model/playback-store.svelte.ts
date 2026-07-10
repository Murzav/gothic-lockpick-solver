import { browser } from "$app/environment";
import { applyMove } from "$lib/entities/lock/model/lock";
import { lockStore } from "$lib/entities/lock/model/lock-store.svelte";
import type { LockState } from "$lib/entities/lock/model/types";
import { groupMoves } from "$lib/features/solve-lock/lib/moves";

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

  next(): void {
    this.stepIndex = Math.min(this.grouped.length, this.stepIndex + 1);
  }

  prev(): void {
    this.stepIndex = Math.max(0, this.stepIndex - 1);
  }

  restart(): void {
    this.stepIndex = 0;
  }

  toFirst(): void {
    this.stepIndex = 0;
  }

  /** End key: the last instruction step, not the Done pseudo-step. */
  toLast(): void {
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

    // A freshly computed result always restarts the playback.
    $effect(() => {
      if (lockStore.result) playbackStore.stepIndex = 0;
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
