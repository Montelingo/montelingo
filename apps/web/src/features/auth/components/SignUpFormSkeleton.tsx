import { AuthFormSkeleton, FieldSkeleton } from "./AuthFormSkeleton";

// Mirrors SignUpForm: the chip, email with its note, password with its rule,
// and the confirmation.
export function SignUpFormSkeleton() {
  return (
    <AuthFormSkeleton hasChip>
      <FieldSkeleton hasDescription />
      <FieldSkeleton hasDescription />
      <FieldSkeleton />
    </AuthFormSkeleton>
  );
}
