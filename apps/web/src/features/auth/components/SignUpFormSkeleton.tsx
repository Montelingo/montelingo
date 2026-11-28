import {
  AuthFormSkeleton,
  CheckboxSkeleton,
  FieldSkeleton,
} from "./AuthFormSkeleton";

// Mirrors SignUpForm: the chip, email with its note, password with its rule,
// the confirmation, and the consent checkbox.
export function SignUpFormSkeleton() {
  return (
    <AuthFormSkeleton hasChip>
      <FieldSkeleton hasDescription />
      <FieldSkeleton hasDescription />
      <FieldSkeleton />
      <CheckboxSkeleton />
    </AuthFormSkeleton>
  );
}
