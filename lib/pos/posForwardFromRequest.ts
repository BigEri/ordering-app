import { DEVICE_SECRET_HEADER } from "../server/deviceSecret";
import type { PosForwardOptions } from "./forwardPos";

export function posForwardOptionsFromRequest(
  req: Request,
  eventType: string,
  payload: unknown,
): PosForwardOptions {
  return {
    eventType,
    payload,
    userAgent: req.headers.get("user-agent"),
    deviceSecretHeader: req.headers.get(DEVICE_SECRET_HEADER),
  };
}
