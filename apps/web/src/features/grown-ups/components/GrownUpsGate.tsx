"use client";

import { type ReactNode, useEffect, useState } from "react";

import { useNavigate } from "@/lib/use-navigate";

import { GateDialog } from "./GateDialog";
import { clearEntry, hasEntry } from "./gate-entry";

type GrownUpsGateProps = {
  /** Where closing the gate goes: the Ja screen. */
  closeHref: string;
  /** The grown-ups area, shown only once the gate is passed. */
  children: ReactNode;
};

// The grown-ups page's gate: on every load, a reload or a pasted URL included,
// the page shows the gate first and its content only once it is passed.
// Coming from the Ja screen, where the gate was just passed, it lets the page
// in once (`gate-entry.ts`). Closing the gate replaces the page with the Ja
// screen, so Back does not reopen it.
export function GrownUpsGate({ closeHref, children }: GrownUpsGateProps) {
  const navigate = useNavigate();
  const [hasPassed, setHasPassed] = useState(hasEntry);

  useEffect(() => {
    clearEntry();
  }, []);

  if (hasPassed) {
    return children;
  }

  return (
    <GateDialog
      onPass={() => setHasPassed(true)}
      onCancel={() => navigate.replace(closeHref)}
    />
  );
}
