"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId } from "react";

import { FormAlert } from "@/components/ui/FormAlert";
import { PasswordField } from "@/components/ui/PasswordField";
import { TextField } from "@/components/ui/TextField";

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
import { linkClassName } from "./link-class-name";

type SignUpFormProps = {
  /** Where to go after signing up, from the page's `?next=`. */
  redirectTo: string;
};

export function SignUpForm({ redirectTo }: SignUpFormProps) {
  const router = useRouter();
  const titleId = useId();
  // The value comes from the URL, so it is checked here too; a safe path is unchanged.
  const destination = postAuthRedirectPath(redirectTo);
  const signInHref = authPageHref(SIGN_IN_PATH, destination);
  const {
    fieldProps,
    serverFieldErrors,
    failure,
    attempt,
    isPending,
    handleSubmit,
    formRef,
    retryAfterSeconds,
  } = useAuthForm({
    initialValues: { email: "", password: "", confirmPassword: "" },
    validate: validateSignUp,
    apiFields: signUpFields,
    submit: async ({ email, password }) => {
      await signUpAndSignIn({ email, password });
    },
    onSuccess: () => {
      router.replace(destination);
      // Re-renders Server Components (such as the header) for the signed-in user.
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 id={titleId} className="text-2xl font-bold text-slate-900">
          Napravi porodični nalog
        </h1>
        <p className="text-slate-700">
          Čuva napredak, da tvoj istraživač nastavi tamo gdje je stao.
        </p>
      </div>
      {/* The submit button stays disabled until hydration. method="post" only
          guarantees the credentials never land in a URL. */}
      <form
        ref={formRef}
        method="post"
        aria-labelledby={titleId}
        noValidate
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        <FormAlert
          key={attempt}
          message={
            isSignInAfterSignUpFailure ? (
              <>
                {failure.formError}{" "}
                <Link href={signInHref} className={linkClassName}>
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
                <Link href={signInHref} className={linkClassName}>
                  Prijavi se ovim nalogom
                </Link>
              </>
            ) : (
              emailField.error
            )
          }
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
          label="Lozinka"
          toggleLabel="Prikaži lozinku"
          description={`Najmanje ${PASSWORD_MIN_LENGTH} znakova.`}
          autoComplete="new-password"
          required
        />
        <PasswordField
          {...fieldProps("confirmPassword")}
          label="Potvrdi lozinku"
          toggleLabel="Prikaži potvrđenu lozinku"
          autoComplete="new-password"
          required
        />
        <AuthSubmitButton
          isPending={isPending}
          pendingLabel="Pravim nalog…"
          retryAfterSeconds={retryAfterSeconds}
        >
          Napravi nalog
        </AuthSubmitButton>
      </form>
      <p className="text-center text-sm text-slate-700">
        Već imaš nalog?{" "}
        <Link href={signInHref} className={linkClassName}>
          Prijavi se
        </Link>
      </p>
    </div>
  );
}
