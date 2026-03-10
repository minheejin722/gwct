import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  YtMasterCallQueueEntrySchema,
  YtMasterCallRegistrationSchema,
} from "@gwct/shared";
import { z } from "zod";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(currentDir, "../../../data");
const configDir = path.join(dataDir, "config");
const configFile = path.join(configDir, "yt_master_call_state.json");

const YtMasterCallStoredStateSchema = z.object({
  registrations: z.array(YtMasterCallRegistrationSchema),
  calls: z.array(YtMasterCallQueueEntrySchema),
});

export type YtMasterCallStoredState = z.infer<typeof YtMasterCallStoredStateSchema>;

const DEFAULT_STATE: YtMasterCallStoredState = {
  registrations: [],
  calls: [],
};

let mutationChain: Promise<void> = Promise.resolve();

export async function loadYtMasterCallState(): Promise<YtMasterCallStoredState> {
  try {
    const raw = await readFile(configFile, "utf8");
    const parsed = YtMasterCallStoredStateSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return {
        registrations: [],
        calls: [],
      };
    }
    return parsed.data;
  } catch {
    return {
      registrations: [],
      calls: [],
    };
  }
}

async function saveYtMasterCallState(state: YtMasterCallStoredState): Promise<void> {
  await mkdir(configDir, { recursive: true });
  await writeFile(configFile, JSON.stringify(state, null, 2), "utf8");
}

export async function mutateYtMasterCallState<T>(
  mutator: (current: YtMasterCallStoredState) => Promise<{ state: YtMasterCallStoredState; result: T }> | { state: YtMasterCallStoredState; result: T },
): Promise<T> {
  const run = mutationChain.then(async () => {
    const current = await loadYtMasterCallState();
    const outcome = await mutator(current);
    await saveYtMasterCallState(outcome.state);
    return outcome.result;
  });
  mutationChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function clearYtMasterCallStateForTest(): Promise<void> {
  await rm(configFile, { force: true });
  mutationChain = Promise.resolve();
}

export function defaultYtMasterCallState(): YtMasterCallStoredState {
  return {
    ...DEFAULT_STATE,
    registrations: [...DEFAULT_STATE.registrations],
    calls: [...DEFAULT_STATE.calls],
  };
}
