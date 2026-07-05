import { GOAL_POS } from "$lib/shared/config";
import { applyMove, encodeState, isGoalState } from "$lib/entities/lock/model/lock";
import type {
  CouplingMatrix,
  LockState,
  Move,
  MoveDir,
  Solution,
} from "$lib/entities/lock/model/types";

const DIRS: MoveDir[] = [1, -1];

export function solvePuzzle(
  plateCount: number,
  start: LockState,
  coupling: CouplingMatrix,
): Solution {
  const goalKey = encodeState(Array.from({ length: plateCount }, () => GOAL_POS));
  const startKey = encodeState(start);
  if (startKey === goalKey) return { solvable: true, moves: [], statesExplored: 1 };

  const cameFrom = new Map<number, { prevKey: number; move: Move } | null>();
  cameFrom.set(startKey, null);
  let frontier: LockState[] = [start];
  let statesExplored = 1;

  while (frontier.length > 0) {
    const next: LockState[] = [];
    for (const state of frontier) {
      const curKey = encodeState(state);
      for (let i = 0; i < plateCount; i++) {
        for (const dir of DIRS) {
          const ns = applyMove(state, i, dir, coupling);
          const nk = encodeState(ns);
          if (nk === curKey) continue; // blocked or no-op
          if (cameFrom.has(nk)) continue; // already visited
          cameFrom.set(nk, { prevKey: curKey, move: { plate: i, dir } });
          statesExplored++;
          if (isGoalState(ns)) {
            return { solvable: true, moves: reconstruct(cameFrom, nk), statesExplored };
          }
          next.push(ns);
        }
      }
    }
    frontier = next;
  }
  return { solvable: false, moves: null, statesExplored };
}

function reconstruct(
  cameFrom: Map<number, { prevKey: number; move: Move } | null>,
  goalKey: number,
): Move[] {
  const moves: Move[] = [];
  let cursor = goalKey;
  let entry = cameFrom.get(cursor);
  while (entry) {
    moves.push(entry.move);
    cursor = entry.prevKey;
    entry = cameFrom.get(cursor);
  }
  moves.reverse();
  return moves;
}
