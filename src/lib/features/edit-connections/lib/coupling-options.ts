/**
 * Coupling is entered as *same / opposite / none* rather than left / right.
 *
 * A link is defined relative to the plate you move: when you push this plate,
 * the linked plate either follows the same way (+1), goes the opposite way
 * (−1), or does not react (0). That framing is independent of which side you
 * call "right", so it sidesteps the whole direction-convention question — the
 * raw ±1 value fed to the solver is unchanged, only the label differs.
 */
export type CouplingTone = "positive" | "negative" | "neutral";

export interface CouplingOption {
  value: -1 | 0 | 1;
  /** Glyph shown on the button. */
  label: string;
  tone: CouplingTone;
}

export const COUPLING_OPTIONS: readonly CouplingOption[] = [
  { value: -1, label: "⇄", tone: "negative" },
  { value: 0, label: "—", tone: "neutral" },
  { value: 1, label: "»", tone: "positive" },
];
