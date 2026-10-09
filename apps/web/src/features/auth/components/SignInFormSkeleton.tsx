import {
  AuthFormSkeleton,
  FieldSkeleton,
  LinkSkeleton,
} from "./AuthFormSkeleton";

// Mirrors SignInForm: email, password, and the "Forgot password?" link.
export function SignInFormSkeleton() {
  return (
    <AuthFormSkeleton>
      <FieldSkeleton />
      <div className="flex flex-col gap-2">
        <FieldSkeleton />
        <LinkSkeleton className="self-end" />
      </div>
    </AuthFormSkeleton>
  );
}
