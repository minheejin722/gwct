import { randomUUID } from "node:crypto";

export function uid(prefix?: string): string {
  return prefix ? `${prefix}_${randomUUID()}` : randomUUID();
}
