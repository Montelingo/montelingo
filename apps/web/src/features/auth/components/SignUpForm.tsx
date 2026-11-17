"use client";

import { EnvelopeIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useId } from "react";

import { PasswordField } from "@/components/ui/PasswordField";
import { TextField } from "@/components/ui/TextField";
import { useNavigate } from "@/lib/use-navigate";

import { signUpAndSignIn } from "../api/auth-api";
import { signUpFields } from "../errors";
import { useAuthForm } from "../hooks/use-auth-form";
import { PASSWORD_MIN_LENGTH } from "../model/messages";
import {
  authPageHref,
  postAuthRedirectPath,
  SIGN_IN_PATH,
} from "../model/routes";
import { validateSignUp } from "../model/validation";
import { AuthSubmitButton } from "./AuthSubmitButton";
import { ErrorSummary } from "./ErrorSummary";
import { kidLinkClassName } from "./link-class-name";
import { WelcomeFormHeader } from "./WelcomeFormHeader";

type SignUpFormProps = {
  /** Where to go after signing up, from the page's `?next=`. */
  redirectTo: string;
};

// The "Create your family account" panel (#153, Figma "1 · Welcome & Auth"),
// inside the welcome frame of the (welcome) layout.
export function SignUpForm({ redirectTo }: SignUpFormProps) {
  const router = useNavigate();
  const titleId = useId();
  // The value comes from the URL, so it is checked here too; a safe path is unchanged.
  const destination = postAuthRedirectPath(redirectTo);
  const signInHref = authPageHref(SIGN_IN_PATH, destination);
  const {
    fieldProps,
    serverFieldErrors,
    failure,
    rejectedFieldCount,
    attempt,
    isPending,
    handleSubmit,
    formRef,
    summaryRef,
    retryAfterSeconds,
  } = useAuthForm({
    initialValues: { email: "", password: "", confirmPassword: "" },
    validate: validateSignUp,
    apiFields: signUpFields,
    focusOnError: "summary",
    submit: async ({ email, password }) => {
      await signUpAndSignIn({ email, password });
    },
    onSuccess: () => {
      router.replace(destination);
      // Re-renders Server Components for the signed-in user.
      router.refresh();
    },
  });

  const emailField = fieldProps("email");
  // Until the email changes, the API's email_taken message is the one shown.
  const isEmailTaken =
    failure?.code === "email_taken" && serverFieldErrors.email !== undefined;
  // The account exists now, so signing up again would fail with email_taken.
  const isSignInAfterSignUpFailure =
    failure?.code === "sign_in_after_sign_up_failed";

  return (
    <div className="flex flex-1 flex-col gap-4">
      <WelcomeFormHeader
        titleId={titleId}
        title="Napravi porodični nalog"
        lead="Čuva napredak, da tvoj istraživač nastavi tamo gdje je stao."
        forGrownUps
      />
      {/* The submit button stays disabled until hydration. method="post" only
          guarantees the credentials never land in a URL. */}
      <form
        ref={formRef}
        method="post"
        aria-labelledby={titleId}
        noValidate
        onSubmit={handleSubmit}
        className="flex flex-1 flex-col gap-3"
      >
        <ErrorSummary
          key={attempt}
          ref={summaryRef}
          rejectedFieldCount={rejectedFieldCount}
          formError={
            isSignInAfterSignUpFailure ? (
              <>
                {failure.formError}{" "}
                <Link href={signInHref} className={kidLinkClassName}>
                  Idi na prijavu
                </Link>
              </>
            ) : (
              failure?.formError
            )
          }
        />
        <TextField
          {...emailField}
          error={
            isEmailTaken ? (
              <>
                {emailField.error}{" "}
                <Link href={signInHref} className={kidLinkClassName}>
                  Prijavi se ovim nalogom
                </Link>
              </>
            ) : (
              emailField.error
            )
          }
          appearance="kid"
          icon={EnvelopeIcon}
          label="E-pošta odrasle osobe"
          description="Nikad je ne dijelimo."
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
        <PasswordField
          {...fieldProps("password")}
          appearance="kid"
          icon={LockClosedIcon}
          label="Lozinka"
          toggleLabel="Prikaži lozinku"
          description={`Najmanje ${PASSWORD_MIN_LENGTH} znakova.`}
          autoComplete="new-password"
          required
        />
        <PasswordField
          {...fieldProps("confirmPassword")}
          appearance="kid"
          icon={LockClosedIcon}
          label="Potvrdi lozinku"
          toggleLabel="Prikaži potvrđenu lozinku"
          autoComplete="new-password"
          required
        />
        <div className="mt-auto flex flex-col gap-3 pt-1">
          <AuthSubmitButton
            appearance="kid"
            isPending={isPending}
            pendingLabel="Pravim nalog…"
            retryAfterSeconds={retryAfterSeconds}
          >
            Napravi nalog
          </AuthSubmitButton>
          <p className="text-center text-lg font-medium text-kid-muted">
            Već imaš nalog?{" "}
            <Link href={signInHref} className={kidLinkClassName}>
              Prijavi se
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
