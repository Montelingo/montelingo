"use client";

import type { Schemas } from "@app/api-client";
import { type FormEvent, useEffect, useReducer, useRef } from "react";

import { initialSetup, setupReducer, toProfileUpdate } from "../model/setup";

/**
 * The setup steps' state (setupReducer), and Next: it checks the step, then
 * on the last one calls `save` with the profile and dispatches `saved` or
 * `save-failed`. Each later step's heading takes the focus when it shows, so
 * a screen reader hears where it is; the first one is not focused. Used by
 * the first setup (ProfileSetup) and by Add player (AddPlayer).
 */
export function useSetup(
  save: (update: Schemas["ProfileUpdate"]) => Promise<void>,
) {
  const [state, dispatch] = useReducer(setupReducer, undefined, initialSetup);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // The step whose heading last took focus.
  const shownStep = useRef(state.step);
  // Set at once, unlike state.saving, so a double tap saves only once.
  const isSaving = useRef(false);

  useEffect(() => {
    if (shownStep.current !== state.step) {
      shownStep.current = state.step;
      headingRef.current?.focus();
    }
  }, [state.step]);

  function handleNext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving.current) {
      return;
    }
    const update = state.step === "age" ? toProfileUpdate(state) : null;
    dispatch({ type: "next" });
    if (update === null) {
      return;
    }
    isSaving.current = true;
    save(update)
      .then(
        () => dispatch({ type: "saved" }),
        () => dispatch({ type: "save-failed" }),
      )
      .finally(() => {
        isSaving.current = false;
      });
  }

  return { state, dispatch, headingRef, handleNext };
}
