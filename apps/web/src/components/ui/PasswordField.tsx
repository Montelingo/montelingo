"use client";

import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { useId, useState } from "react";

import { cn } from "@/lib/cn";

import { FOCUS_RING } from "./kid-styles";
import { TextField, type TextFieldProps } from "./TextField";

const TOGGLE_STYLES = {
  site: "size-10 rounded-md text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600",
  kid: cn("size-touch rounded-kid text-kid-ink hover:bg-kid-fog", FOCUS_RING),
} as const;

type PasswordFieldProps = Omit<TextFieldProps, "type" | "endAdornment"> & {
  /**
   * The show/hide toggle's name, after its field ("Prikaži lozinku"), so
   * several toggles on one form can be told apart. Given in full, since a
   * language may decline the field's label ("Lozinka" → "lozinku").
   */
  toggleLabel: string;
};

// The toggle keeps one name and reports its state with aria-pressed, as a
// toggle button should (WAI-ARIA APG): a name that changed with the state
// would be announced as a different control.
export function PasswordField({
  id,
  label,
  autoComplete = "current-password",
  toggleLabel,
  appearance = "site",
  ...fieldProps
}: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [isVisible, setIsVisible] = useState(false);
  const iconSize = appearance === "kid" ? "size-6" : "size-5";

  return (
    <TextField
      {...fieldProps}
      label={label}
      appearance={appearance}
      id={inputId}
      type={isVisible ? "text" : "password"}
      autoComplete={autoComplete}
      autoCapitalize="none"
      spellCheck={false}
      endAdornment={
        <button
          type="button"
          aria-pressed={isVisible}
          aria-controls={inputId}
          onClick={() => setIsVisible((visible) => !visible)}
          className={cn("grid place-items-center", TOGGLE_STYLES[appearance])}
        >
          <span className="sr-only">{toggleLabel}</span>
          {isVisible ? (
            <EyeSlashIcon aria-hidden="true" className={iconSize} />
          ) : (
            <EyeIcon aria-hidden="true" className={iconSize} />
          )}
        </button>
      }
    />
  );
}
