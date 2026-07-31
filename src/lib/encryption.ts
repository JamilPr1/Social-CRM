import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY || "default-dev-key-change-in-production!";
  return scryptSync(secret, "meta-crm-salt", 32);
}

export function encryptToken(plainText: string): string {
  const iv = randomBytes(16);
  const key = getKey();
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export class TokenDecryptError extends Error {
  constructor() {
    super(
      "Saved tokens could not be decrypted. Set TOKEN_ENCRYPTION_KEY on Vercel to match the key used when accounts were connected, redeploy, then reconnect Meta and LinkedIn on Accounts."
    );
    this.name = "TokenDecryptError";
  }
}

export function decryptToken(encryptedText: string): string {
  const [ivHex, authTagHex, encryptedHex] = encryptedText.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function safeDecryptToken(encryptedText: string): string {
  try {
    return decryptToken(encryptedText);
  } catch {
    throw new TokenDecryptError();
  }
}
