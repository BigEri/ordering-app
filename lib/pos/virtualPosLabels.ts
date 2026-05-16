import { tableLabelFromPayload } from "./tableContext";
import type { VirtualPosEvent } from "./virtualPosTypes";

export function typeBadgeModifier(type: string) {
  if (type === "STAFF_CALL") return "virtualPosTypeBadge--staff";
  if (type === "BILL_REQUEST") return "virtualPosTypeBadge--bill";
  if (type === "BILL_PAY_CONFIRMED") return "virtualPosTypeBadge--billPay";
  if (type === "ORDER_CONFIRMED") return "virtualPosTypeBadge--order";
  return "virtualPosTypeBadge--other";
}

export function typeLabel(type: string) {
  const labels: Record<string, string> = {
    STAFF_CALL: "Přivolání personálu",
    BILL_REQUEST: "Žádost o účet",
    BILL_PAY_CONFIRMED: "Potvrzení platby (host)",
    ORDER_CONFIRMED: "Potvrzená objednávka",
  };
  return labels[type] ?? type;
}

function toastLine(e: VirtualPosEvent) {
  const table = tableLabelFromPayload(e.payload);
  return `${table}: ${typeLabel(e.type)}`;
}

export function buildToastMessage(arrived: VirtualPosEvent[]) {
  if (arrived.length === 0) return "";
  if (arrived.length === 1) return toastLine(arrived[0]);
  if (arrived.length === 2) return `${toastLine(arrived[0])} · ${toastLine(arrived[1])}`;
  const table = tableLabelFromPayload(arrived[0].payload);
  return `${table}: ${arrived.length} nové události`;
}
