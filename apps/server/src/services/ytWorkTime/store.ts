import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, "../../../data");
const configDir = path.join(dataDir, "config");
const configFile = path.join(configDir, "yt_work_time_session.json");

export async function loadYtWorkTimeRawState<T>(): Promise<T | null> {
  try {
    const raw = await readFile(configFile, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function saveYtWorkTimeRawState<T>(state: T): Promise<void> {
  await mkdir(configDir, { recursive: true });
  await writeFile(configFile, JSON.stringify(state, null, 2), "utf8");
}

export async function clearYtWorkTimeRawStateForTest(): Promise<void> {
  await rm(configFile, { force: true });
}
