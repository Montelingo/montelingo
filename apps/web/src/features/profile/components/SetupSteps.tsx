import type { Dispatch, FormEvent, ReactNode, Ref } from "react";

import type { SetupAction, SetupState } from "../model/setup";
import { AgeStep } from "./AgeStep";
import { PRIMARY_BUTTON } from "./setup-styles";
import { SetupFrame } from "./SetupFrame";
import { WhoStep } from "./WhoStep";

type SetupStepsProps = {
  state: SetupState;
  dispatch: Dispatch<SetupAction>;
  headingRef: Ref<HTMLHeadingElement>;
  /** Next, from useSetup(). */
  onNext: (event: FormEvent<HTMLFormElement>) => void;
  /** Back on the first step, or `null` for none (the first setup). */
  onCancel: (() => void) | null;
  /** The picture beside the steps: the map's art, from the page. */
  art: ReactNode;
};

// The two setup steps in their frame (Figma A5, A6): the name and buddy, then
// the age band, with Next under them and Back on the second step. The first
// setup (ProfileSetup) and Add player (AddPlayer) both run them.
export function SetupSteps({
  state,
  dispatch,
  headingRef,
  onNext,
  onCancel,
  art,
}: SetupStepsProps) {
  return (
    <SetupFrame
      step={state.step === "who" ? 1 : 2}
      stepCount={2}
      art={art}
      onBack={
        state.step === "age" ? () => dispatch({ type: "back" }) : onCancel
      }
    >
      <form noValidate onSubmit={onNext} className="flex flex-1 flex-col gap-6">
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
            onBandPick={(ageBand) => dispatch({ type: "band-picked", ageBand })}
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
  );
}
