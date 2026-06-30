/**
 * Resolves where the file-backed stores read/write. Tests and `scripts/demo.ts`
 * set TEMPO_STORE_DIR to a temp dir so repeated runs never touch the repo
 * working tree. `tokens.ts` is intentionally untouched by this — it predates
 * this seam and isn't in scope to change.
 */

import { join } from "node:path";

export function storePath(filename: string): string {
  const dir = process.env.TEMPO_STORE_DIR;
  return dir ? join(dir, filename) : filename;
}
