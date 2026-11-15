import Image from "next/image";
import { useId } from "react";

import { cn } from "@/lib/cn";

import { AVATARS, type Avatar, avatarSrc } from "../model/profile";
import type { SetupState } from "../model/setup";
import { CHOICE, CHOICE_PICKED } from "./setup-styles";

type WhoStepProps = {
  state: SetupState;
  onNameChange: (name: string) => void;
  onAvatarPick: (avatar: Avatar) => void;
  headingRef: React.Ref<HTMLHeadingElement>;
};

// Figma A5 "Who's exploring?", and A5e when Next finds no name: the child's
// first name and an animal buddy. The fields only; ProfileSetup's form owns
// Next.
export function WhoStep({
  state,
  onNameChange,
  onAvatarPick,
  headingRef,
}: WhoStepProps) {
  const nameId = useId();
  const hintId = useId();
  const errorId = useId();
  const hasError = state.error !== null;

  return (
    <>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-4xl font-semibold text-kid-ink outline-none"
      >
        Ko istražuje?
      </h1>
      <div className="flex flex-col gap-2">
        <label htmlFor={nameId} className="text-lg font-semibold text-kid-ink">
          Ime djeteta
        </label>
        <input
          id={nameId}
          name="name"
          value={state.name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Upiši ime"
          autoComplete="off"
          aria-invalid={hasError}
          aria-describedby={hasError ? `${errorId} ${hintId}` : hintId}
          className={cn(
            "h-touch-xl rounded-kid-lg border-3 px-5 text-2xl font-medium text-kid-ink outline-none focus-visible:border-kid-sea",
            hasError ? "border-red-500 bg-red-50" : "border-kid-ink bg-white",
          )}
        />
        {hasError ? (
          <p id={errorId} className="text-base font-semibold text-red-700">
            {state.error}
          </p>
        ) : null}
        <p id={hintId} className="text-sm font-medium text-kid-muted">
          Ovo vidiš samo ti
        </p>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-lg font-semibold text-kid-ink">
          Izaberi drugara
        </legend>
        <div className="grid grid-cols-3 gap-4">
          {AVATARS.map(({ id, label }) => {
            const picked = state.avatar === id;
            return (
              <label
                key={id}
                className={cn(
                  "flex aspect-square cursor-pointer items-center justify-center rounded-full has-[:focus-visible]:outline has-[:focus-visible]:outline-4 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                  picked ? CHOICE_PICKED : CHOICE,
                )}
              >
                <input
                  type="radio"
                  name="avatar"
                  value={id}
                  checked={picked}
                  onChange={() => onAvatarPick(id)}
                  className="sr-only"
                />
                <Image
                  src={avatarSrc(id)}
                  alt={label}
                  width={80}
                  height={80}
                  unoptimized
                />
              </label>
            );
          })}
        </div>
      </fieldset>
    </>
  );
}
