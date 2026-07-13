/**
 * Reset the live demo state between video takes.
 *
 * The Focus Guardian really does flip Do-Not-Disturb and set a status — which
 * means once you've demoed it, it stays on, and the next take can't show the
 * moon icon *appearing*. That reveal is the money shot: it's the moment the
 * agent stops talking and actually does something.
 *
 *   npm run reset:demo
 *
 * Clears DND + status only. Touches nothing else — no messages, no commitments,
 * no stored data.
 */

import "dotenv/config";
import { WebClient } from "@slack/web-api";

const userToken = process.env.SLACK_USER_TOKEN;
if (!userToken) {
  console.error("SLACK_USER_TOKEN is not set — nothing to reset.");
  process.exit(1);
}

const web = new WebClient(userToken);

async function main(): Promise<void> {
  // dnd:write covers endSnooze; a "snooze not active" error just means we're
  // already clean, which is a success for our purposes.
  try {
    await web.dnd.endSnooze();
    console.log("  ✅ Do-Not-Disturb cleared");
  } catch (err) {
    const msg = (err as { data?: { error?: string } })?.data?.error;
    if (msg === "snooze_not_active") console.log("  ✅ Do-Not-Disturb was already off");
    else throw err;
  }

  await web.users.profile.set({
    profile: JSON.stringify({ status_text: "", status_emoji: "", status_expiration: 0 }),
  });
  console.log("  ✅ Focus status cleared");

  console.log("\n🎬 Ready for another take — 'block 2 hours' will show the moon icon appear.");
}

main().catch((err) => {
  console.error("reset failed:", err);
  process.exit(1);
});
