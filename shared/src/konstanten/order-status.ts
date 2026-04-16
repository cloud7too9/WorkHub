export const ORDER_STATUS = [
  "OFFEN",
  "IN_BEARBEITUNG",
  "WARTET_AUF_NAECHSTEN_SCHRITT",
  "VERSANDFERTIG",
  "ABGESCHLOSSEN"
] as const;

export type OrderStatus = (typeof ORDER_STATUS)[number];
