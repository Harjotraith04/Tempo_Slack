/**
 * Fills the deployment URLs in manifest.json in one shot, so going live is a
 * single command instead of hand-editing four placeholders.
 *
 *   npm run manifest:urls -- <app-url> [web-url]
 *   npm run manifest:urls -- https://tempo.vercel.app https://tempo-web.vercel.app
 *
 * <app-url>  fills the three https://YOUR_DEPLOYMENT/... slots (OAuth callback,
 *            event subscriptions, interactivity).
 * [web-url]  fills the one https://YOUR_WEB_DEPLOYMENT/... slot (the web
 *            companion's OAuth callback). Defaults to <app-url> if omitted.
 *
 * URLs may be given with or without the scheme (https:// is assumed) and any
 * trailing slash is trimmed. Falls back to the PUBLIC_URL / WEB_PUBLIC_URL env
 * vars when no args are passed.
 *
 * `--check` (or no URL available) reports whether any placeholder remains and
 * exits non-zero if so — used by `npm run preflight` to prove the manifest is
 * either still a clean template or fully filled, never half-done.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST = resolve(HERE, "../manifest.json");

const APP_PLACEHOLDER = "https://YOUR_DEPLOYMENT";
const WEB_PLACEHOLDER = "https://YOUR_WEB_DEPLOYMENT";

/** `example.com/` → `https://example.com` (scheme added, trailing slash trimmed). */
function normalizeBase(url: string): string {
  const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  return withScheme.replace(/\/+$/, "");
}

function remainingPlaceholders(text: string): string[] {
  return [APP_PLACEHOLDER, WEB_PLACEHOLDER].filter((p) => text.includes(p));
}

function main(): void {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const checkOnly = args.includes("--check");
  const urls = args.filter((a) => !a.startsWith("--"));

  const original = readFileSync(MANIFEST, "utf8");

  if (checkOnly) {
    const left = remainingPlaceholders(original);
    if (left.length) {
      console.error(
        `manifest.json still has ${left.length} placeholder(s): ${left.join(", ")}.\n` +
          "Fill them before deploy: npm run manifest:urls -- <app-url> [web-url]",
      );
      process.exit(1);
    }
    console.log("manifest.json has no deployment placeholders remaining. ✓");
    return;
  }

  const appUrl = urls[0] ?? process.env.PUBLIC_URL;
  const webUrl = urls[1] ?? process.env.WEB_PUBLIC_URL ?? appUrl;
  if (!appUrl) {
    console.error(
      "Usage: npm run manifest:urls -- <app-url> [web-url]\n" +
        "   or set PUBLIC_URL (and optionally WEB_PUBLIC_URL) in the environment.\n" +
        "Add --check to only report whether placeholders remain.",
    );
    process.exit(1);
  }

  const appBase = normalizeBase(appUrl);
  const webBase = normalizeBase(webUrl!);

  // Replace the web placeholder first (its host token differs from the app's),
  // then the app placeholder for the three remaining slots. Raw-text replace
  // keeps the file's exact formatting.
  const updated = original.split(WEB_PLACEHOLDER).join(webBase).split(APP_PLACEHOLDER).join(appBase);

  if (updated === original) {
    console.log("No placeholders found — manifest.json already points at real URLs. Nothing changed.");
    return;
  }

  writeFileSync(MANIFEST, updated);
  console.log(
    `manifest.json updated:\n  app → ${appBase}\n  web → ${webBase}\n` +
      "Copy it into your Slack app (Settings → App Manifest) and reinstall.",
  );
}

main();
