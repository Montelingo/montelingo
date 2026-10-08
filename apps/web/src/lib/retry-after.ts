// Waits longer than this are not real waits worth showing to a user.
const MAX_RETRY_AFTER_SECONDS = 24 * 60 * 60;

// The three HTTP-date formats recipients must accept (RFC 9110 §5.6.7):
// IMF-fixdate, RFC 850, and asctime. Date.parse alone would also accept values
// like "1.5" as a date.
const HTTP_DATE_FORMATS = [
  /^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/,
  /^[A-Za-z]{6,9}, \d{2}-[A-Za-z]{3}-\d{2} \d{2}:\d{2}:\d{2} GMT$/,
  /^[A-Za-z]{3} [A-Za-z]{3} [ \d]\d \d{2}:\d{2}:\d{2} \d{4}$/,
];

/**
 * Reads a `Retry-After` header (RFC 9110 §10.2.3) as whole seconds from `now`:
 * a number of seconds, or an HTTP date (rounded up, and 0 once it has passed).
 * Returns `null` when the header is missing, malformed, or more than a day away.
 */
export function parseRetryAfter(
  value: string | null,
  now: Date = new Date(),
): number | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  let seconds: number;
  if (/^\d+$/.test(trimmed)) {
    seconds = Number(trimmed);
  } else if (HTTP_DATE_FORMATS.some((format) => format.test(trimmed))) {
    // asctime has no zone, but HTTP dates are always GMT.
    const date = Date.parse(
      trimmed.endsWith("GMT") ? trimmed : `${trimmed} GMT`,
    );
    seconds = Math.max(0, Math.ceil((date - now.getTime()) / 1000));
  } else {
    return null;
  }
  return Number.isNaN(seconds) || seconds > MAX_RETRY_AFTER_SECONDS
    ? null
    : seconds;
}
