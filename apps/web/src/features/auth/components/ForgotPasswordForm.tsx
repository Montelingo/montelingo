"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { FormAlert } from "@/components/ui/FormAlert";
import { TextField } from "@/components/ui/TextField";

import { requestPasswordReset } from "../api/auth-api";
import {
  isPasswordResetRequestErrorShown,
  passwordResetRequestFields,
} from "../errors";
import { useAuthForm } from "../hooks/use-auth-form";
import { SIGN_IN_PATH } from "../model/routes";
import { validatePasswordResetRequest } from "../model/validation";
import { AuthSubmitButton } from "./AuthSubmitButton";
import { linkClassName } from "./link-class-name";

type SentState = {
  /** The (trimmed) email the last link was requested for. */
  email: string;
  /** False until "send another link" brings the form back. */
  isShown: boolean;
};

// Asks for a reset link, then shows the same confirmation whatever the API
// answered, except for the errors isPasswordResetRequestErrorShown() lets through.
export function ForgotPasswordForm() {
  const [sent, setSent] = useState<SentState | null>(null);

  if (sent?.isShown) {
    return (
      <ResetLinkSent
        email={sent.email}
        onSendAnother={() => setSent({ email: sent.email, isShown: false })}
      />
    );
  }

  return (
    <RequestResetLinkForm
      // Coming back from the confirmation: the email is filled in and focused.
      initialEmail={sent?.email ?? ""}
      focusEmailOnMount={sent !== null}
      onSent={(email) => setSent({ email, isShown: true })}
    />
  );
}

type RequestResetLinkFormProps = {
  initialEmail: string;
  focusEmailOnMount: boolean;
  onSent: (email: string) => void;
};

function RequestResetLinkForm({
  initialEmail,
  focusEmailOnMount,
  onSent,
}: RequestResetLinkFormProps) {
  const titleId = useId();
  // Set by the submit and read once it succeeds, so state only changes in
  // onSuccess, which never runs after the form has unmounted.
  const submittedEmailRef = useRef("");
  const {
    fieldProps,
    failure,
    attempt,
    isPending,
    handleSubmit,
    formRef,
    retryAfterSeconds,
  } = useAuthForm({
    initialValues: { email: initialEmail },
    validate: validatePasswordResetRequest,
    apiFields: passwordResetRequestFields,
    submit: async ({ email }) => {
      submittedEmailRef.current = email;
      try {
        await requestPasswordReset({ email });
      } catch (error) {
        // Errors that could depend on the account end in the confirmation.
        if (isPasswordResetRequestErrorShown(error)) {
          throw error;
        }
      }
    },
    onSuccess: () => {
      onSent(submittedEmailRef.current);
    },
  });

  useEffect(() => {
    if (!focusEmailOnMount) {
      return;
    }
    const email = formRef.current?.elements.namedItem("email");
    if (email instanceof HTMLElement) {
      email.focus();
    }
  }, [focusEmailOnMount, formRef]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 id={titleId} className="text-2xl font-bold text-slate-900">
          Forgot your password?
        </h1>
        <p className="text-slate-700">
          Enter the email you use for Montelingo and we’ll send you a link to
          choose a new password.
        </p>
      </div>
      {/* method="post": submitted natively before hydration, the
          email goes in the request body, never in the URL. */}
      <form
        ref={formRef}
        method="post"
        aria-labelledby={titleId}
        noValidate
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        <FormAlert key={attempt} message={failure?.formError} />
        <TextField
          {...fieldProps("email")}
          label="Email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
        <AuthSubmitButton
          isPending={isPending}
          pendingLabel="Sending…"
          retryAfterSeconds={retryAfterSeconds}
        >
          Send reset link
        </AuthSubmitButton>
      </form>
      <p className="text-center text-sm text-slate-700">
        Remembered it?{" "}
        <Link href={SIGN_IN_PATH} className={linkClassName}>
          Sign in
        </Link>
      </p>
    </div>
  );
}

type ResetLinkSentProps = {
  email: string;
  onSendAnother: () => void;
};

// The same copy whatever happened to the request, so it never tells whether
// the account exists.
function ResetLinkSent({ email, onSendAnother }: ResetLinkSentProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Replaces the form, so focus moves to the heading for screen readers.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-bold text-slate-900 focus:outline-none"
        >
          Check your email
        </h1>
        <p className="text-slate-700">
          If an account exists for{" "}
          <span className="break-all font-medium text-slate-900">{email}</span>,
          we’ve sent a link to reset your password. The link works once and
          expires after a short time.
        </p>
      </div>
      <p className="text-sm text-slate-700">
        Didn’t get it? Check your spam folder, or{" "}
        <button type="button" onClick={onSendAnother} className={linkClassName}>
          send another link
        </button>
        .
      </p>
      <p className="text-center text-sm text-slate-700">
        <Link href={SIGN_IN_PATH} className={linkClassName}>
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
