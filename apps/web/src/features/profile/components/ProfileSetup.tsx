"use client";

import { type ReactNode, useEffect, useReducer, useRef } from "react";

import { PLAY_PATH } from "@/features/auth/edge";
import { fredoka } from "@/lib/fonts";
import { useNavigate } from "@/lib/use-navigate";

import { saveProfile } from "../api/profile-browser-api";
import { initialSetup, setupReducer, toProfileUpdate } from "../model/setup";
import { AgeStep } from "./AgeStep";
import { type FirstStop, ReadyScreen } from "./ReadyScreen";
import { PRIMARY_BUTTON } from "./setup-styles";
import { SetupFrame } from "./SetupFrame";
import { WhoStep } from "./WhoStep";

type ProfileSetupProps = {
  firstStop: FirstStop | null;
  /** The picture beside the steps: the map's art, from the page. */
  art: ReactNode;
};

// The child's profile setup (#118): the name and buddy, then the age band,
// saved through PUT /profile, then "ready to explore" and onto the map. The
// rules are setupReducer's; this saves and moves focus to each new step's
// heading, so a screen reader hears where it is.
export function ProfileSetup({ firstStop, art }: ProfileSetupProps) {
  const router = useNavigate();
  const [state, dispatch] = useReducer(setupReducer, undefined, initialSetup);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // The step whose heading last took focus: the first one is not focused, so
  // the page opens as usual; each later one is.
  const shownStep = useRef(state.step);
  // Set at once, unlike state.saving, so a double tap saves only once.
  const isSaving = useRef(false);

  useEffect(() => {
    if (shownStep.current !== state.step) {
      shownStep.current = state.step;
      headingRef.current?.focus();
    }
  }, [state.step]);

  function handleNext(event: React.FormEvent<HTMLFormElement>) {
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
    saveProfile(update)
      .then(
        () => dispatch({ type: "saved" }),
        () => dispatch({ type: "save-failed" }),
      )
      .finally(() => {
        isSaving.current = false;
      });
  }

  if (state.step === "ready") {
    return (
      <div className={fredoka.className}>
        <ReadyScreen
          avatar={state.avatar}
          firstStop={firstStop}
          headingRef={headingRef}
          onStart={() => {
            router.replace(PLAY_PATH);
            router.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div className={fredoka.className}>
      <SetupFrame
        step={state.step === "who" ? 1 : 2}
        stepCount={2}
        art={art}
        onBack={state.step === "age" ? () => dispatch({ type: "back" }) : null}
      >
        <form
          noValidate
          onSubmit={handleNext}
          className="flex flex-1 flex-col gap-6"
        >
          {state.step === "who" ? (
            <WhoStep
              state={state}
              headingRef={headingRef}
              onNameChange={(name) => dispatch({ type: "name-changed", name })}
              onAvatarPick={(avatar) =>
                dispatch({ type: "avatar-picked", avatar })
              }
            />
          ) : (
            <AgeStep
              state={state}
              headingRef={headingRef}
              onBandPick={(ageBand) =>
                dispatch({ type: "band-picked", ageBand })
              }
            />
          )}
          <button
            type="submit"
            disabled={state.saving}
            className={`${PRIMARY_BUTTON} mt-auto`}
          >
            {state.saving ? "Čuvam…" : "Dalje"}
          </button>
        </form>
      </SetupFrame>
    </div>
  );
}
