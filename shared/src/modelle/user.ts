import type { Id } from "../typen/index.js";
import type { BenutzerRolle } from "../konstanten/rollen.js";

export interface User {
  id: Id;
  name: string;
  rolle: BenutzerRolle;
}
