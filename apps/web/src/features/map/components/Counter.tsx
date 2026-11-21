import { ChromeIcon } from "./ChromeIcon";

type CounterProps = {
  icon: "star" | "heart";
  label: string;
  value: number;
};

// A white pill with an icon and a number (Figma "Counter"): the top bar's
// stars and hearts, and the stars on the Prizes screen.
export function Counter({ icon, label, value }: CounterProps) {
  return (
    <div
      role="group"
      aria-label={`${label}: ${value}`}
      className="flex items-center gap-1.5 rounded-badge border-3 border-kid-ink bg-white py-1.5 pl-2 pr-3.5 shadow-raised-4"
    >
      <ChromeIcon name={icon} size={26} />
      <span
        aria-hidden="true"
        className="text-2xl font-semibold leading-tight text-kid-ink"
      >
        {value}
      </span>
    </div>
  );
}
