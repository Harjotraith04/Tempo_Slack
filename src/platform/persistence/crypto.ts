/**
 * Token-at-rest crypto (AES-256-GCM), shared by the file and Postgres token
 * adapters so both encrypt identically. The key is derived (SHA-256) from
 * `config.runtime.encryptionKey`; `assertSecretsHardened()` blocks the insecure
 * dev default in any live posture.
 *
 * COMPLIANCE: only the USER token is encrypted here — never any RTS content.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { config } from "../../config.js";

function key(): Buffer {
  return createHash("sha256").update(config.runtime.encryptionKey).digest();
}

/** Returns `iv:tag:ciphertext`, all base64. New random IV per call. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decrypt(enc: string): string {
  const [ivB, tagB, ctB] = enc.split(":");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB!, "base64"));
  decipher.setAuthTag(Buffer.from(tagB!, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB!, "base64")), decipher.final()]).toString("utf8");
}
