import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

// AES-256-GCM envelope encryption for connections.tokens. Master key comes from
// CONNECTIONS_ENCRYPTION_KEY (base64, 32 bytes — generate with `openssl rand -base64 32`),
// set as a Netlify env var, never committed. See docs/phase1-amazon-application.md's
// "Related open decision" and CLAUDE.md for context — this is a proposed scheme pending
// Joey's sign-off, not yet exercised against a real connection.
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getMasterKey(): Buffer {
  const keyBase64 = process.env.CONNECTIONS_ENCRYPTION_KEY;
  if (!keyBase64) {
    throw new Error("CONNECTIONS_ENCRYPTION_KEY is not set.");
  }
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) {
    throw new Error("CONNECTIONS_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }
  return key;
}

/** Encrypts a plaintext token payload (e.g. JSON.stringify'd OAuth tokens) into a single
 * buffer: iv || authTag || ciphertext — ready to store in connections.tokens (bytea). */
export function encryptToken(plaintext: string): Buffer {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

/** Reverses encryptToken. Throws if the blob was tampered with or the key is wrong
 * (GCM auth tag verification fails closed). */
export function decryptToken(blob: Buffer): string {
  const key = getMasterKey();
  const iv = blob.subarray(0, IV_LENGTH);
  const authTag = blob.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = blob.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
