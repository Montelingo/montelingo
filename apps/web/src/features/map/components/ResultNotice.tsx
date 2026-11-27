import type { SaveResult } from "../hooks/use-save-result";
import { HeartNotice } from "./HeartNotice";
import { SaveNotice } from "./SaveNotice";

type ResultNoticeProps = Pick<
  SaveResult,
  "status" | "hasFailed" | "heartEarned" | "retry"
>;

// What a saved lesson or game says under the "Bravo!" praise: the heart a
// replay earned (ADR 0009), and a failed save with its retry. `null` when
// there is neither, so the screen keeps its layout.
export function ResultNotice({
  status,
  hasFailed,
  heartEarned,
  retry,
}: ResultNoticeProps) {
  if (!hasResultNotice({ hasFailed, heartEarned })) {
    return null;
  }
  return (
    <div className="flex w-full flex-col items-center gap-3">
      {heartEarned ? <HeartNotice /> : null}
      {hasFailed ? <SaveNotice status={status} onRetry={retry} /> : null}
    </div>
  );
}

/** Whether a ResultNotice for this save would show anything. */
export function hasResultNotice({
  hasFailed,
  heartEarned,
}: Pick<SaveResult, "hasFailed" | "heartEarned">): boolean {
  return hasFailed || heartEarned;
}
