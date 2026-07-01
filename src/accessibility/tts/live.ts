/**
 * Live TTS adapter — OpenAI's speech endpoint via the global `fetch` (Node
 * 20+, already the engine floor), so this needs no new npm dependency. Only
 * used when TEMPO_TTS=live (or auto-detected from OPENAI_API_KEY) and an API
 * key is configured — see config.ts / a11y/tts/index.ts's double gate.
 *
 * Best-effort: never throws into the caller — a failed synthesis must not
 * break message delivery, the same rule src/slack/live.ts follows for
 * DND/status/scheduled-digest calls.
 */

import type { TtsClient, TtsResult } from "./types.js";

interface LiveTtsOpts {
  apiKey: string;
  voice: string;
}

export class LiveTtsClient implements TtsClient {
  constructor(private readonly opts: LiveTtsOpts) {}

  async synthesize(input: { text: string }): Promise<TtsResult> {
    try {
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.opts.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          voice: this.opts.voice,
          input: input.text,
          response_format: "mp3",
        }),
      });
      if (!res.ok) {
        console.error("tts synthesize failed", res.status, await res.text().catch(() => ""));
        return { ok: false };
      }
      const buf = Buffer.from(await res.arrayBuffer());
      return {
        ok: true,
        audioBase64: buf.toString("base64"),
        mimeType: "audio/mpeg",
        filename: "tempo-read-aloud.mp3",
      };
    } catch (err) {
      console.error("tts synthesize failed", err);
      return { ok: false };
    }
  }
}
