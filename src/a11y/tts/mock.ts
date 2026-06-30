/**
 * Mock TTS adapter — deterministic, zero I/O. Used whenever TEMPO_TTS=mock
 * (the default), so `npm run demo`/tests can exercise the full
 * synthesize → upload pipeline with a genuine, valid audio file and never
 * call a real provider.
 *
 * Produces a minimal silent WAV: a real RIFF/WAVE header + PCM silence, sized
 * deterministically from the input text's word count so the same text always
 * produces the same bytes (same convention as MockRtsClient).
 */

import type { TtsClient, TtsResult } from "./types.js";

const SAMPLE_RATE = 8000;
const MIN_SECS = 1;
const MAX_SECS = 8;

function silentWav(durationSecs: number): Buffer {
  const numSamples = Math.round(durationSecs * SAMPLE_RATE);
  const dataSize = numSamples * 2; // 16-bit mono
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // audio format = PCM
  buffer.writeUInt16LE(1, 22); // channels = mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);
  // Remaining bytes are already zeroed by Buffer.alloc — silence.
  return buffer;
}

export class MockTtsClient implements TtsClient {
  async synthesize(opts: { text: string }): Promise<TtsResult> {
    const words = opts.text.trim().split(/\s+/).filter(Boolean).length;
    const secs = Math.min(MAX_SECS, Math.max(MIN_SECS, Math.ceil(words / 2.5)));
    const wav = silentWav(secs);
    return {
      ok: true,
      audioBase64: wav.toString("base64"),
      mimeType: "audio/wav",
      filename: "tempo-read-aloud.wav",
    };
  }
}
