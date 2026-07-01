/**
 * Team & manager mode use-case (v3.6) — gather the opt-in roster's counts-only
 * data and hand it to the pure, anonymizing aggregator. The roster IS the
 * opt-in: nobody is included unless explicitly listed (config.team.members).
 * No user id ever reaches the caller — only the anonymized aggregate.
 */

import type { Store } from "../../ports/store.js";
import { aggregateTeamLoad, type TeamLoadResult, type TeamMemberData } from "../../modules/team/index.js";

export async function teamLoad(
  store: Store,
  roster: string[],
  minMembers?: number,
): Promise<TeamLoadResult> {
  const members: TeamMemberData[] = await Promise.all(
    roster.map(async (userId) => ({
      metrics: await store.metrics.get(userId),
      signals: await store.signals.forUser(userId),
    })),
  );
  return aggregateTeamLoad(members, { minMembers });
}
