/**
 * Intelligence — pure functions that turn learned per-sender engagement signals
 * into a bounded ranking adjustment (and a familiarity read for the tone
 * decoder). No transport, no storage — the application layer supplies the
 * `SenderSignal[]` (from the signals repo) and consumes these numbers.
 *
 * The weight is deliberately BOUNDED and saturating (tanh): learning nudges the
 * order of near-ties but can never override a genuine ACT-95, and a runaway
 * signal can't dominate. Learns only from the user's own taps — never content.
 */

import type { SenderSignal } from "../../ports/store.js";

/** Max nudge (±) on the 0–130 triage rank scale. Enough to reorder near-ties. */
export const MAX_ADJUST = 20;
/** How many net engagements it takes to approach the cap. */
const SCALE = 3;

/** A signed, bounded ranking adjustment for a sender's items. */
export function senderWeight(sig: SenderSignal): number {
  const net = sig.engaged - sig.deprioritized;
  return MAX_ADJUST * Math.tanh(net / SCALE);
}

/** Build a fast lookup from author id → learned ranking adjustment. */
export function buildWeightMap(sigs: SenderSignal[]): Map<string, number> {
  return new Map(sigs.map((s) => [s.authorId, senderWeight(s)]));
}

/** How much history the user has with a sender (total interactions). Feeds the
 * tone decoder's confidence — more shared signal ⇒ a slightly more confident read. */
export function familiarity(sig: SenderSignal | undefined): number {
  if (!sig) return 0;
  return sig.engaged + sig.deprioritized;
}
