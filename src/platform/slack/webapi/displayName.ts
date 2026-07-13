/**
 * Resolve a Slack user's own display name — the name every module's prompt is
 * written for ("classify each message for the user X", "draft on behalf of X").
 *
 * This has to be whoever is actually asking. A hardcoded persona would triage a
 * stranger's Slack as if they were someone else, and sign drafts in their name.
 *
 * Cached process-wide: a display name is stable, and this sits on the hot path
 * of every turn (Bolt handlers, the morning-digest cron, the inbound MCP server
 * — all three resolve through here).
 *
 * Needs the `users:read` bot scope.
 */

import type { WebClient } from "@slack/web-api";

/** Neutral fallback. An unresolvable name must degrade to a pronoun, never to a
 * stand-in identity — being wrong about who the user is, is worse than being vague. */
export const UNKNOWN_NAME = "them";

const cache = new Map<string, string>();

export async function resolveDisplayName(
  client: Pick<WebClient, "users">,
  userId: string,
): Promise<string> {
  const hit = cache.get(userId);
  if (hit) return hit;
  try {
    const res = (await client.users.info({ user: userId })) as {
      user?: {
        name?: string;
        real_name?: string;
        profile?: { real_name?: string; display_name?: string };
      };
    };
    const p = res.user?.profile;
    const name =
      p?.real_name || p?.display_name || res.user?.real_name || res.user?.name;
    if (name) {
      cache.set(userId, name);
      return name;
    }
  } catch (err) {
    console.error(`users.info failed for ${userId}; using a neutral name`, err);
  }
  return UNKNOWN_NAME;
}

/** Tests only — the cache is process-wide by design. */
export function clearDisplayNameCache(): void {
  cache.clear();
}
