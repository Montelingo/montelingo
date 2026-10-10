// Form copy and limits, kept free of zod so that error mapping (errors.ts) can
// use them without pulling the schemas into every bundle that shows an error.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const validationMessages = {
  emailRequired: "Enter your email address.",
  emailInvalid: "Enter a valid email address, like name@example.com.",
  passwordRequired: "Enter your password.",
  passwordTooShort: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
  passwordTooLong: `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`,
  passwordLength: `Use ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters.`,
  signInPassword: `Enter your password (up to ${PASSWORD_MAX_LENGTH} characters).`,
  confirmPasswordRequired: "Enter your password again.",
  passwordsDiffer: "Passwords don’t match.",
};
