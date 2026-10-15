import type { Metadata } from "next";

import { LearnerHomePlaceholder } from "@/features/learner";

export const metadata: Metadata = {
  title: "Your map",
};

export default function PlayPage() {
  return <LearnerHomePlaceholder />;
}
