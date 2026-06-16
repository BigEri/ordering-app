/** Okamžitý sync účtu u stolu z Dotykačky (po potvrzení objednávky apod.). */
export const TABLE_BILL_SYNC_REQUEST = "ordering-table-bill-sync";

export function requestTableBillSync() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(TABLE_BILL_SYNC_REQUEST));
}

/** Více pokusů — na kiosku se intervaly škrtí, po akci hosta chceme rychle dotáhnout účet z Dotykačky. */
export function requestTableBillSyncBurst() {
  requestTableBillSync();
  if (typeof window === "undefined") return;
  window.setTimeout(() => requestTableBillSync(), 800);
  window.setTimeout(() => requestTableBillSync(), 2500);
}
