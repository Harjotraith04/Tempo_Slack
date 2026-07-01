import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { exportUserData, getStore } from "@/lib/domain";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="row">
      <span>{label}</span>
      <span className="muted">{value}</span>
    </div>
  );
}

export default async function PrivacyPage() {
  const userId = currentUserId();
  if (!userId) redirect("/");

  const data = await exportUserData(getStore(), userId);
  const m = data.metrics;

  return (
    <section aria-labelledby="privacy-h">
      <h2 id="privacy-h">Everything Tempo stores about you</h2>
      <p>
        This is the complete record. It is <strong>only</strong> tokens, preferences, and facts Tempo
        derived — <strong>never the messages, files, or channels it read</strong> (those are searched live
        and discarded).
      </p>

      <div className="card">
        <Row
          label="Slack connection"
          value={
            data.installedTeam
              ? `team ${data.installedTeam.teamId} · connected ${new Date(data.installedTeam.installedAt * 1000).toLocaleDateString()}`
              : "not connected"
          }
        />
        <Row label="Access token" value="stored, encrypted (AES-256-GCM) — never shown or exported" />
        <Row
          label="Preferences"
          value={
            data.prefs
              ? `verbosity ${data.prefs.verbosity ?? "standard"}, reading ${data.prefs.readingLevel ?? "standard"}, max ${data.prefs.maxItems ?? 3}, read-aloud ${data.prefs.readAloud ? "on" : "off"}`
              : "none saved"
          }
        />
        <Row
          label="Weekly impact (counts only)"
          value={
            m
              ? `${m.messagesTriaged} triaged · ${m.obligationsSurfaced} obligations · ${m.focusMinutesProtected} focus min · ${m.itemsRecovered} recovered`
              : "none yet"
          }
        />
        <Row label="Native surface ids" value={data.surfaces ? `canvas ${data.surfaces.canvasId ?? "—"}, list ${data.surfaces.listId ?? "—"}` : "none"} />
        <Row label="Pinned commitments" value={`${data.commitments.length} (derived facts, no message text)`} />
        <Row label="Snoozed / done items" value={`${data.snoozes.length} (permalink + status only)`} />
      </div>

      {data.commitments.length > 0 && (
        <>
          <h2>Your pinned commitments</h2>
          <div className="card">
            {data.commitments.map((c) => (
              <Row
                key={c.permalink}
                label={c.what}
                value={`${c.direction === "i_owe" ? "you owe" : "owed to you"} · ${c.counterparty} · ${c.status}`}
              />
            ))}
          </div>
        </>
      )}

      <h2>Your data rights</h2>
      <p>
        <a className="btn" href="/api/data/export">
          Download my data (JSON)
        </a>
      </p>
      <form action="/api/data/delete" method="post" className="card">
        <p>
          <strong>Delete everything.</strong> This permanently erases your token, preferences, commitments,
          snoozes, metrics, and surface ids, and signs you out. It cannot be undone.
        </p>
        <button className="btn danger" type="submit">
          Delete all my data
        </button>
      </form>

      <p className="muted" style={{ marginTop: 24 }}>
        <Link href="/privacy-policy">Read the full privacy policy</Link>
      </p>
    </section>
  );
}
