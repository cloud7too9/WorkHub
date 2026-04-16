import type { Id, IsoDatum } from "../typen/index.js";
import type { OrderStatus } from "../konstanten/order-status.js";

export interface Order {
  id: Id;
  werkstueckId: Id;
  stueckzahl: number;
  status: OrderStatus;
  erstelltAm: IsoDatum;
  aktualisiertAm: IsoDatum;
}
