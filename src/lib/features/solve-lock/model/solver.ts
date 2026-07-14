import { GOAL_POS, MAX_POS, MIN_POS } from "$lib/shared/config";
import { encodeState } from "$lib/entities/lock/model/lock";
import type {
  CouplingMatrix,
  LockState,
  Move,
  MoveDir,
  Solution,
} from "$lib/entities/lock/model/types";

const DIRS: MoveDir[] = [1, -1];

// Table sizing guards. The dense arrays below are sized for the worst case
// (N=7 → 7^7 base states × 8 extended variants). These caps make the intended
// footprint explicit and turn any out-of-range plate count into a loud throw
// instead of a silent multi-hundred-MiB allocation.
const MAX_EXT_STATES = 6_588_344; // 7^7 * (7 + 1)
const MAX_TABLE_BYTES = 90 * 1024 * 1024;

/**
 * Shortest-then-fewest-switches lock solver.
 *
 * Two objectives, in strict priority: (1) the raw move count is minimal — the
 * same length the plain BFS returns; (2) among all solutions of that length,
 * the number of plate switches is minimal. A "switch" is an adjacent pair of
 * moves on different plates; the first move counts as zero switches.
 *
 * This is a heap-free layered BFS over EXTENDED states (lockKey, lastPlate).
 * The layer index is the move count, so the frontier reaches the goal at the
 * shortest length automatically; within each layer we relax on switch count so
 * the reconstructed path is the cheapest-switching one of that length.
 */
export function solvePuzzle(
  plateCount: number,
  start: LockState,
  coupling: CouplingMatrix,
): Solution {
  const N = plateCount;
  const SENTINEL = N; // lastPlate marker for the start state (no prior move)
  const goalKey = encodeState(Array.from({ length: N }, () => GOAL_POS));
  const startKey = encodeState(start);
  if (startKey === goalKey) return { solvable: true, moves: [], statesExplored: 1 };

  const baseStates = 7 ** N; // distinct lock configurations (base-7 encoded)
  const extStride = N + 1; // lastPlate ∈ 0..N-1 plus the SENTINEL slot
  const extStates = baseStates * extStride;

  // Bounds assertion: keep the table within the sizes this solver is designed
  // for. 10 bytes per extended state (two Uint32 + two Uint8) plus baseSeen.
  const tableBytes = extStates * 10 + baseStates;
  if (extStates > MAX_EXT_STATES || tableBytes > MAX_TABLE_BYTES) {
    throw new RangeError(
      `solvePuzzle: state table too large (extStates=${extStates}, bytes=${tableBytes})`,
    );
  }

  // switchDist: best known switch count to reach an extended state (0xFFFFFFFF = unseen).
  const switchDist = new Uint32Array(extStates).fill(0xffffffff);
  // pred: predecessor extended key (-1 = none, e.g. the start node).
  const pred = new Int32Array(extStates).fill(-1);
  // predMove: the move taken into this node, packed as plate*2 + (dir === 1 ? 0 : 1).
  const predMove = new Uint8Array(extStates);
  // nodeState: 0 = unseen, 1 = in the next frontier (relaxable), 2 = finalized.
  const nodeState = new Uint8Array(extStates);
  // baseSeen: has this base lock configuration been discovered? Drives statesExplored.
  const baseSeen = new Uint8Array(baseStates);

  const startEk = startKey * extStride + SENTINEL;
  switchDist[startEk] = 0;
  nodeState[startEk] = 2; // finalized: it is the layer-0 frontier being expanded
  baseSeen[startKey] = 1;
  let statesExplored = 1;

  // Frontier is a flat list of extended keys. The lock positions are decoded
  // from each key on demand into `pos`, and every neighbour is validated and
  // re-encoded in place, so the hot loop allocates NO per-node or per-edge
  // arrays — the single biggest cost in a naive `applyMove`/`encodeState` loop.
  let frontier: number[] = [startEk];
  const pos = new Uint8Array(N); // scratch: decoded plate positions of the current node
  let goalFound = false;

  while (frontier.length > 0) {
    const next: number[] = [];

    for (let f = 0; f < frontier.length; f++) {
      const curEk = frontier[f]!;
      const curDist = switchDist[curEk]!;
      const lastPlate = curEk % extStride;

      // Decode the base lock key (curEk minus its lastPlate slot) into `pos`.
      // encodeState packs plate 0 as the most significant base-7 digit, so we
      // fill `pos` from the least significant end.
      let key = (curEk - lastPlate) / extStride; // === Math.floor(curEk / extStride) === lockKey
      for (let p = N - 1; p >= 0; p--) {
        const digit = key % 7;
        pos[p] = digit + 1;
        key = (key - digit) / 7;
      }

      for (let i = 0; i < N; i++) {
        for (let d = 0; d < DIRS.length; d++) {
          const dir = DIRS[d]!;

          // Inline applyMove + encodeState in ONE allocation-free pass: validate
          // the [1,7] bound for every participating plate while accumulating the
          // base-7 key in plate order. An out-of-range plate rejects the WHOLE
          // move — exactly the no-op the array-returning applyMove signals by
          // returning its input reference — so we never mint an extended key for
          // it (which would forge a spurious (sameLockKey, newLastPlate) node).
          // A move on plate i always shifts plate i by ±1, so any in-bounds move
          // changes the state; no-op ⟺ out-of-bounds, identical to applyMove.
          let nk = 0;
          let ok = true;
          for (let j = 0; j < N; j++) {
            const delta = (j === i ? 1 : coupling[i]![j]!) * dir;
            const raw = pos[j]! + delta;
            if (raw < MIN_POS || raw > MAX_POS) {
              ok = false;
              break;
            }
            nk = nk * 7 + (raw - 1);
          }
          if (!ok) continue;

          const nek = nk * extStride + i;
          const switchCost = lastPlate === SENTINEL || lastPlate === i ? 0 : 1;
          const cand = curDist + switchCost;
          const st = nodeState[nek]!;

          if (st === 2) continue; // finalized in an earlier (shorter) layer

          if (st === 0) {
            // Discover: record the edge and enqueue for the next layer.
            switchDist[nek] = cand;
            pred[nek] = curEk;
            predMove[nek] = i * 2 + (dir === 1 ? 0 : 1);
            nodeState[nek] = 1;
            next.push(nek);
            if (baseSeen[nk] === 0) {
              baseSeen[nk] = 1;
              statesExplored++;
            }
            if (nk === goalKey) goalFound = true;
          } else if (cand < switchDist[nek]!) {
            // Relax on STRICT improvement only. Equal-cost edges keep the
            // first-found predecessor, which — with plates iterated ascending
            // and DIRS fixed at [1, -1] — is a deterministic tie-break, so two
            // runs on identical input reconstruct identical move arrays.
            switchDist[nek] = cand; // atomic with pred/predMove: never split them
            pred[nek] = curEk;
            predMove[nek] = i * 2 + (dir === 1 ? 0 : 1);
          }
        }
      }
    }

    // Finish-goal-layer rule: once the goal appears we still let the WHOLE
    // layer complete above so every incoming edge has had its chance to relax,
    // then pick the cheapest-switching goal variant and stop.
    if (goalFound) {
      let bestEk = -1;
      let bestDist = 0xffffffff;
      // Scan the (N+1) goal variants ascending by lastPlate; strict `<` means
      // ties resolve to the smallest lastPlate — same deterministic tie-break.
      for (let p = 0; p < extStride; p++) {
        const gek = goalKey * extStride + p;
        if (nodeState[gek] === 0) continue; // never reached
        const dd = switchDist[gek]!;
        if (dd < bestDist) {
          bestDist = dd;
          bestEk = gek;
        }
      }
      return { solvable: true, moves: reconstruct(pred, predMove, bestEk), statesExplored };
    }

    // Finalize the whole next frontier before it becomes the current one, so a
    // later layer can never relax a node whose shortest distance is settled.
    for (let k = 0; k < next.length; k++) nodeState[next[k]!] = 2;
    frontier = next;
  }

  return { solvable: false, moves: null, statesExplored };
}

/** Walk the predecessor chain from a goal extended key back to the start. */
function reconstruct(pred: Int32Array, predMove: Uint8Array, goalEk: number): Move[] {
  const moves: Move[] = [];
  let cursor = goalEk;
  while (pred[cursor] !== -1) {
    const packed = predMove[cursor]!;
    const plate = packed >> 1;
    const dir: MoveDir = (packed & 1) === 0 ? 1 : -1;
    moves.push({ plate, dir });
    cursor = pred[cursor]!;
  }
  moves.reverse();
  return moves;
}
