import { MONTENEGRIN } from "@/lib/locale";

const countRules = new Intl.PluralRules(MONTENEGRIN);

/** "+1 srce": 1 (21, …) srce, every other count srca (ADR 0009). */
export function heartsText(count: number): string {
  const noun = countRules.select(count) === "one" ? "srce" : "srca";
  return `+${count} ${noun}`;
}
