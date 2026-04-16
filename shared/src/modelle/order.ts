export interface Order {
  id: Id;
  werkstueckId: Id;
  anzahl: number;
  status: OrderStatus;
  erstelltAm: IsoDatum;
  aktualisiertAm: IsoDatum;
}
