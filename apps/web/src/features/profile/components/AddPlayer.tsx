"use client";

import { type ReactNode, useEffect, useRef } from "react";

import { addPlayer, saveProfile } from "../api/profile-browser-api";
import { useSetup } from "../hooks/use-setup";
import { SetupSteps } from "./SetupSteps";

type AddPlayerProps = {
  /** The picture beside the steps: the map's art, from the page. */
  art: ReactNode;
  /**
   * Called once the dialog has closed: `changed` when anything reached the
   * API, so the area must load the players and the active one again.
   */
  onClose: (changed: boolean) => void;
};

// Add player (#183): the setup steps over the grown-ups area, in a modal
// <dialog> that fills the screen, so the area stays behind it (and its gate
// passed). Back on the first step or Escape closes it. Next on the last step
// adds an empty player, who becomes the active one (POST /players, ADR 0007),
// then sets them up (PUT /profile), and closes. A retry after a failed save
// only sets the profile again: the player was already added.
export function AddPlayer({ art, onClose }: AddPlayerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Whether POST /players has been sent, and whether it was taken.
  const hasSent = useRef(false);
  const isAdded = useRef(false);
  const { state, dispatch, headingRef, handleNext } = useSetup(
    async (update) => {
      hasSent.current = true;
      if (!isAdded.current) {
        await addPlayer();
        isAdded.current = true;
      }
      await saveProfile(update);
    },
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog !== null && !dialog.open) {
      dialog.showModal();
    }
    // After showModal, which would otherwise focus Back: the question first.
    headingRef.current?.focus();
  }, [headingRef]);

  useEffect(() => {
    if (state.step === "ready") {
      dialogRef.current?.close();
    }
  }, [state.step]);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Dodaj igrača"
      onClose={() => onClose(hasSent.current)}
      // Escape waits while saving, so the result is not lost.
      onCancel={(event) => {
        if (state.saving) {
          event.preventDefault();
        }
      }}
      className="m-0 size-full max-h-none max-w-none bg-transparent p-0"
    >
      {state.step === "ready" ? null : (
        <SetupSteps
          state={state}
          dispatch={dispatch}
          headingRef={headingRef}
          onNext={handleNext}
          onCancel={() => dialogRef.current?.close()}
          art={art}
        />
      )}
    </dialog>
  );
}
