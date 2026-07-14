/**
 * The web dashboard's rendering primitives.
 *
 * Tempo's dashboard (/privacy, /settings, /privacy-policy) is three server-
 * rendered HTML forms. It used to be a whole Next.js + React app in its own
 * Vercel project — for pages with no client interactivity at all. Now it's
 * plain Node handlers under `api/`, the same shape as every other entrypoint
 * here, and this module is all the "framework" they need.
 *
 * SECURITY: React escaped interpolated values for free; hand-written HTML does
 * not. Pinned commitments carry free text pulled straight from Slack, so every
 * value interpolated into markup MUST go through `esc()`. That's a trust
 * boundary, and `render.test.ts` guards it.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

/** HTML-escape a value for interpolation into markup or an attribute. */
export function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The page shell.
 *
 * The design tokens, base type, buttons and focus styles live in ONE place —
 * `public/tempo.css`, shared with the landing page. This used to be a second
 * copy of that token block, and two copies drift. What stays here is only what
 * the dashboard alone needs: its narrow measure and its form controls.
 */
export function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} — Tempo</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="preload" href="/fonts/lexend-latin.woff2" as="font" type="font/woff2" crossorigin />
<link rel="stylesheet" href="/tempo.css" />
<style>
  body{padding:3rem 1.5rem 5rem}
  main{max-width:720px;margin:0 auto}
  h1{font-size:1.1rem;margin:0 0 2rem}
  h1 a{color:var(--fg);text-decoration:none;font-weight:700;display:inline-flex;
    align-items:center;gap:.5rem}
  h1 svg{width:24px;height:24px;border-radius:7px}
  h2{font-size:1.5rem;margin:2.5rem 0 .75rem}
  h2:first-of-type{margin-top:0}
  p{margin:0 0 1rem}
  .card{margin:1rem 0}
  .card p:last-child{margin-bottom:0}
  .row{display:flex;flex-wrap:wrap;gap:.5rem 1rem;justify-content:space-between;
    padding:.6rem 0;border-bottom:1px solid var(--line)}
  .row:last-child{border-bottom:0}
  .row span:first-child{font-weight:600}
  .row span:last-child{text-align:right}
  label{display:block;font-weight:600;margin:1.25rem 0 .35rem}
  select,input[type=number]{width:100%;min-height:44px;padding:.6rem;
    border:1px solid var(--line);border-radius:8px;background:var(--bg);
    color:var(--fg);font:inherit}
  label.check{display:flex;gap:.6rem;align-items:center;font-weight:400}
  label.check input{width:auto;min-height:0}
</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<main id="main">
<h1><a href="/"><svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><rect width="64" height="64" rx="15" fill="#4a154b"/><g fill="#fff"><rect x="15" y="34" width="7" height="15" rx="3.5" opacity=".45"/><rect x="28.5" y="26" width="7" height="23" rx="3.5" opacity=".72"/><rect x="42" y="15" width="7" height="34" rx="3.5"/></g></svg>Tempo</a></h1>
${body}
</main>
</body>
</html>`;
}

export function html(res: ServerResponse, body: string, status = 200): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(body);
}

/** Send the visitor to sign in, preserving nothing — the landing page is public. */
export function redirect(res: ServerResponse, location: string, status = 302): void {
  res.statusCode = status;
  res.setHeader("Location", location);
  res.end();
}

/**
 * Parse an `application/x-www-form-urlencoded` POST body.
 * Vercel may pre-parse the body, so handle both shapes — same defensive read as
 * `api/mcp/server.ts`.
 */
export async function readForm(req: IncomingMessage): Promise<Record<string, string>> {
  const pre = (req as unknown as { body?: unknown }).body;
  if (pre && typeof pre === "object") {
    return Object.fromEntries(
      Object.entries(pre as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
    );
  }
  const raw =
    typeof pre === "string"
      ? pre
      : await new Promise<string>((resolve, reject) => {
          const chunks: Buffer[] = [];
          req.on("data", (c: Buffer) => chunks.push(c));
          req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
          req.on("error", reject);
        });
  return Object.fromEntries(new URLSearchParams(raw));
}
