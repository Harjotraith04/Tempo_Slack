/**
 * Read-aloud audio synthesis — turns a11y/index.ts's `toSpeech()` script into
 * real audio. Mirrors the rts/{types,mock,live,index} and slack/{...} split:
 * modules depend only on this interface, never on a provider SDK directly.
 */

export interface TtsResult {
  ok: boolean;
  /** Base64-encoded audio bytes. Present iff `ok`. */
  audioBase64?: string;
  mimeType?: string;
  filename?: string;
}

export interface TtsClient {
  synthesize(opts: { text: string }): Promise<TtsResult>;
}
