import "server-only";

import { unwrap } from "@app/api-client";
import { unstable_rethrow } from "next/navigation";

import { getApiClient } from "@/lib/api";

import { PRIVACY_POLICY_VERSION } from "../model/policy";

// Bounds the read, so an API that never answers cannot hold the sign-up page.
export const POLICY_VERSION_TIMEOUT_MS = 3_000;

/**
 * The version of the privacy policy in force, from the API, which records
 * consent and so owns the version (ADR 0008). Sign-up sends it back with the
 * consent, and the API refuses a version that is no longer current.
 *
 * If the API cannot be read, this returns the version the web ships: the text
 * `/privatnost` shows. The page still renders, and if the versions differ the
 * sign-up gets `409 privacy_policy_outdated`, so no consent is recorded to text
 * the grown-up did not see.
 */
export async function getPrivacyPolicyVersion(): Promise<string> {
  try {
    const policy = await unwrap(
      getApiClient().GET("/api/v1/privacy-policy", {
        signal: AbortSignal.timeout(POLICY_VERSION_TIMEOUT_MS),
      }),
    );
    // The route documents no error response, so the client's type allows a
    // success without a body.
    if (policy === undefined) {
      throw new Error("The privacy policy response had no body.");
    }
    return policy.version;
  } catch (error) {
    unstable_rethrow(error);
    console.error("privacy_policy_version_unavailable", error);
    return PRIVACY_POLICY_VERSION;
  }
}
