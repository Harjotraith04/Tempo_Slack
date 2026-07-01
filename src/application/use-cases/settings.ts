/**
 * Web settings use-case (v2.6) — maps the web companion's prefs form to a
 * `PrefsRepo` patch, mirroring the Slack settings-modal parser
 * (`parseSettingsSubmission` in `src/main/app.ts`) so both surfaces write the
 * same preferences the same way. Blank numeric fields clear the stored value,
 * exactly like the modal.
 */

import type { Store, UserPrefs } from "../../ports/store.js";

export type SettingsForm = Record<string, string | undefined>;
type PrefsPatch = Partial<Omit<UserPrefs, "userId" | "updatedAt">>;

function optNum(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const t = v.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Parse a submitted settings form into a validated prefs patch. */
export function parseSettingsForm(form: SettingsForm): PrefsPatch {
  const patch: PrefsPatch = {};

  if (form.verbosity === "brief" || form.verbosity === "standard") patch.verbosity = form.verbosity;
  if (form.readingLevel === "plain" || form.readingLevel === "standard") patch.readingLevel = form.readingLevel;
  if (form.locale === "en" || form.locale === "es") patch.locale = form.locale;

  const maxItems = optNum(form.maxItems);
  if (maxItems !== undefined) patch.maxItems = maxItems;

  // Blank clears the stored default (mirrors the Slack modal's behavior).
  patch.focusDefaultMins = optNum(form.focusDefaultMins);
  patch.dndDefaultMins = optNum(form.dndDefaultMins);

  // Checkboxes arrive as "on"/"true" when ticked, absent otherwise.
  patch.readAloud = form.readAloud === "on" || form.readAloud === "true";

  return patch;
}

/** Persist a settings form for the user and return the resulting prefs. */
export async function applySettings(store: Store, userId: string, form: SettingsForm): Promise<UserPrefs> {
  return store.prefs.save(userId, parseSettingsForm(form));
}
