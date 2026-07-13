import Link from "next/link";

export const metadata = { title: "Tempo — Privacy Policy" };

// Public, no auth — Marketplace requires a reachable privacy-policy URL.
function Stored({ label, why, note }: { label: string; why: string; note: string }) {
  return (
    <div className="row">
      <span>
        <strong>{label}</strong> — {why}
      </span>
      <span className="muted">{note}</span>
    </div>
  );
}

export default function PrivacyPolicy() {
  return (
    <section aria-labelledby="pp">
      <h2 id="pp">Privacy Policy</h2>
      <p className="muted">A truthful description of how Tempo handles data. Not legal advice.</p>

      <p>
        Tempo is a <strong>personal assistant on your own data</strong> — not surveillance of your coworkers.
        Two rules govern everything:
      </p>
      <div className="card">
        <p>
          <strong>1. Tempo never stores what it reads.</strong> It grounds its reasoning <em>live</em> in Slack
          (Real-Time Search) with your own token, uses the results in memory to answer you, and discards them.
          No message, file, channel, or thread content is ever written to disk or a database.
        </p>
        <p>
          <strong>2. Tempo never acts without your tap.</strong> It proposes; you approve. Nothing is sent or
          changed on your behalf without an explicit action from you.
        </p>
      </div>

      <h2>What Tempo stores</h2>
      <div className="card">
        <Stored label="Your OAuth token" why="to run search + your own actions as you" note="encrypted (AES-256-GCM)" />
        <Stored label="Preferences" why="verbosity, reading level, read-aloud, focus/DND defaults" note="settings only" />
        <Stored label="Pinned commitments" why="the promises you track" note="derived facts, no message text" />
        <Stored label="Snoozes / done" why="which items you dismissed" note="permalink + status only" />
        <Stored label="Usage metrics" why="your weekly impact" note="counts only" />
        <Stored label="Learned signals" why="tune your ranking from your taps" note="per-sender counts only" />
        <Stored label="Surface ids" why="your Tempo Canvas / List handles" note="ids, not content" />
      </div>

      <h2>What Tempo never stores</h2>
      <p>
        Any message, file, channel, or thread content from Slack. Conversation transcripts. Anything you didn't
        explicitly approve. This is enforced structurally and by automated tests.
      </p>

      <h2>Your rights</h2>
      <p>
        See exactly what's stored, download all of it as JSON, or delete everything (which also signs you out)
        from your <Link href="/privacy">privacy dashboard</Link>. Access, export, and erasure are covered for
        every category we keep.
      </p>

      <h2>Permissions</h2>
      <p>
        Tempo requests only the scopes it actually uses; search runs on your own token, scoped to exactly what
        you can already see.
      </p>

      <p className="muted">
        Data questions: <a href="https://github.com/Harjotraith04/Tempo_Slack/issues">open an issue</a>. You never need to ask us to export or delete —
        both are buttons on your <a href="/privacy">privacy dashboard</a>.
      </p>
      <p>
        <Link className="btn secondary" href="/">
          ← Back
        </Link>
      </p>
    </section>
  );
}
