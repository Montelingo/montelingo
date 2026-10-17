import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

// Design tokens (docs/frontend-architecture.md §8). Components use these names,
// never one-off values, and pick state classes from static lookup maps so the
// content scan sees every full class name.
//
// Text pairs are WCAG AA (4.5:1) or better:
// - ink on surface or surface-muted, ink-muted on surface
// - action-ink on action (and on action-hover)
// - each tile state's ink on its badge
// - next-ink on next
// - each art palette's ink on its bg (the art is decorative, but the initial
//   should still read)

// Touch targets: 48 CSS px is the minimum for a control; the learner area's
// own controls use the larger size, for small fingers.
const touchSizes = {
  touch: "3rem",
  "touch-lg": "3.5rem",
};

// The learner area's side gutter, widened to the safe area on devices with a
// notch or rounded corners (non-zero only with `viewport-fit=cover`).
const GUTTER = "1.5rem";
const BAR_GAP = "0.75rem";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: colors.slate[900], muted: colors.slate[700] },
        // sunken: skeleton blocks standing in for content while it loads.
        surface: {
          DEFAULT: colors.white,
          muted: colors.slate[100],
          sunken: colors.slate[200],
        },
        focus: colors.indigo[600],
        // Primary buttons and button-like links: action-ink on action.
        action: {
          DEFAULT: colors.indigo[700],
          hover: colors.indigo[800],
          ink: colors.white,
        },
        // TileCard, one entry per state: the card's edge, and the badge's
        // background and text. Every state also has an icon and a label, so
        // colour is never the only signal.
        tile: {
          locked: {
            edge: colors.slate[500],
            badge: colors.slate[200],
            ink: colors.slate[800],
          },
          available: {
            edge: colors.indigo[600],
            badge: colors.indigo[100],
            ink: colors.indigo[800],
          },
          active: {
            edge: colors.teal[600],
            badge: colors.teal[100],
            ink: colors.teal[800],
          },
          "in-progress": {
            edge: colors.sky[600],
            badge: colors.sky[100],
            ink: colors.sky[800],
          },
          completed: {
            edge: colors.green[600],
            badge: colors.green[100],
            ink: colors.green[800],
          },
          loading: {
            edge: colors.slate[300],
            badge: colors.slate[100],
            ink: colors.slate[700],
          },
          error: {
            edge: colors.red[600],
            badge: colors.red[100],
            ink: colors.red[800],
          },
        },
        // The "next place to go" mark: a thick edge and a labelled ribbon.
        next: {
          DEFAULT: colors.amber[300],
          edge: colors.amber[500],
          ink: colors.amber[950],
        },
        // PlaceholderArt palettes: background, pattern, and initial.
        art: {
          1: {
            bg: colors.rose[100],
            pattern: colors.rose[300],
            ink: colors.rose[900],
          },
          2: {
            bg: colors.amber[100],
            pattern: colors.amber[300],
            ink: colors.amber[900],
          },
          3: {
            bg: colors.lime[100],
            pattern: colors.lime[300],
            ink: colors.lime[900],
          },
          4: {
            bg: colors.emerald[100],
            pattern: colors.emerald[300],
            ink: colors.emerald[900],
          },
          5: {
            bg: colors.cyan[100],
            pattern: colors.cyan[300],
            ink: colors.cyan[900],
          },
          6: {
            bg: colors.blue[100],
            pattern: colors.blue[300],
            ink: colors.blue[900],
          },
          7: {
            bg: colors.violet[100],
            pattern: colors.violet[300],
            ink: colors.violet[900],
          },
          8: {
            bg: colors.fuchsia[100],
            pattern: colors.fuchsia[300],
            ink: colors.fuchsia[900],
          },
        },
      },
      spacing: {
        ...touchSizes,
        gutter: GUTTER,
      },
      // Tailwind 3.4 derives these from `spacing` too; listed so the touch
      // sizes do not depend on that.
      size: touchSizes,
      minHeight: touchSizes,
      minWidth: touchSizes,
      // Padding that keeps content inside the safe area: the gutter, or the
      // inset when it is larger. env() falls back to 0px where unsupported.
      padding: {
        "safe-t": `max(${BAR_GAP}, env(safe-area-inset-top, 0px))`,
        "safe-r": `max(${GUTTER}, env(safe-area-inset-right, 0px))`,
        "safe-b": `max(${GUTTER}, env(safe-area-inset-bottom, 0px))`,
        "safe-l": `max(${GUTTER}, env(safe-area-inset-left, 0px))`,
      },
      maxWidth: {
        learner: "72rem",
      },
      borderRadius: {
        tile: "1.25rem",
        badge: "9999px",
      },
      aspectRatio: {
        tile: "4 / 3",
      },
      gridTemplateColumns: {
        // As many columns of at least 13rem as fit, never wider than the
        // container. auto-fill (not auto-fit) keeps empty tracks, so three
        // cards on a wide screen stay tile-sized instead of stretching.
        //
        // Smallest supported tablet, iPad mini 6 (744 × 1133 CSS px), minus
        // the 1.5rem gutter on each side, with the 1rem (gap-4) gap:
        // - portrait: 744 − 48 = 696 px; 3 columns need 3·208 + 2·16 = 656 ✓
        //   (4 would need 880)
        // - landscape: 1133 − 48 = 1085 px; 4 columns need 4·208 + 3·16 = 880 ✓
        //   (5 would need 1104)
        // Tailwind's md breakpoint (768px) is wider than the portrait tablet,
        // so the grid relies on this rule, not on breakpoints.
        tiles: "repeat(auto-fill, minmax(min(100%, 13rem), 1fr))",
      },
      keyframes: {
        // A locked card's answer to a tap: a small shake.
        wiggle: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "20%": { transform: "rotate(-3deg)" },
          "40%": { transform: "rotate(3deg)" },
          "60%": { transform: "rotate(-2deg)" },
          "80%": { transform: "rotate(2deg)" },
        },
        // The same answer without movement, for prefers-reduced-motion.
        "locked-flash": {
          "0%, 100%": { boxShadow: `0 0 0 0 ${colors.slate[500]}` },
          "50%": { boxShadow: `0 0 0 6px ${colors.slate[500]}` },
        },
      },
      animation: {
        // TileCard's WIGGLE_DURATION_MS matches these durations.
        wiggle: "wiggle 400ms ease-in-out",
        "locked-flash": "locked-flash 400ms ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
