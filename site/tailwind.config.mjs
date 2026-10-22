import { tokens, typeScale } from "./design-tokens.mjs";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{astro,html,js,ts}",
    "./node_modules/seo-core/src/**/*.{astro,html,js,ts}",
    "../node_modules/seo-core/src/**/*.{astro,html,js,ts}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--c-bg)",
        surface: "var(--c-surface)",
        surfaceAlt: "var(--c-surfaceAlt)",
        fg: "var(--c-fg)",
        muted: "var(--c-muted)",
        border: "var(--c-border)",
        accent: {
          DEFAULT: "var(--c-accent)",
          hover: "var(--c-accentHover)",
          fg: "var(--c-accentFg)",
        },
        highlight: "var(--c-highlight)",
        band: "var(--c-band)",
        bandFg: "var(--c-bandFg)",
        bandMuted: "var(--c-bandMuted)",
        headerBg: "var(--c-headerBg)",
        headerFg: "var(--c-headerFg)",
        footerBg: "var(--c-footerBg)",
        footerFg: "var(--c-footerFg)",
        focus: "var(--c-focus)",
      },
      fontFamily: {
        sans: [
          "Inter Variable",
          "system-ui",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      fontSize: typeScale,
      screens: tokens.breakpoints,
      maxWidth: {
        container: "var(--container)",
        measure: "var(--measure)",
      },
    },
  },
  plugins: [],
};
