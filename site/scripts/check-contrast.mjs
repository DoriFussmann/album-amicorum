import { tokens } from "../design-tokens.mjs";

const pairs = [
  ["fg", "bg"],
  ["muted", "bg"],
  ["fg", "surface"],
  ["muted", "surface"],
  ["muted", "surfaceAlt"],
  ["accentFg", "accent"],
  ["bandFg", "band"],
  ["bandMuted", "band"],
  ["headerFg", "headerBg"],
  ["footerFg", "footerBg"],
  ["accent", "bg"],
  ["accent", "surface"],
];

function channel(hex, index) {
  const value = Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  return 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
}

function contrast(a, b) {
  const left = luminance(a);
  const right = luminance(b);
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}

const errors = [];
for (const [foreground, background] of pairs) {
  const ratio = contrast(tokens.colors[foreground], tokens.colors[background]);
  if (ratio < 4.5) {
    errors.push(
      `${foreground}/${background} is ${ratio.toFixed(2)} (need ≥ 4.5) — ${tokens.colors[foreground]} on ${tokens.colors[background]}`,
    );
  }
}

if (errors.length) {
  console.error(`check-contrast: ${errors.length} pair(s) below WCAG AA`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log(`check-contrast: ok — ${tokens.template}`);
