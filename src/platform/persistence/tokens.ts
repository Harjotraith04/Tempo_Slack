/**
 * Encrypted user-token store.
 *
 * Tempo acts with each user's OWN Slack user token (so RTS is scoped to exactly
 * what they can see and needs no action_token). Those tokens are sensitive, so
 * they're encrypted at rest with AES-256-GCM. This file-backed store is fine for
 * the hackathon; swap `load`/`save` for Postgres (Neon) in production — the
 * interface stays the same.
 *
 * COMPLIANCE: we store ONLY auth tokens + prefs here, never any RTS content.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { config } from "../../config.js";

const STORE_PATH = ".tempo-store.json";

interface StoredRecord {
  userId: string;
  teamId: string;
  /** iv:tag:ciphertext, all base64 */
  enc: string;
  installedAt: number;
}

function key(): Buffer {
  return createHash("sha256").update(config.runtime.encryptionKey).digest();
}

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

function load(): Record<string, StoredRecord> {
  if (!existsSync(STORE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function save(data: Record<string, StoredRecord>): void {
  writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

export function saveUserToken(userId: string, teamId: string, userToken: string): void {
  const data = load();
  data[userId] = { userId, teamId, enc: encrypt(userToken), installedAt: Math.floor(Date.now() / 1000) };
  save(data);
}

export function getUserToken(userId: string): string | undefined {
  const rec = load()[userId];
  return rec ? decrypt(rec.enc) : undefined;
}

/** Metadata only — no decrypt() — so listing installs never touches token material. */
export function listInstalledUsers(): { userId: string; teamId: string; installedAt: number }[] {
  return Object.values(load()).map(({ userId, teamId, installedAt }) => ({ userId, teamId, installedAt }));
}
