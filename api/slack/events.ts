/**
 * Vercel HTTP entrypoint for all Slack traffic (events, interactivity, commands).
 * Point the Slack app's Request URLs at https://<deployment>/api/slack/events.
 *
 * Uses `@vercel/slack-bolt` (see src/main/vercel.ts): the receiver acks Slack
 * within its 3-second deadline and finishes the real RTS/LLM work in the
 * background via `waitUntil`. Startup assertions (secrets hardening, no file
 * store on the read-only FS) run at module init — a misconfigured deploy
 * crashes loudly in the function logs instead of failing open.
 */

import { createVercelHandler } from "../../src/main/vercel.js";

export default createVercelHandler();
