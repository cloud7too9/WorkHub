export interface Order {
  id: Id;
  werkstueckId: Id;
  stueckzahl: number;
  status: OrderStatus;
  erstelltAm: IsoDatum;
  aktualisiertAm: IsoDatum;
}
