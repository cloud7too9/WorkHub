export const BENUTZER_ROLLEN = [
  "WERKER",
  "BUERO",
  "CHEF"
] as const;

export type BenutzerRolle = (typeof BENUTZER_ROLLEN)[number];
