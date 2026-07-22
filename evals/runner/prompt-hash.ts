import { createHash } from "node:crypto";

export function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt, "utf-8").digest("hex").slice(0, 8);
}
