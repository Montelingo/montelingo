"use client";

import type { ReactNode } from "react";

import { PLAY_PATH } from "@/features/auth/edge";
import { fredoka } from "@/lib/fonts";
import { useNavigate } from "@/lib/use-navigate";

import { saveProfile } from "../api/profile-browser-api";
import { useSetup } from "../hooks/use-setup";
import { type FirstStop, ReadyScreen } from "./ReadyScreen";
import { SetupSteps } from "./SetupSteps";

type ProfileSetupProps = {
  firstStop: FirstStop | null;
  /** The picture beside the steps: the map's art, from the page. */
  art: ReactNode;
};

// The child's profile setup (#118): the name and buddy, then the age band,
// saved through PUT /profile, then "ready to explore" and onto the map. The
// rules are setupReducer's, the saving and focus useSetup()'s.
export function ProfileSetup({ firstStop, art }: ProfileSetupProps) {
  const router = useNavigate();
  const { state, dispatch, headingRef, handleNext } = useSetup(saveProfile);

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
      <SetupSteps
        state={state}
        dispatch={dispatch}
        headingRef={headingRef}
        onNext={handleNext}
        onCancel={null}
        art={art}
      />
    </div>
  );
}
