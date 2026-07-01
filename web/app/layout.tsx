import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tempo — your data",
  description: "See, export, and delete everything Tempo stores about you.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>
          <header>
            <h1>Tempo</h1>
            <p className="muted">Your working memory for Slack — and full control over your data.</p>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
