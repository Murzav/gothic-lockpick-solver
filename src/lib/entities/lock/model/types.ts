/**
 * Lock state representation.
 * Each element represents the position of a plate (1..7).
 * Length N indicates N plates in the lock.
 */
export type LockState = number[];

/**
 * Coupling matrix for a lock.
 * NxN matrix where [i][j] represents the effect of moving plate i by +1 on plate j.
 * Values: -1 (decreases), 0 (no effect), 1 (increases).
 */
export type CouplingMatrix = number[][];

/**
 * Direction of plate movement.
 * 1 = right/increase, -1 = left/decrease
 */
export type MoveDir = 1 | -1;

/**
 * Single move operation.
 */
export interface Move {
  plate: number;
  dir: MoveDir;
}

/**
 * Multiple consecutive moves of the same plate in the same direction.
 */
export interface GroupedMove {
  plate: number;
  dir: MoveDir;
  count: number;
}

/**
 * Convention for interpreting plate movement direction.
 * 'right-increases': moving right increases position
 * 'right-decreases': moving right decreases position
 */
export type DirectionConvention = "right-increases" | "right-decreases";

/**
 * Solution result for a lock.
 */
export interface Solution {
  solvable: boolean;
  moves: Move[] | null;
  statesExplored: number;
}
