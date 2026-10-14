"use client";

import { useId } from "react";

import { FormAlert } from "@/components/ui/FormAlert";
import { PasswordField } from "@/components/ui/PasswordField";
import { replaceDocument } from "@/lib/navigation";

import { confirmPasswordReset } from "../api/auth-api";
import { passwordResetConfirmFields } from "../errors";
import { useAuthForm } from "../hooks/use-auth-form";
import { PASSWORD_MIN_LENGTH } from "../model/messages";
import { signInNoticeHref } from "../model/routes";
import { validatePasswordResetConfirm } from "../model/validation";
import { AuthSubmitButton } from "./AuthSubmitButton";
import { InvalidResetLink } from "./InvalidResetLink";

type ResetPasswordFormProps = {
  /** The reset link's token, from the page's `?token=`. Sent as is, never shown or logged. */
  token: string;
};

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const titleId = useId();
  const {
    fieldProps,
    failure,
    attempt,
    isPending,
    handleSubmit,
    formRef,
    retryAfterSeconds,
  } = useAuthForm({
    initialValues: { newPassword: "", confirmPassword: "" },
    validate: validatePasswordResetConfirm,
    apiFields: passwordResetConfirmFields,
    submit: async ({ newPassword }) => {
      await confirmPasswordReset({ token, newPassword });
    },
    onSuccess: () => {
      // The reset revoked every session, so a new document drops all client
      // state and the router cache in one request. Replacing this history
      // entry keeps the used link out of Back.
      replaceDocument(signInNoticeHref("password-updated"));
    },
  });

  // Used, expired, or never valid (including a 422 on the token): retrying
  // cannot help, so the form gives way to the request-a-new-link page.
  if (failure?.code === "invalid_reset_token") {
    return <InvalidResetLink focusOnMount />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 id={titleId} className="text-2xl font-bold text-slate-900">
          Choose a new password
        </h1>
        <p className="text-slate-700">
          Once it’s updated, you’ll need to sign in again on every device.
        </p>
      </div>
      {/* The submit button stays disabled until hydration. method="post" only
          guarantees the passwords never land in a URL. */}
      <form
        ref={formRef}
        method="post"
        aria-labelledby={titleId}
        noValidate
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        <FormAlert key={attempt} message={failure?.formError} />
        <PasswordField
          {...fieldProps("newPassword")}
          label="New password"
          description={`Use at least ${PASSWORD_MIN_LENGTH} characters.`}
          autoComplete="new-password"
          required
        />
        <PasswordField
          {...fieldProps("confirmPassword")}
          label="Confirm new password"
          autoComplete="new-password"
          required
        />
        <AuthSubmitButton
          isPending={isPending}
          pendingLabel="Updating…"
          retryAfterSeconds={retryAfterSeconds}
        >
          Update password
        </AuthSubmitButton>
      </form>
    </div>
  );
}
