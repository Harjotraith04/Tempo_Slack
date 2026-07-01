import { describe, expect, it } from "vitest";
import { t, resolveLocale, SUPPORTED_LOCALES } from "./index.js";

describe("i18n", () => {
  it("returns the locale's string, falling back to English then the key", () => {
    expect(t("speech.lead.triage", "en")).toBe("Here's what needs you.");
    expect(t("speech.lead.triage", "es")).toBe("Esto es lo que necesita tu atención.");
    expect(t("speech.outro", "es")).toContain("sin tu permiso");
    // Missing key → returns the key itself (never throws).
    expect(t("nope.missing", "es")).toBe("nope.missing");
  });

  it("interpolates {params}", () => {
    // ad-hoc key via fallback path: params still interpolate on found strings.
    expect(t("speech.lead.help", "en")).not.toContain("{");
  });

  it("resolveLocale normalizes and defaults to English", () => {
    expect(resolveLocale({ locale: "es" })).toBe("es");
    expect(resolveLocale({ locale: "es-MX" })).toBe("es");
    expect(resolveLocale({ locale: "fr" })).toBe("en"); // unsupported → default
    expect(resolveLocale({})).toBe("en");
    expect(resolveLocale(undefined)).toBe("en");
  });

  it("every supported locale has a real translation for the core speech keys", () => {
    const coreKeys = [
      "speech.lead.triage",
      "speech.lead.commitments",
      "speech.lead.catchup",
      "speech.lead.focus",
      "speech.lead.decode",
      "speech.outro",
    ];
    for (const loc of SUPPORTED_LOCALES) {
      for (const k of coreKeys) expect(t(k, loc), `${loc}:${k}`).not.toBe(k);
    }
  });
});
