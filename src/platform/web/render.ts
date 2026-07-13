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
 * The page shell. Shares the design tokens in `public/index.html` so the
 * dashboard and the landing page read as one product.
 */
export function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} — Tempo</title>
<style>
  :root {
    color-scheme: light dark;
    --bg:#fff; --fg:#1d1c1d; --muted:#5c5a58; --line:#e6e3e0;
    --accent:#4a154b; --accent-fg:#fff; --card:#faf9f8; --danger:#b91c1c;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg:#12100f; --fg:#f5f4f2; --muted:#a8a29e; --line:#2a2725;
      --accent:#d6b8ff; --accent-fg:#12100f; --card:#1a1817; --danger:#f87171;
    }
  }
  *{box-sizing:border-box}
  body{margin:0;padding:3rem 1.5rem 5rem;background:var(--bg);color:var(--fg);
    font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    -webkit-font-smoothing:antialiased}
  main{max-width:720px;margin:0 auto}
  a{color:var(--accent)}
  h1{font-size:1.1rem;margin:0 0 2rem;letter-spacing:-0.01em}
  h1 a{color:var(--fg);text-decoration:none;font-weight:700}
  h2{font-size:1.5rem;letter-spacing:-0.02em;margin:2.5rem 0 .75rem}
  h2:first-of-type{margin-top:0}
  p{margin:0 0 1rem}
  .muted{color:var(--muted)}
  .card{background:var(--card);border:1px solid var(--line);border-radius:12px;
    padding:1.25rem 1.4rem;margin:1rem 0}
  .card p:last-child{margin-bottom:0}
  .row{display:flex;flex-wrap:wrap;gap:.5rem 1rem;justify-content:space-between;
    padding:.6rem 0;border-bottom:1px solid var(--line)}
  .row:last-child{border-bottom:0}
  .row span:first-child{font-weight:600}
  .row span:last-child{text-align:right}
  .btn{display:inline-block;background:var(--accent);color:var(--accent-fg);
    text-decoration:none;font-weight:600;font-size:1rem;padding:.7rem 1.3rem;
    border:0;border-radius:8px;cursor:pointer;font-family:inherit}
  .btn:hover{opacity:.88}
  .btn.secondary{background:transparent;color:var(--fg);border:1px solid var(--line)}
  .btn.danger{background:var(--danger);color:#fff}
  label{display:block;font-weight:600;margin:1.25rem 0 .35rem}
  select,input[type=number]{width:100%;padding:.6rem;border:1px solid var(--line);
    border-radius:8px;background:var(--bg);color:var(--fg);font:inherit}
  label.check{display:flex;gap:.6rem;align-items:center;font-weight:400}
  label.check input{width:auto}
  :focus-visible{outline:2px solid var(--accent);outline-offset:2px}
</style>
</head>
<body>
<main>
<h1><a href="/">Tempo</a></h1>
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
