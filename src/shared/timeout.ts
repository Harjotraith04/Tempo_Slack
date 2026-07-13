/**
 * Turn a HANG into an ERROR.
 *
 * `safely()` (main/app.ts) only runs its recovery when the work *throws*. A
 * `generateObject` call that never settles produces neither a reply nor a
 * recovery — the user just watches silence. Slack has already been acked by
 * then, so nothing else will ever nudge us.
 *
 * This does not *cancel* the underlying work (LlmPort carries no AbortSignal;
 * the live AI adapter sets its own per-call abort). It only guarantees the user
 * always hears something back.
 */

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const fuse = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  try {
    return await Promise.race([p, fuse]);
  } finally {
    clearTimeout(timer);
  }
}
