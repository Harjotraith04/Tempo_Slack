/**
 * TTS client factory. Returns the live adapter only when TEMPO_TTS=live AND
 * an API key is available; otherwise the mock — same double-gate pattern as
 * rts/index.ts's getRtsClient / slack/index.ts's getSlackActions.
 */

import { config, isLiveTts } from "../../config.js";
import { LiveTtsClient } from "./live.js";
import { MockTtsClient } from "./mock.js";
import type { TtsClient } from "./types.js";

export * from "./types.js";

export function getTtsClient(): TtsClient {
  if (isLiveTts() && config.tts.apiKey) {
    return new LiveTtsClient({ apiKey: config.tts.apiKey, voice: config.tts.voice });
  }
  return new MockTtsClient();
}
