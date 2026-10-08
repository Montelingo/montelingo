import { cn } from "@/lib/cn";

type FormAlertProps = {
  message?: string | null;
  className?: string;
};

// Mounts only while there is a message: screen readers announce a role="alert"
// element when it appears. Give it a new `key` per submit attempt so a repeated
// identical message is announced again.
export function FormAlert({ message, className }: FormAlertProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800",
        className,
      )}
    >
      {message}
    </div>
  );
}
