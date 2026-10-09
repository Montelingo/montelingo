"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId } from "react";

import { FormAlert } from "@/components/ui/FormAlert";
import { PasswordField } from "@/components/ui/PasswordField";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";

import { signIn } from "../api/auth-api";
import { signInFields } from "../errors";
import { useAuthForm } from "../hooks/use-auth-form";
import {
  authPageHref,
  postAuthRedirectPath,
  FORGOT_PASSWORD_PATH,
  SIGN_UP_PATH,
} from "../model/routes";
import { validateSignIn } from "../model/validation";
import { AuthSubmitButton } from "./AuthSubmitButton";
import { linkClassName } from "./link-class-name";

type SignInFormProps = {
  /** Where to go after signing in, from the page's `?next=`. */
  redirectTo: string;
};

export function SignInForm({ redirectTo }: SignInFormProps) {
  const router = useRouter();
  const titleId = useId();
  // The value comes from the URL, so it is checked here too; a safe path is unchanged.
  const destination = postAuthRedirectPath(redirectTo);
  const {
    fieldProps,
    failure,
    attempt,
    isPending,
    handleSubmit,
    formRef,
    retryAfterSeconds,
  } = useAuthForm({
    initialValues: { email: "", password: "" },
    validate: validateSignIn,
    apiFields: signInFields,
    submit: async (credentials) => {
      await signIn(credentials);
    },
    onSuccess: () => {
      router.replace(destination);
      // Re-renders Server Components (such as the header) for the signed-in user.
      router.refresh();
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 id={titleId} className="text-2xl font-bold text-slate-900">
          Sign in
        </h1>
        <p className="text-slate-700">Welcome back to Montelingo.</p>
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
        <div className="flex flex-col gap-2">
          <PasswordField
            {...fieldProps("password")}
            label="Password"
            autoComplete="current-password"
            required
          />
          <Link
            href={FORGOT_PASSWORD_PATH}
            className={cn(linkClassName, "self-end text-sm")}
          >
            Forgot password?
          </Link>
        </div>
        <AuthSubmitButton
          isPending={isPending}
          pendingLabel="Signing in…"
          retryAfterSeconds={retryAfterSeconds}
        >
          Sign in
        </AuthSubmitButton>
      </form>
      <p className="text-center text-sm text-slate-700">
        New to Montelingo?{" "}
        <Link
          href={authPageHref(SIGN_UP_PATH, destination)}
          className={linkClassName}
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
