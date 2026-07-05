import { solvePuzzle } from "./solver";
import type { CouplingMatrix, LockState } from "$lib/entities/lock/model/types";

self.onmessage = (
  e: MessageEvent<{ plateCount: number; start: LockState; coupling: CouplingMatrix }>,
) => {
  const { plateCount, start, coupling } = e.data;
  self.postMessage(solvePuzzle(plateCount, start, coupling));
};
