import { GOAL_POS, MAX_POS, MIN_POS } from "$lib/shared/config";
import type { CouplingMatrix, LockState, MoveDir } from "./types";

export function clampPosition(v: number): number {
  return Math.min(MAX_POS, Math.max(MIN_POS, v));
}

export function isGoalState(state: LockState): boolean {
  return state.every((p) => p === GOAL_POS);
}

export function encodeState(state: LockState): number {
  let key = 0;
  for (let i = 0; i < state.length; i++) key = key * 7 + (state[i] - 1);
  return key;
}

export function applyMove(
  state: LockState,
  plateIndex: number,
  dir: MoveDir,
  coupling: CouplingMatrix,
): LockState {
  // First pass: validate that no participating plate would leave [1,7]
  for (let j = 0; j < state.length; j++) {
    const delta = (j === plateIndex ? 1 : coupling[plateIndex][j]) * dir;
    const raw = state[j] + delta;
    if (raw < MIN_POS || raw > MAX_POS) return state; // whole move rejected
  }
  // Second pass: apply the move to all participating plates
  const next = state.slice();
  for (let j = 0; j < state.length; j++) {
    const delta = (j === plateIndex ? 1 : coupling[plateIndex][j]) * dir;
    next[j] += delta;
  }
  return next;
}
