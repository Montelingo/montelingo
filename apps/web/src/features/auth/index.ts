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
export { SignInForm } from "./components/SignInForm";
export { SignInFormSkeleton } from "./components/SignInFormSkeleton";
export { SignUpForm } from "./components/SignUpForm";
export { SignUpFormSkeleton } from "./components/SignUpFormSkeleton";
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
export { postAuthRedirectPath } from "./model/routes";
export type { CurrentUser } from "./model/user";
export {
  validatePasswordResetConfirm,
  validatePasswordResetRequest,
  validateSignIn,
  validateSignUp,
  type FieldErrors,
  type PasswordResetConfirmField,
  type PasswordResetConfirmValues,
  type PasswordResetRequestField,
  type PasswordResetRequestValues,
  type SignInField,
  type SignInValues,
  type SignUpField,
  type SignUpValues,
  type ValidationResult,
} from "./model/validation";
export { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./model/messages";
