import { browser } from "$app/environment";
import { PLATE_MAX, PLATE_MIN } from "$lib/shared/config";
import type { CouplingMatrix, DirectionConvention, LockState, Solution } from "./types";

const DEFAULT_PLATE_COUNT = 5;
const STORAGE_KEY = "gls:lock:v1";

interface PersistedLock {
  plateCount: number;
  positions: LockState;
  coupling: CouplingMatrix;
  convention: DirectionConvention;
  viewMode: "board" | "form";
}

function emptyPositions(n: number): LockState {
  return Array(n).fill(1);
}

function emptyCoupling(n: number): CouplingMatrix {
  return Array.from({ length: n }, () => Array(n).fill(0));
}

/**
 * Reactive store holding the lock configuration and the current solve
 * result. Single source of truth shared by every board/form component.
 */
class LockStore {
  plateCount = $state(DEFAULT_PLATE_COUNT);
  positions = $state<LockState>(emptyPositions(DEFAULT_PLATE_COUNT));
  coupling = $state<CouplingMatrix>(emptyCoupling(DEFAULT_PLATE_COUNT));
  convention = $state<DirectionConvention>("right-increases");
  viewMode = $state<"board" | "form">("board");
  result = $state<Solution | null>(null);
  solving = $state(false);
  /** Plate the solution playback is currently on, for board highlighting. */
  highlightedPlate = $state<number | null>(null);
  /**
   * Bumped on every configuration edit. A solve captures this at its start and
   * discards its result if the value changed meanwhile, so an edit made while
   * the worker is still running can never overwrite the lock with a stale
   * answer.
   */
  generation = 0;

  /** Drop the current solution: it no longer describes the edited lock. */
  private invalidateResult(): void {
    this.result = null;
    this.highlightedPlate = null;
    this.generation++;
  }

  setPlateCount(n: number): void {
    this.plateCount = n;
    this.positions = emptyPositions(n);
    this.coupling = emptyCoupling(n);
    this.invalidateResult();
  }

  setPosition(i: number, pos: number): void {
    this.positions[i] = pos;
    this.invalidateResult();
  }

  setCoupling(i: number, j: number, v: number): void {
    this.coupling[i][j] = v;
    this.invalidateResult();
  }

  setConvention(c: DirectionConvention): void {
    this.convention = c;
    this.invalidateResult();
  }

  setViewMode(m: "board" | "form"): void {
    this.viewMode = m;
  }

  reset(): void {
    this.plateCount = DEFAULT_PLATE_COUNT;
    this.positions = emptyPositions(DEFAULT_PLATE_COUNT);
    this.coupling = emptyCoupling(DEFAULT_PLATE_COUNT);
    this.convention = "right-increases";
    this.viewMode = "board";
    this.solving = false;
    this.invalidateResult();
  }

  /**
   * Plain (non-reactive) snapshot of the lock configuration, ready to hand to
   * the solver worker. `$state.snapshot` strips the reactive proxy so the
   * value is structured-cloneable for `postMessage`. The solve orchestration
   * itself lives in the feature layer (`solve-current-lock`), keeping this
   * entity store free of any upward dependency on `features/`.
   */
  snapshotConfig(): { plateCount: number; start: LockState; coupling: CouplingMatrix } {
    return {
      plateCount: this.plateCount,
      start: $state.snapshot(this.positions),
      coupling: $state.snapshot(this.coupling),
    };
  }

  /** Plain snapshot of the persistable configuration (no transient result). */
  serialize(): PersistedLock {
    return {
      plateCount: this.plateCount,
      positions: $state.snapshot(this.positions),
      coupling: $state.snapshot(this.coupling),
      convention: this.convention,
      viewMode: this.viewMode,
    };
  }

  /** Restore a persisted configuration, ignoring anything that fails a shape check. */
  hydrate(data: PersistedLock): void {
    const n = data?.plateCount;
    if (typeof n !== "number" || n < PLATE_MIN || n > PLATE_MAX) return;
    if (!Array.isArray(data.positions) || data.positions.length !== n) return;
    if (
      !Array.isArray(data.coupling) ||
      data.coupling.length !== n ||
      !data.coupling.every((row) => Array.isArray(row) && row.length === n)
    ) {
      return;
    }
    this.plateCount = n;
    this.positions = data.positions.slice();
    this.coupling = data.coupling.map((row) => row.slice());
    this.convention = data.convention === "right-decreases" ? "right-decreases" : "right-increases";
    this.viewMode = data.viewMode === "form" ? "form" : "board";
  }
}

export const lockStore = new LockStore();

// Persist the lock across reloads (a language switch reloads the page, and
// the input should survive it). Client-only: localStorage does not exist
// during prerender.
if (browser) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) lockStore.hydrate(JSON.parse(saved) as PersistedLock);
  } catch {
    // ignore unreadable/corrupt storage
  }
  $effect.root(() => {
    $effect(() => {
      const snapshot = JSON.stringify(lockStore.serialize());
      try {
        localStorage.setItem(STORAGE_KEY, snapshot);
      } catch {
        // storage may be unavailable (private mode); ignore
      }
    });
  });
}
