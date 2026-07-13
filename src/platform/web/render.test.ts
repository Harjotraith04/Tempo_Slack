/**
 * The dashboard renders hand-written HTML now, not React — so nothing escapes
 * interpolated values for us any more.
 *
 * That matters because the privacy page renders pinned commitments, whose `what`
 * and `counterparty` are free text lifted straight out of Slack messages. Anyone
 * in the workspace can put anything in a message. If esc() ever regresses, the
 * page becomes stored XSS against the one screen whose entire purpose is to be
 * trustworthy.
 */

import { describe, expect, it } from "vitest";
import { esc, page } from "./render.js";

describe("esc", () => {
  it("neutralises a script tag", () => {
    expect(esc(`<script>alert(1)</script>`)).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });

  it("neutralises an attribute breakout", () => {
    // The payload that matters for value="..." in the settings form.
    expect(esc(`" onfocus="alert(1)`)).toBe("&quot; onfocus=&quot;alert(1)");
    expect(esc(`' onfocus='alert(1)`)).toBe("&#39; onfocus=&#39;alert(1)");
  });

  it("escapes ampersands first, so entities can't be smuggled in", () => {
    // Naive ordering would turn "&lt;" into "&lt;" -> a literal "<".
    expect(esc("&lt;script&gt;")).toBe("&amp;lt;script&amp;gt;");
  });

  it("renders empty for null/undefined rather than the string 'null'", () => {
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
  });

  it("leaves ordinary text alone", () => {
    expect(esc("Send Priya the Atlas spec")).toBe("Send Priya the Atlas spec");
  });
});

describe("page", () => {
  it("escapes the title", () => {
    expect(page("<img src=x onerror=alert(1)>", "")).toContain(
      "&lt;img src=x onerror=alert(1)&gt;",
    );
  });

  it("is a complete, self-contained document", () => {
    const out = page("Your data", "<h2>Hello</h2>");
    expect(out.startsWith("<!doctype html>")).toBe(true);
    expect(out).toContain("<h2>Hello</h2>");
    expect(out).toContain("prefers-color-scheme"); // light + dark
  });
});

describe("the XSS payload a commitment could actually carry", () => {
  it("renders inert when a malicious commitment is interpolated", () => {
    // Exactly how api/web/privacy.ts builds a row.
    const evil = `<img src=x onerror=alert(document.cookie)>`;
    const row = `<div class="row"><span>${esc(evil)}</span></div>`;

    expect(row).not.toContain("<img");
    expect(row).toContain("&lt;img src=x onerror=alert(document.cookie)&gt;");
  });
});
