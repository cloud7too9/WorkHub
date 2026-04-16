export interface WorkStep {
  id: Id;
  orderId: Id;
  titel: string;
  position: number;
  status: WorkStepStatus;
  erstelltAm: IsoDatum;
  aktualisiertAm: IsoDatum;
}
