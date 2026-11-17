// Form copy and limits, kept free of zod so that error mapping (errors.ts) can
// use them without pulling the schemas into every bundle that shows an error.

import { MONTENEGRIN } from "@/lib/locale";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** "Try again in 2:00" or "… in 2 minuta": the rate-limit wait, after "za". */
export function retryIn(wait: string): string {
  return `Pokušaj ponovo za ${wait}`;
}

const countRules = new Intl.PluralRules(MONTENEGRIN);

/**
 * The error summary's line, "Ispravi 2 stvari ispod", with the noun in
 * Montenegrin's forms: 1 (and 21, 31, …) stvar, the rest stvari.
 */
export function fixBelow(count: number): string {
  const noun = countRules.select(count) === "one" ? "stvar" : "stvari";
  return `Ispravi ${count} ${noun} ispod`;
}

export const validationMessages = {
  emailRequired: "Upiši adresu e-pošte.",
  emailInvalid: "Upiši ispravnu adresu e-pošte, na primjer ime@primjer.com.",
  passwordRequired: "Upiši lozinku.",
  passwordTooShort: `Lozinka mora imati najmanje ${PASSWORD_MIN_LENGTH} znakova.`,
  passwordTooLong: `Lozinka može imati najviše ${PASSWORD_MAX_LENGTH} znakova.`,
  passwordLength: `Lozinka mora imati od ${PASSWORD_MIN_LENGTH} do ${PASSWORD_MAX_LENGTH} znakova.`,
  signInPassword: `Upiši lozinku (najviše ${PASSWORD_MAX_LENGTH} znakova).`,
  confirmPasswordRequired: "Upiši lozinku još jednom.",
  passwordsDiffer: "Lozinke se ne poklapaju.",
};
