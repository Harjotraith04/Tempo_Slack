import Link from "next/link";
import { currentUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function Home() {
  const userId = currentUserId();
  return (
    <section aria-labelledby="welcome">
      <h2 id="welcome">{userId ? "You're signed in" : "Sign in to manage your data"}</h2>
      {userId ? (
        <>
          <p>
            Signed in as <code>{userId}</code>. Tempo only ever acts with your own permissions, and{" "}
            <strong>never stores what it reads</strong> from Slack.
          </p>
          <p className="card">
            <Link className="btn" href="/privacy">
              View my data &amp; privacy
            </Link>{" "}
            <Link className="btn secondary" href="/settings">
              Settings
            </Link>
          </p>
        </>
      ) : (
        <>
          <p>
            Connect with Slack to see exactly what Tempo has stored about you, export it, delete it, or
            change your accessibility settings.
          </p>
          <p>
            <a className="btn" href="/api/oauth/start">
              Sign in with Slack
            </a>
          </p>
        </>
      )}
    </section>
  );
}
