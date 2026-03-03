import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

export interface DiagnosticWriter {
  write(name: string, content: string): string;
}

export function createDiagnosticWriter(baseDir: string): DiagnosticWriter {
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true });
  }

  return {
    write(name: string, content: string) {
      const safe = name.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const filePath = path.join(baseDir, safe);
      const ws = createWriteStream(filePath, { encoding: "utf8" });
      ws.write(content);
      ws.end();
      return filePath;
    },
  };
}
