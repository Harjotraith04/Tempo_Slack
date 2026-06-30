/**
 * Local dev entrypoint. Socket Mode by default (no public URL needed):
 *   npm run dev
 * Set TEMPO_RECEIVER=http PORT=3000 to run the HTTP receiver locally instead.
 */

import { createApp } from "./app.js";
import { config } from "./config.js";

const app = createApp();

if (config.runtime.receiver === "socket") {
  await app.start();
} else {
  await app.start(config.runtime.port);
}

console.log(
  `⚡ Tempo is running (receiver=${config.runtime.receiver}, RTS=${config.runtime.rts}, AI=${config.ai.mode})`,
);
console.log("Open the Tempo assistant pane in Slack, or run /tempo triage.");
