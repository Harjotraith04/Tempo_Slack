/**
 * Feature flags for the native surfaces added in v2.0.
 *
 * These gate whether a capability is *offered* at all (App Home buttons, the
 * cron auto-update), independent of the mock/live seam — a surface can be
 * enabled but still run fully mocked. Default ON; set `TEMPO_<FLAG>=off` (or
 * `false`/`0`) to hide it. Kept intentionally tiny — a real flag seam per
 * Part IV without a config framework.
 */

import { opt } from "./env.js";

function flag(name: string, dflt: boolean): boolean {
  const v = opt(name);
  if (v === undefined) return dflt;
  return !/^(off|false|0|no)$/i.test(v);
}

export const flags = {
  /** Tempo Canvas — the living personal command center (canvases.create/edit). */
  canvas: flag("TEMPO_CANVAS", true),
  /** Slack Lists sync of the Commitment Ledger. */
  lists: flag("TEMPO_LISTS", true),
  /** Proactive intelligence (v3.4) — opt-in overload heads-up + smart batching
   * in the morning digest. Default OFF: proactive care is opt-in. */
  proactive: flag("TEMPO_PROACTIVE", false),
  /** Team & manager mode (v3.6) — opt-in, aggregated + anonymized team view.
   * Default OFF: the personal-agent posture is the default. */
  team: flag("TEMPO_TEAM", false),
} as const;
