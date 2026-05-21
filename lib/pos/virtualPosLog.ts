import { appendFile, mkdir, readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

import type { VirtualPosEvent } from "./virtualPosTypes";

export type { VirtualPosEvent } from "./virtualPosTypes";

function resolveLogDir(): string {
  // Vercel / Lambda: project `data/` is read-only; use OS temp.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(tmpdir(), "ordering-app-virtual-pos");
  }
  return path.join(process.cwd(), "data", "virtual-pos");
}

function logFilePath(): string {
  return path.join(resolveLogDir(), "events.jsonl");
}

export async function appendVirtualPosEvent(type: string, payload: unknown): Promise<VirtualPosEvent> {
  const event: VirtualPosEvent = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    tsIso: new Date().toISOString(),
    type,
    payload,
  };
  try {
    const dir = resolveLogDir();
    const file = logFilePath();
    await mkdir(dir, { recursive: true });
    await appendFile(file, `${JSON.stringify(event)}\n`, "utf8");
  } catch {
    // Souborový log je best-effort (např. read-only FS na Vercelu).
  }
  return event;
}

export async function readVirtualPosEvents(limit = 200): Promise<VirtualPosEvent[]> {
  try {
    const raw = await readFile(logFilePath(), "utf8");
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
  try {
    const dir = resolveLogDir();
    await mkdir(dir, { recursive: true });
    await writeFile(logFilePath(), "", "utf8");
  } catch {
    // ignore
  }
}
