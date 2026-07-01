import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { getStore } from "@/lib/domain";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { saved?: string };
}) {
  const userId = currentUserId();
  if (!userId) redirect("/");

  const prefs = await getStore().prefs.get(userId);
  const sel = <T,>(v: T | undefined, fallback: T) => (v ?? fallback);

  return (
    <section aria-labelledby="settings-h">
      <h2 id="settings-h">Settings</h2>
      <p>The same accessibility preferences as the Slack App Home — Tempo adapts every reply to these.</p>
      {searchParams.saved && (
        <p className="card" role="status">
          ✅ Saved.
        </p>
      )}

      <form action="/api/settings" method="post">
        <label htmlFor="verbosity">Verbosity</label>
        <select id="verbosity" name="verbosity" defaultValue={sel(prefs?.verbosity, "standard")}>
          <option value="standard">Standard</option>
          <option value="brief">Brief</option>
        </select>

        <label htmlFor="readingLevel">Reading level</label>
        <select id="readingLevel" name="readingLevel" defaultValue={sel(prefs?.readingLevel, "standard")}>
          <option value="standard">Standard</option>
          <option value="plain">Plain (short sentences, one idea per line)</option>
        </select>

        <label htmlFor="locale">Language</label>
        <select id="locale" name="locale" defaultValue={sel(prefs?.locale, "en")}>
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>

        <label htmlFor="maxItems">Max items per card</label>
        <select id="maxItems" name="maxItems" defaultValue={String(sel(prefs?.maxItems, 3))}>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="5">5</option>
        </select>

        <label htmlFor="focusDefaultMins">Default focus length (minutes, blank to clear)</label>
        <input id="focusDefaultMins" name="focusDefaultMins" type="number" min={5} max={480} defaultValue={prefs?.focusDefaultMins ?? ""} />

        <label htmlFor="dndDefaultMins">Default DND length (minutes, blank to clear)</label>
        <input id="dndDefaultMins" name="dndDefaultMins" type="number" min={5} max={480} defaultValue={prefs?.dndDefaultMins ?? ""} />

        <label className="check" style={{ marginTop: 20 }}>
          <input type="checkbox" name="readAloud" value="on" defaultChecked={!!prefs?.readAloud} />
          Read replies aloud (send an audio version by DM)
        </label>

        <p style={{ marginTop: 24 }}>
          <button className="btn" type="submit">
            Save settings
          </button>
        </p>
      </form>
    </section>
  );
}
