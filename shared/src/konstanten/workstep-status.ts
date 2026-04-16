export const WORKSTEP_STATUS = [
  "OFFEN",
  "IN_BEARBEITUNG",
  "ABGESCHLOSSEN"
] as const;

export type WorkStepStatus = (typeof WORKSTEP_STATUS)[number];
