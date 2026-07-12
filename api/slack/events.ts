/**
 * Vercel HTTP entrypoint for all Slack traffic (events, interactivity, commands).
 * Point the Slack app's Request URLs at https://<deployment>/api/slack/events.
 *
 * Uses `@vercel/slack-bolt` (see src/main/vercel.ts): the receiver acks Slack
 * within its 3-second deadline and finishes the real RTS/LLM work in the
 * background via `waitUntil`. Startup assertions (secrets hardening, no file
 * store on the read-only FS) run at module init — a misconfigured deploy
 * crashes loudly in the function logs instead of failing open.
 *
 * EXPORTED AS `POST`, NOT `default`. createHandler() returns a web-standard
 * `(Request) => Promise<Response>`. Vercel's Node runtime treats a *default*
 * export as the legacy `(req, res) => void` signature and silently DISCARDS the
 * returned Response — the function then hangs until the 300s timeout instead of
 * replying to Slack. A named HTTP-method export selects the fetch-style API.
 * Slack only ever POSTs here (events, interactivity, and slash commands).
 */

import { createVercelHandler } from "../../src/main/vercel.js";

export const POST = createVercelHandler();
