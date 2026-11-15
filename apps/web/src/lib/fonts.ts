import localFont from "next/font/local";

// The learner area's display font (designers' handoff): Fredoka, SemiBold for
// map labels and numbers, Medium for captions. Loaded once, here, so every
// screen that uses it shares its files.
//
// It is served from the repository, not fetched from Google Fonts at build
// time: that fetch made the build fail whenever Google's CSS listed a font URL
// next/font could not parse. The files are Fredoka (SIL Open Font License,
// fonts/OFL.txt) with Č č Ć ć Đ đ Ś ś Ź ź added, which Fredoka lacks and
// Montenegrin needs; scripts/build_font.py makes them.
export const fredoka = localFont({
  src: [
    { path: "./fonts/fredoka-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/fredoka-600.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
});
