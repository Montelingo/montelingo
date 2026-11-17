// Form copy and limits, kept free of zod so that error mapping (errors.ts) can
// use them without pulling the schemas into every bundle that shows an error.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** "Try again in 2:00" or "… in 2 minuta": the rate-limit wait, after "za". */
export function retryIn(wait: string): string {
  return `Pokušaj ponovo za ${wait}`;
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
