import crypto from "node:crypto";

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function stableJsonHash(value: unknown): string {
  const normalized = JSON.stringify(value, Object.keys(value as object).sort());
  return sha256(normalized);
}
