"use client";

import { EnvelopeIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useId } from "react";

import { FormNotice } from "@/components/ui/FormNotice";
import { SMALL_LINK } from "@/components/ui/kid-styles";
import { PasswordField } from "@/components/ui/PasswordField";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { useNavigate } from "@/lib/use-navigate";

import { signIn } from "../api/auth-api";
import { signInFields } from "../errors";
import { useAuthForm } from "../hooks/use-auth-form";
import {
  authPageHref,
  postAuthRedirectPath,
  FORGOT_PASSWORD_PATH,
  SIGN_IN_NOTICES,
  SIGN_UP_PATH,
  type SignInNotice,
} from "../model/routes";
import { validateSignIn } from "../model/validation";
import { AuthSubmitButton } from "./AuthSubmitButton";
import { ErrorSummary } from "./ErrorSummary";
import { kidLinkClassName } from "./link-class-name";
import { WelcomeFormHeader } from "./WelcomeFormHeader";

type SignInFormProps = {
  /** Where to go after signing in, from the page's `?next=`. */
  redirectTo: string;
  /** A message from the step before, such as a password reset, from the page's `?notice=`. */
  notice?: SignInNotice | null;
};

// The sign-in panel (#153, Figma "1 · Welcome & Auth"), inside the welcome
// frame of the (welcome) layout.
export function SignInForm({ redirectTo, notice = null }: SignInFormProps) {
  const router = useNavigate();
  const titleId = useId();
  // The value comes from the URL, so it is checked here too; a safe path is unchanged.
  const destination = postAuthRedirectPath(redirectTo);
  const {
    fieldProps,
    failure,
    rejectedFieldCount,
    attempt,
    isPending,
    handleSubmit,
    formRef,
    summaryRef,
    retryAfterSeconds,
  } = useAuthForm({
    initialValues: { email: "", password: "" },
    validate: validateSignIn,
    apiFields: signInFields,
    focusOnError: "summary",
    submit: async (credentials) => {
      await signIn(credentials);
    },
    onSuccess: () => {
      router.replace(destination);
      // Re-renders Server Components for the signed-in user.
      router.refresh();
    },
  });

  return (
    <div className="flex flex-1 flex-col gap-4">
      <WelcomeFormHeader
        titleId={titleId}
        title="Dobro došli nazad"
        lead="Prijavi se da nastaviš istraživanje."
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
        {/* Shown until the first submit, so it never sits beside an error. */}
        {notice !== null && attempt === 0 ? (
          <FormNotice
            message={SIGN_IN_NOTICES[notice]}
            className="rounded-kid-lg border-3 border-green-700 text-lg font-semibold"
          />
        ) : null}
        <ErrorSummary
          key={attempt}
          ref={summaryRef}
          rejectedFieldCount={rejectedFieldCount}
          formError={failure?.formError}
        />
        <TextField
          {...fieldProps("email")}
          appearance="kid"
          icon={EnvelopeIcon}
          label="E-pošta"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
        <div className="flex flex-col gap-1">
          <PasswordField
            {...fieldProps("password")}
            appearance="kid"
            icon={LockClosedIcon}
            label="Lozinka"
            toggleLabel="Prikaži lozinku"
            autoComplete="current-password"
            required
          />
          <Link
            href={FORGOT_PASSWORD_PATH}
            className={cn(SMALL_LINK, "-mr-3 self-end text-base")}
          >
            Zaboravili ste lozinku?
          </Link>
        </div>
        <div className="mt-auto flex flex-col gap-3 pt-1">
          <AuthSubmitButton
            appearance="kid"
            isPending={isPending}
            pendingLabel="Prijavljujem…"
            retryAfterSeconds={retryAfterSeconds}
          >
            Prijavi se
          </AuthSubmitButton>
          <p className="text-center text-lg font-medium text-kid-muted">
            Nemaš nalog?{" "}
            <Link
              href={authPageHref(SIGN_UP_PATH, destination)}
              className={kidLinkClassName}
            >
              Napravi nalog
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
