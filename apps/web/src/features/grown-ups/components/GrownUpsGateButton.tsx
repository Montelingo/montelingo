"use client";

import { type ReactNode, useRef, useState } from "react";

import { useNavigate } from "@/lib/use-navigate";

import { GateDialog } from "./GateDialog";
import { grantEntry } from "./gate-entry";

type GrownUpsGateButtonProps = {
  /** The grown-ups area, opened once the gate is passed. */
  href: string;
  /** The row's look, which belongs to the screen it is on. */
  className?: string;
  children: ReactNode;
};

// The Ja screen's "Za roditelje" row: it opens the gate over the screen, and
// passing it opens the grown-ups area, which lets this one pass in. Closing
// the gate puts the focus back on the row.
export function GrownUpsGateButton({
  href,
  className,
  children,
}: GrownUpsGateButtonProps) {
  const navigate = useNavigate();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
        className={className}
      >
        {children}
      </button>
      {isOpen ? (
        <GateDialog
          onPass={() => {
            setIsOpen(false);
            grantEntry();
            navigate.push(href);
          }}
          onCancel={() => {
            setIsOpen(false);
            buttonRef.current?.focus();
          }}
        />
      ) : null}
    </>
  );
}
