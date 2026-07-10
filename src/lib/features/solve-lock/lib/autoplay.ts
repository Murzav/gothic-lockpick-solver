/**
 * Autoplay pace tuning, gathered in one object so the feel of the replay can be
 * adjusted from a single place instead of scattered magic numbers. All values
 * are milliseconds.
 */
export const AUTOPLAY = {
  /** Rough length of a spoken step at rate 1.0; scaled by the actual rate. */
  SPEECH_BASE_MS: 2300,
  /** Time to read a step silently off the board when voice is off. */
  SILENT_READ_MS: 1300,
  /** The real bottleneck: pressing the plate once in-game (~0.9s). */
  PER_PRESS_MS: 900,
  /** Breathing room so the next step never lands before the hand is done. */
  SLACK_MS: 700,
  /** Never advance faster than this, whatever the arithmetic says. */
  MIN_DWELL_MS: 1500,
} as const;

/**
 * How long to linger on a step before auto-advancing to the next one.
 *
 * The dominant cost is the player physically pressing the plate `count` times
 * (~0.9s each) — that, not the announcement, is what the dwell must cover. On
 * top of it sits either a speech estimate (scaled inversely with `voiceRate`: a
 * faster voice finishes sooner) or, in silent mode, a shorter read-off-the-board
 * time. A generous slack keeps the next instruction from landing mid-press.
 *
 * An onend-driven scheme was rejected on purpose: the speaker exposes no onend,
 * remote voices fire it unreliably, and silent mode produces no utterance to
 * hang timing off at all — so a computed dwell is the only honest source.
 */
export function computeAutoplayDwell(
  count: number,
  opts: { speaking: boolean; voiceRate: number },
): number {
  const read = opts.speaking ? AUTOPLAY.SPEECH_BASE_MS / opts.voiceRate : AUTOPLAY.SILENT_READ_MS;
  return Math.max(AUTOPLAY.MIN_DWELL_MS, read + count * AUTOPLAY.PER_PRESS_MS + AUTOPLAY.SLACK_MS);
}
