/**
 * Vercel HTTP entrypoint for all Slack traffic (events, interactivity, commands).
 * Point the Slack app's Request URLs at https://<deployment>/api/slack/events.
 *
 * Exports the Bolt ExpressReceiver's Express app, which Vercel serves directly.
 */

import { createExpressApp } from "../../src/main/app.js";

export default createExpressApp();
