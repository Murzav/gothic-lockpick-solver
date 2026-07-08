import type {
  Move,
  GroupedMove,
  MoveDir,
  DirectionConvention,
} from "$lib/entities/lock/model/types";

/**
 * Group consecutive identical (plate, dir) moves into a single GroupedMove with
 * count. Alternating directions or different plates create separate groups.
 * `startIndex` records how many raw moves precede each group, so callers can
 * fold over the exact raw-move prefix a group begins at.
 */
export function groupMoves(moves: Move[]): GroupedMove[] {
  if (moves.length === 0) return [];

  const grouped: GroupedMove[] = [];
  let current = moves[0];
  let count = 1;
  let startIndex = 0;

  for (let i = 1; i < moves.length; i++) {
    const move = moves[i];
    if (move.plate === current.plate && move.dir === current.dir) {
      count++;
    } else {
      grouped.push({ plate: current.plate, dir: current.dir, count, startIndex });
      startIndex += count;
      current = move;
      count = 1;
    }
  }

  grouped.push({ plate: current.plate, dir: current.dir, count, startIndex });
  return grouped;
}

/**
 * Map a solver direction to a locale-free physical direction token based on
 * the convention. The UI turns the token into a localized word.
 * @param dir - solver direction (1 = value increases, -1 = value decreases)
 * @param convention - 'right-increases': right physically increases the value
 *                     'right-decreases': right physically decreases the value
 * @returns 'right' or 'left'
 */
export function physicalDirection(dir: MoveDir, convention: DirectionConvention): "right" | "left" {
  const isRight = convention === "right-increases" ? dir === 1 : dir === -1;
  return isRight ? "right" : "left";
}
