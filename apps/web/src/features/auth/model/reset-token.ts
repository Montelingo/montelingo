// The API's limit for a reset token (apps/api/app/modules/auth/schemas.py),
// counted in code points like the API does.
const RESET_TOKEN_MAX_LENGTH = 256;

/**
 * Reads the reset-password page's `?token=`: a single value the API could
 * accept, or `null`. The token is opaque, so it is passed on exactly as it
 * arrived, never trimmed or checked further; the API judges it.
 */
export function parseResetToken(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value === "" ||
    [...value].length > RESET_TOKEN_MAX_LENGTH
  ) {
    return null;
  }
  return value;
}
