"use client";

import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { useId, useState } from "react";

import { TextField, type TextFieldProps } from "./TextField";

type PasswordFieldProps = Omit<TextFieldProps, "type" | "endAdornment">;

// The toggle is named after its field ("Show password", "Show confirm
// password"), so several toggles on one form can be told apart.
export function PasswordField({
  id,
  label,
  autoComplete = "current-password",
  ...fieldProps
}: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [isVisible, setIsVisible] = useState(false);

  return (
    <TextField
      {...fieldProps}
      label={label}
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
          className="grid size-10 place-items-center rounded-md text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          <span className="sr-only">{`Show ${label.toLowerCase()}`}</span>
          {isVisible ? (
            <EyeSlashIcon aria-hidden="true" className="size-5" />
          ) : (
            <EyeIcon aria-hidden="true" className="size-5" />
          )}
        </button>
      }
    />
  );
}
