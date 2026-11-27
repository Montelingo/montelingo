"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

import { FormAlert } from "@/components/ui/FormAlert";
import { BIG_BUTTON, FOCUS_RING } from "@/components/ui/kid-styles";
import { cn } from "@/lib/cn";
import { fredoka } from "@/lib/fonts";
import { replaceDocument } from "@/lib/navigation";

import { authErrorMessages } from "../errors";
import { useSignOut } from "../hooks/use-sign-out";
import { HOME_PATH } from "../model/routes";
import { PendingLabel } from "./PendingLabel";

const LOGOUT_ICON = "/learner/icon-logout.svg";

type SignOutConfirmProps = {
  /** The account's email, which the dialog says the progress is saved on. */
  email: string;
};

// The grown-ups area's red "Odjavi se" row (#178), which asks first (#179,
// screen 4 of #174): a modal over the area, with the dimmed backdrop, the
// round log-out icon, "Odjavi se" (coral, the main action) and "Ostani
// prijavljen" (white). Focus starts on "Ostani prijavljen", the safe choice.
// Escape, a tap on the backdrop or "Ostani prijavljen" closes it and puts the
// focus back on the row. Signing out loads the welcome screen afresh, as
// SignOutButton does.
export function SignOutConfirm({ email }: SignOutConfirmProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rowRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={rowRef}
        type="button"
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
        className={`inline-flex min-h-touch items-center gap-2.5 self-start rounded-kid text-2xl font-semibold leading-tight text-kid-red ${FOCUS_RING}`}
      >
        <Image
          src={LOGOUT_ICON}
          alt=""
          aria-hidden="true"
          width={22}
          height={22}
          // Local SVGs need no resizing (see the map's ChromeIcon).
          unoptimized
          className="shrink-0"
        />
        Odjavi se
      </button>
      {isOpen ? (
        <SignOutDialog
          email={email}
          onClose={() => {
            setIsOpen(false);
            rowRef.current?.focus();
          }}
        />
      ) : null}
    </>
  );
}

type SignOutDialogProps = {
  email: string;
  /** Called once the dialog has closed without signing out. */
  onClose: () => void;
};

function SignOutDialog({ email, onClose }: SignOutDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const textId = useId();
  const { isPending, error, signOut } = useSignOut({
    // A full load, not a router navigation: no signed-in client state
    // survives (see SignOutButton).
    onSignedOut: () => replaceDocument(HOME_PATH),
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog !== null && !dialog.open) {
      dialog.showModal();
    }
    // After showModal, which would otherwise focus the first button.
    stayRef.current?.focus();
  }, []);

  function handleClose() {
    if (!isPending) {
      dialogRef.current?.close();
    }
  }

  // While signing out the dialog must stay, so a failure is shown in it.
  // Chrome closes a modal on a second Escape without a tap in between,
  // whatever `cancel` does, so a close while pending opens it again.
  function handleClosed() {
    const dialog = dialogRef.current;
    if (isPending && dialog !== null) {
      dialog.showModal();
      return;
    }
    onClose();
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- the backdrop tap is a pointer-only extra; the keyboard closes the dialog with Escape (native to a modal <dialog>) or "Ostani prijavljen"
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={textId}
      onClose={handleClosed}
      // Escape: kept open while signing out, so the buttons stay held.
      onCancel={(event) => {
        if (isPending) {
          event.preventDefault();
        }
      }}
      // A tap on the backdrop lands on the dialog itself, outside the card.
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
      className={cn(
        fredoka.className,
        "m-auto w-full max-w-md bg-transparent p-4 backdrop:bg-kid-ink/40",
      )}
    >
      <div className="flex flex-col items-center gap-4 rounded-kid-xl border-3 border-kid-ink bg-kid-cream px-6 pb-6 pt-6 text-center shadow-raised-6">
        <span className="flex size-16 items-center justify-center rounded-full border-3 border-kid-ink bg-kid-pink-soft">
          <Image
            src={LOGOUT_ICON}
            alt=""
            aria-hidden="true"
            width={32}
            height={32}
            unoptimized
          />
        </span>
        <h2
          id={titleId}
          className="text-3xl font-semibold leading-tight text-kid-ink"
        >
          Odjaviti se iz Montelinga?
        </h2>
        {/* One text node, so a screen reader reads "…{email}." with no gap
            before the full stop; a long email wraps anywhere. */}
        <p
          id={textId}
          className="text-lg font-medium text-kid-muted [overflow-wrap:anywhere]"
        >
          {`Napredak je sačuvan na nalogu ${email}. Trebaće ti ponovna prijava.`}
        </p>
        <FormAlert
          message={error === null ? null : authErrorMessages.signOutFailed}
          className="w-full text-left"
        />
        <div className="flex w-full flex-col gap-3 pt-1">
          {/* aria-disabled keeps the buttons focusable while pending, so
              focus is not lost; the hook ignores clicks until it is done. */}
          <button
            type="button"
            aria-disabled={isPending || undefined}
            onClick={signOut}
            className={cn(
              BIG_BUTTON,
              "bg-kid-coral",
              isPending ? "cursor-wait" : undefined,
            )}
          >
            <PendingLabel
              label="Odjavi se"
              pendingLabel="Odjavljujem…"
              isPending={isPending}
            />
          </button>
          <button
            ref={stayRef}
            type="button"
            aria-disabled={isPending || undefined}
            onClick={handleClose}
            // Held while signing out: it looks it too.
            className={cn(
              BIG_BUTTON,
              "bg-white",
              isPending ? "cursor-wait opacity-60" : undefined,
            )}
          >
            Ostani prijavljen
          </button>
        </div>
      </div>
    </dialog>
  );
}
