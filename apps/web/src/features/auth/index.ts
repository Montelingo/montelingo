// The auth feature's public API for routes, Client Components, and other
// features. Server-only parts (getCurrentUser) are exported from ./server.
export {
  confirmPasswordReset,
  requestPasswordReset,
  signIn,
  signOut,
  signUp,
  signUpAndSignIn,
  type Credentials,
  type PasswordResetConfirmation,
} from "./api/auth-api";
export {
  authErrorMessages,
  passwordResetConfirmFields,
  passwordResetRequestFields,
  SignInAfterSignUpError,
  signInFields,
  signUpFields,
  toAuthFormError,
  type ApiFieldMap,
  type AuthFormError,
} from "./errors";
export { safeRedirectPath } from "./model/redirect";
export type { CurrentUser } from "./model/user";
export {
  validatePasswordResetConfirm,
  validatePasswordResetRequest,
  validateSignIn,
  validateSignUp,
  type FieldErrors,
  type PasswordResetConfirmField,
  type PasswordResetConfirmForm,
  type PasswordResetRequestField,
  type PasswordResetRequestForm,
  type SignInField,
  type SignInForm,
  type SignUpField,
  type SignUpForm,
  type ValidationResult,
} from "./model/validation";
export { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./model/messages";
