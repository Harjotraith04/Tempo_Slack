/**
 * /privacy — "everything Tempo stores about you", with export and delete.
 *
 * The honesty page: it lists the complete record, so the claim that Tempo never
 * persists what it reads is something a user can check rather than take on
 * trust. Routed from `/privacy` by a rewrite in vercel.json.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { assertVercelRuntime } from "../../src/config.js";
import { getStore } from "../../src/platform/persistence/index.js";
import { exportUserData } from "../../src/application/use-cases/user-data.js";
import { userIdFromCookieHeader } from "../../src/shared/session.js";
import { esc, html, page, redirect } from "../../src/platform/web/render.js";

const row = (label: string, value: string) =>
  `<div class="row"><span>${esc(label)}</span><span class="muted">${esc(value)}</span></div>`;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  assertVercelRuntime();

  const userId = userIdFromCookieHeader(req.headers.cookie);
  if (!userId) return redirect(res, "/api/oauth/start");

  const d = await exportUserData(getStore(), userId);
  const p = d.prefs;
  const m = d.metrics;

  const stored = [
    row(
      "Slack connection",
      d.installedTeam
        ? `team ${d.installedTeam.teamId} · connected ${new Date(d.installedTeam.installedAt * 1000).toLocaleDateString()}`
        : "not connected",
    ),
    row("Access token", "stored, encrypted (AES-256-GCM) — never shown or exported"),
    // "The complete record" has to actually BE complete.
    //
    // This page listed four preference fields and called itself the complete
    // record, while the JSON export beside it returned eleven. A transparency page
    // that under-reports is the single most damaging thing this product could ship:
    // the whole pitch is "check the claim rather than trust it", and the first
    // person to check would have caught us short. Every field in UserPrefs is here.
    row(
      "Preferences · reading",
      p
        ? `verbosity ${p.verbosity ?? "standard"} · reading level ${p.readingLevel ?? "standard"} · max ${p.maxItems ?? 3} items · language ${p.locale ?? "en"}`
        : "none saved",
    ),
    row(
      "Preferences · focus",
      p
        ? `read-aloud ${p.readAloud ? "on" : "off"} · default focus ${p.focusDefaultMins ?? "—"} min · default DND ${p.dndDefaultMins ?? "—"} min`
        : "none saved",
    ),
    row(
      "Consent · channels Tempo may read",
      p?.watchedChannels?.length
        ? `${p.watchedChannels.length} channel(s) you chose — Tempo reads nowhere else`
        : "every channel you can already see (no filter set)",
    ),
    row(
      "Consent · people Tempo ignores",
      p?.mutedUsers?.length ? `${p.mutedUsers.length} muted` : "nobody muted",
    ),
    row(
      "Weekly impact (counts only)",
      m
        ? `${m.messagesTriaged} triaged · ${m.obligationsSurfaced} obligations · ${m.focusMinutesProtected} focus min · ${m.itemsRecovered} recovered`
        : "none yet",
    ),
    row(
      "Native surface ids",
      d.surfaces ? `canvas ${d.surfaces.canvasId ?? "—"}, list ${d.surfaces.listId ?? "—"}` : "none",
    ),
    row("Pinned commitments", `${d.commitments.length} (derived facts, no message text)`),
    row("Snoozed / done items", `${d.snoozes.length} (permalink + status only)`),
    row(
      "Learned sender signals",
      `${d.senderSignals.length} (per-sender counts only — how often you engaged, never what was said)`,
    ),
    row(
      "Activity timestamps",
      [
        p?.lastActiveTs ? `last active ${new Date(p.lastActiveTs * 1000).toLocaleDateString()}` : null,
        p?.onboardedAt ? `onboarded ${new Date(p.onboardedAt * 1000).toLocaleDateString()}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "none",
    ),
  ].join("");

  // `what` and `counterparty` are free text lifted from Slack messages — the one
  // genuinely untrusted input on this page. esc() is doing real work here.
  const commitments = d.commitments.length
    ? `<h2>Your pinned commitments</h2><div class="card">${d.commitments
        .map((c) =>
          row(
            c.what,
            `${c.direction === "i_owe" ? "you owe" : "owed to you"} · ${c.counterparty} · ${c.status}`,
          ),
        )
        .join("")}</div>`
    : "";

  html(
    res,
    page(
      "Your data",
      `<h2>Everything Tempo stores about you</h2>
<p>This is the complete record. It is <strong>only</strong> tokens, preferences, and facts Tempo derived —
<strong>never the messages, files, or channels it read</strong> (those are searched live and discarded).</p>

<div class="card">${stored}</div>
${commitments}

<h2>Your data rights</h2>
<p><a class="btn" href="/api/data/export">Download my data (JSON)</a></p>
<form action="/api/data/delete" method="post" class="card">
  <p><strong>Delete everything.</strong> This permanently erases your token, preferences, commitments,
  snoozes, metrics, and surface ids, and signs you out. It cannot be undone.</p>
  <button class="btn danger" type="submit">Delete all my data</button>
</form>

<p class="muted"><a href="/privacy-policy">Read the full privacy policy</a> ·
<a href="/settings">Settings</a></p>`,
    ),
  );
}
