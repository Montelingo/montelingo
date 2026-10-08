import { ApiClientError, unwrap } from "@app/api-client";

import { getBrowserApiClient } from "@/lib/browser-api";

import { SignInAfterSignUpError } from "../errors";
import type { CurrentUser } from "../model/user";
import { toCurrentUser } from "./current-user";

// Every auth mutation runs in the browser, through the same-origin proxy, so the
// API sees the real Origin (CSRF check) and the session cookie reaches the browser.

export type Credentials = {
  email: string;
  password: string;
};

export type PasswordResetConfirmation = {
  token: string;
  newPassword: string;
};

/** Creates an account. It does not sign the user in (ADR 0004); see signUpAndSignIn(). */
export async function signUp({
  email,
  password,
}: Credentials): Promise<CurrentUser> {
  const user = await unwrap(
    getBrowserApiClient().POST("/api/v1/auth/sign-up", {
      body: { email, password },
    }),
  );
  return toCurrentUser(user);
}

/** Signs in. The API sets the session cookie on the response. */
export async function signIn({
  email,
  password,
}: Credentials): Promise<CurrentUser> {
  const user = await unwrap(
    getBrowserApiClient().POST("/api/v1/auth/sign-in", {
      body: { email, password },
    }),
  );
  return toCurrentUser(user);
}

/**
 * Creates an account, then signs in with the same credentials. A sign-up error
 * is thrown as is. If the account was created but sign-in fails, the error is a
 * `SignInAfterSignUpError` wrapping the sign-in error, because retrying the
 * whole flow would now fail with `email_taken`.
 */
export async function signUpAndSignIn(
  credentials: Credentials,
): Promise<CurrentUser> {
  await signUp(credentials);
  try {
    return await signIn(credentials);
  } catch (error) {
    throw new SignInAfterSignUpError({ cause: error });
  }
}

/**
 * Signs out. The API revokes the session and clears its cookie. A session that
 * has already expired (`401`) counts as signed out.
 */
export async function signOut(): Promise<void> {
  try {
    await unwrap(getBrowserApiClient().POST("/api/v1/auth/sign-out"));
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      return;
    }
    throw error;
  }
}

/** Asks for a reset email. The API answers the same whether or not the account exists. */
export async function requestPasswordReset({
  email,
}: {
  email: string;
}): Promise<void> {
  await unwrap(
    getBrowserApiClient().POST("/api/v1/auth/password-reset", {
      body: { email },
    }),
  );
}

/** Sets a new password with a reset-link token. It revokes every session and does not sign in. */
export async function confirmPasswordReset({
  token,
  newPassword,
}: PasswordResetConfirmation): Promise<void> {
  await unwrap(
    getBrowserApiClient().POST("/api/v1/auth/password-reset/confirm", {
      body: { token, new_password: newPassword },
    }),
  );
}
