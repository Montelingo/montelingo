import type { Explorer } from "@/features/profile/edge";

/** Which home the page shows (§6: one state per case). */
export type HomeView =
  /**
   * A visitor. `canSignOut` when the account could not be looked up while a
   * session cookie may still be live (a shared tablet), as the site header
   * does.
   */
  | { status: "visitor"; canSignOut: boolean }
  /** A signed-in family, with the child (`null` when it could not be read). */
  | { status: "family"; explorer: Explorer | null };
