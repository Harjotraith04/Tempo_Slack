/**
 * /privacy-policy — public, no auth. A Marketplace listing requires a reachable
 * privacy-policy URL, and a judge assessing an assistive-tech app will read it.
 * Routed from `/privacy-policy` by a rewrite in vercel.json.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { esc, html, page } from "../../src/platform/web/render.js";

const ISSUES = "https://github.com/Harjotraith04/Tempo_Slack/issues";

const stored: [what: string, why: string, note: string][] = [
  ["Your OAuth token", "to run search + your own actions as you", "encrypted (AES-256-GCM)"],
  ["Preferences", "verbosity, reading level, read-aloud, focus/DND defaults", "settings only"],
  ["Pinned commitments", "the promises you track", "derived facts, no message text"],
  ["Snoozes / done", "which items you dismissed", "permalink + status only"],
  ["Usage metrics", "your weekly impact", "counts only"],
  ["Learned signals", "tune your ranking from your taps", "per-sender counts only"],
  ["Surface ids", "your Tempo Canvas / List handles", "ids, not content"],
];

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  const rows = stored
    .map(
      ([what, why, note]) =>
        `<div class="row"><span><strong>${esc(what)}</strong> — ${esc(why)}</span><span class="muted">${esc(note)}</span></div>`,
    )
    .join("");

  html(
    res,
    page(
      "Privacy Policy",
      `<h2>Privacy Policy</h2>
<p class="muted">A truthful description of how Tempo handles data. Not legal advice.</p>

<p>Tempo is a <strong>personal assistant on your own data</strong> — not surveillance of your coworkers.
Two rules govern everything:</p>

<div class="card">
  <p><strong>1. Tempo never stores what it reads.</strong> It grounds its reasoning <em>live</em> in Slack
  (Real-Time Search) with your own token, uses the results in memory to answer you, and discards them.
  No message, file, channel, or thread content is ever written to disk or a database.</p>
  <p><strong>2. Tempo never acts without your tap.</strong> It proposes; you approve. Nothing is sent or
  changed on your behalf without an explicit action from you.</p>
</div>

<h2>What Tempo stores</h2>
<div class="card">${rows}</div>

<h2>What Tempo never stores</h2>
<p>Any message, file, channel, or thread content from Slack. Conversation transcripts. Anything you didn't
explicitly approve. This is enforced structurally and by automated tests.</p>

<h2>Your rights</h2>
<p>See exactly what's stored, download all of it as JSON, or delete everything (which also signs you out)
from your <a href="/privacy">privacy dashboard</a>. Access, export, and erasure are covered for every
category we keep.</p>

<h2>Permissions</h2>
<p>Tempo requests only the scopes it actually uses; search runs on your own token, scoped to exactly what
you can already see.</p>

<p class="muted">Data questions: <a href="${esc(ISSUES)}">open an issue</a>. You never need to ask us to
export or delete — both are buttons on your <a href="/privacy">privacy dashboard</a>.</p>

<p><a class="btn secondary" href="/">← Back</a></p>`,
    ),
  );
}
