/** Okamžitý sync účtu u stolu z Dotykačky (po potvrzení objednávky apod.). */
export const TABLE_BILL_SYNC_REQUEST = "ordering-table-bill-sync";

export function requestTableBillSync() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(TABLE_BILL_SYNC_REQUEST));
}
