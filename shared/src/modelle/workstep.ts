import type { Id, IsoDatum } from "../typen/index.js";
import type { WorkStepStatus } from "../konstanten/workstep-status.js";

export interface WorkStep {
  id: Id;
  orderId: Id;
  titel: string;
  position: number;
  status: WorkStepStatus;
  erstelltAm: IsoDatum;
  aktualisiertAm: IsoDatum;
}
