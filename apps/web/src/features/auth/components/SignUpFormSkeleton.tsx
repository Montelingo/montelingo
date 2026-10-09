import { AuthFormSkeleton, FieldSkeleton } from "./AuthFormSkeleton";

// Mirrors SignUpForm: email, password with its rule, and the confirmation.
export function SignUpFormSkeleton() {
  return (
    <AuthFormSkeleton>
      <FieldSkeleton />
      <FieldSkeleton hasDescription />
      <FieldSkeleton />
    </AuthFormSkeleton>
  );
}
