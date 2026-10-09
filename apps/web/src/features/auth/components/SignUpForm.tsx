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
          Create your account
        </h1>
        <p className="text-slate-700">Start learning with Montelingo.</p>
      </div>
      {/* method="post": submitted natively before hydration, the
          credentials go in the request body, never in the URL. */}
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
                  Go to sign in
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
                  Sign in instead
                </Link>
              </>
            ) : (
              emailField.error
            )
          }
          label="Email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
        <PasswordField
          {...fieldProps("password")}
          label="Password"
          description={`Use at least ${PASSWORD_MIN_LENGTH} characters.`}
          autoComplete="new-password"
          required
        />
        <PasswordField
          {...fieldProps("confirmPassword")}
          label="Confirm password"
          autoComplete="new-password"
          required
        />
        <AuthSubmitButton
          isPending={isPending}
          pendingLabel="Creating account…"
          retryAfterSeconds={retryAfterSeconds}
        >
          Create account
        </AuthSubmitButton>
      </form>
      <p className="text-center text-sm text-slate-700">
        Already have an account?{" "}
        <Link href={signInHref} className={linkClassName}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
