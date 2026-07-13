/**
 * /settings — the same accessibility preferences as the Slack App Home modal,
 * on the web. Both surfaces write through `applySettings`, so they can't drift.
 * Routed from `/settings` by a rewrite in vercel.json; the form POSTs to
 * /api/settings.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { assertVercelRuntime } from "../../src/config.js";
import { getStore } from "../../src/platform/persistence/index.js";
import { userIdFromCookieHeader } from "../../src/shared/session.js";
import { esc, html, page, redirect } from "../../src/platform/web/render.js";

/** Build a <select>, marking the stored value as selected. */
function select(
  name: string,
  label: string,
  options: [value: string, text: string][],
  current: string,
): string {
  const opts = options
    .map(
      ([v, t]) =>
        `<option value="${esc(v)}"${v === current ? " selected" : ""}>${esc(t)}</option>`,
    )
    .join("");
  return `<label for="${esc(name)}">${esc(label)}</label>
<select id="${esc(name)}" name="${esc(name)}">${opts}</select>`;
}

function number(name: string, label: string, value: number | undefined): string {
  return `<label for="${esc(name)}">${esc(label)}</label>
<input id="${esc(name)}" name="${esc(name)}" type="number" min="5" max="480" value="${esc(value ?? "")}" />`;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  assertVercelRuntime();

  const userId = userIdFromCookieHeader(req.headers.cookie);
  if (!userId) return redirect(res, "/api/oauth/start");

  const p = await getStore().prefs.get(userId);
  const saved = new URL(req.url ?? "", "http://localhost").searchParams.has("saved");

  html(
    res,
    page(
      "Settings",
      `<h2>Settings</h2>
<p>The same accessibility preferences as the Slack App Home — Tempo adapts every reply to these.</p>
${saved ? `<p class="card" role="status">✅ Saved.</p>` : ""}

<form action="/api/settings" method="post">
  ${select("verbosity", "Verbosity", [["standard", "Standard"], ["brief", "Brief"]], p?.verbosity ?? "standard")}
  ${select("readingLevel", "Reading level", [["standard", "Standard"], ["plain", "Plain (short sentences, one idea per line)"]], p?.readingLevel ?? "standard")}
  ${select("locale", "Language", [["en", "English"], ["es", "Español"]], p?.locale ?? "en")}
  ${select("maxItems", "Max items per card", [["1", "1"], ["2", "2"], ["3", "3"], ["5", "5"]], String(p?.maxItems ?? 3))}
  ${number("focusDefaultMins", "Default focus length (minutes, blank to clear)", p?.focusDefaultMins)}
  ${number("dndDefaultMins", "Default DND length (minutes, blank to clear)", p?.dndDefaultMins)}

  <label class="check" style="margin-top:20px">
    <input type="checkbox" name="readAloud" value="on"${p?.readAloud ? " checked" : ""} />
    Read replies aloud (send an audio version by DM)
  </label>

  <p style="margin-top:24px"><button class="btn" type="submit">Save settings</button></p>
</form>

<p class="muted"><a href="/privacy">Everything Tempo stores about you →</a></p>`,
    ),
  );
}
