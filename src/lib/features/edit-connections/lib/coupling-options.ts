/**
 * Coupling is entered as *same / opposite / none* rather than left / right.
 *
 * A link is defined relative to the plate you move: when you push this plate,
 * the linked plate either follows the same way (+1), goes the opposite way
 * (−1), or does not react (0). That framing is independent of which side you
 * call "right", so it sidesteps the whole direction-convention question — the
 * raw ±1 value fed to the solver is unchanged, only the label differs.
 *
 * Each link is a single button that cycles through the three states on click,
 * so the whole coupling for a plate is a short row of buttons rather than a
 * dense three-buttons-per-target grid.
 */
export type CouplingValue = -1 | 0 | 1;
export type CouplingTone = "positive" | "negative" | "neutral";

export interface CouplingOption {
  value: CouplingValue;
  /** Glyph shown on the button. */
  label: string;
  tone: CouplingTone;
}

const NONE: CouplingOption = { value: 0, label: "—", tone: "neutral" };
const SAME: CouplingOption = { value: 1, label: "»", tone: "positive" };
const OPPOSITE: CouplingOption = { value: -1, label: "⇄", tone: "negative" };

/** Cycle order when the button is clicked: none → same → opposite → none. */
export const COUPLING_CYCLE: readonly CouplingOption[] = [NONE, SAME, OPPOSITE];

export function couplingOption(value: number): CouplingOption {
  return COUPLING_CYCLE.find((o) => o.value === value) ?? NONE;
}

export function nextCoupling(value: number): CouplingValue {
  const i = COUPLING_CYCLE.findIndex((o) => o.value === value);
  return COUPLING_CYCLE[(i + 1) % COUPLING_CYCLE.length].value;
}
