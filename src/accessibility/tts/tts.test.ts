import { afterEach, describe, expect, it, vi } from "vitest";
import { MockTtsClient } from "./mock.js";

describe("MockTtsClient", () => {
  it("synthesizes deterministic, valid WAV bytes from text", async () => {
    const client = new MockTtsClient();
    const a = await client.synthesize({ text: "3 things need you today" });
    const b = await client.synthesize({ text: "3 things need you today" });

    expect(a.ok).toBe(true);
    expect(a.mimeType).toBe("audio/wav");
    expect(a.audioBase64).toBe(b.audioBase64); // deterministic for the same input

    const bytes = Buffer.from(a.audioBase64!, "base64");
    expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(bytes.subarray(8, 12).toString("ascii")).toBe("WAVE");
  });

  it("scales duration with text length but stays bounded", async () => {
    const client = new MockTtsClient();
    const short = await client.synthesize({ text: "hi" });
    const long = await client.synthesize({ text: "word ".repeat(200) });

    const shortBytes = Buffer.from(short.audioBase64!, "base64").length;
    const longBytes = Buffer.from(long.audioBase64!, "base64").length;
    expect(longBytes).toBeGreaterThan(shortBytes);
  });
});

describe("LiveTtsClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls OpenAI's speech endpoint and returns base64 audio", async () => {
    const { LiveTtsClient } = await import("./live.js");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode("fake-mp3-bytes").buffer,
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new LiveTtsClient({ apiKey: "sk-test", voice: "alloy" });
    const res = await client.synthesize({ text: "hello there" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/audio/speech",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer sk-test" }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body).toEqual({ model: "tts-1", voice: "alloy", input: "hello there", response_format: "mp3" });

    expect(res.ok).toBe(true);
    expect(res.mimeType).toBe("audio/mpeg");
    expect(Buffer.from(res.audioBase64!, "base64").toString("utf8")).toBe("fake-mp3-bytes");
  });

  it("returns ok:false (never throws) when the API responds with an error status", async () => {
    const { LiveTtsClient } = await import("./live.js");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "bad key" }));

    const client = new LiveTtsClient({ apiKey: "sk-bad", voice: "alloy" });
    await expect(client.synthesize({ text: "hello" })).resolves.toEqual({ ok: false });
  });

  it("returns ok:false (never throws) when the network call rejects", async () => {
    const { LiveTtsClient } = await import("./live.js");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const client = new LiveTtsClient({ apiKey: "sk-test", voice: "alloy" });
    await expect(client.synthesize({ text: "hello" })).resolves.toEqual({ ok: false });
  });
});

describe("getTtsClient factory", () => {
  it("defaults to the mock client with no TEMPO_TTS / OPENAI_API_KEY configured", async () => {
    const { getTtsClient } = await import("./index.js");
    expect(getTtsClient()).toBeInstanceOf(MockTtsClient);
  });
});
