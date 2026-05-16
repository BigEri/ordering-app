import { appendFile, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import type { VirtualPosEvent } from "./virtualPosTypes";

export type { VirtualPosEvent } from "./virtualPosTypes";

const LOG_DIR = path.join(process.cwd(), "data", "virtual-pos");
const LOG_FILE = path.join(LOG_DIR, "events.jsonl");

export async function appendVirtualPosEvent(type: string, payload: unknown): Promise<VirtualPosEvent> {
  await mkdir(LOG_DIR, { recursive: true });
  const event: VirtualPosEvent = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    tsIso: new Date().toISOString(),
    type,
    payload,
  };
  await appendFile(LOG_FILE, `${JSON.stringify(event)}\n`, "utf8");
  return event;
}

export async function readVirtualPosEvents(limit = 200): Promise<VirtualPosEvent[]> {
  try {
    const raw = await readFile(LOG_FILE, "utf8");
    const lines = raw
      .trim()
      .split("\n")
      .filter(Boolean);
    const parsed: VirtualPosEvent[] = [];
    for (const line of lines) {
      try {
        parsed.push(JSON.parse(line) as VirtualPosEvent);
      } catch {
        // přeskoč poškozený řádek
      }
    }
    return parsed.slice(-limit);
  } catch {
    return [];
  }
}

export async function clearVirtualPosEvents(): Promise<void> {
  await mkdir(LOG_DIR, { recursive: true });
  await writeFile(LOG_FILE, "", "utf8");
}
