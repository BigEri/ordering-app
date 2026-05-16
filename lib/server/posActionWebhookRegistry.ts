type Entry = {
  resolve: (body: string | null) => void;
  timer: ReturnType<typeof setTimeout>;
};

const pending = new Map<string, Entry>();

export function waitForPosActionWebhook(callbackId: string, ms: number): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(callbackId);
      resolve(null);
    }, ms);
    pending.set(callbackId, {
      resolve: (body: string | null) => {
        clearTimeout(timer);
        pending.delete(callbackId);
        resolve(body);
      },
      timer,
    });
  });
}

export function resolvePosActionWebhook(callbackId: string, body: string): boolean {
  const e = pending.get(callbackId);
  if (!e) return false;
  clearTimeout(e.timer);
  pending.delete(callbackId);
  e.resolve(body);
  return true;
}

export function cancelPosActionWebhook(callbackId: string | null | undefined): void {
  if (!callbackId) return;
  const e = pending.get(callbackId);
  if (!e) return;
  clearTimeout(e.timer);
  pending.delete(callbackId);
  e.resolve(null);
}
