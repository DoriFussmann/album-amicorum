import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function guidePath() {
  const besideModule = join(dirname(fileURLToPath(import.meta.url)), "Design Guide.md");
  if (existsSync(besideModule)) return besideModule;
  const fromCwd = join(process.cwd(), "Design Guide.md");
  if (existsSync(fromCwd)) return fromCwd;
  throw new Error("Design tokens: missing Design Guide.md.");
}

const guide = readFileSync(guidePath(), "utf8");
const match = guide.match(/```tokens\r?\n([\s\S]*?)\r?\n```/);
if (!match) {
  throw new Error("Design tokens: missing ```tokens fence in Design Guide.md.");
}

let parsed;
try {
  parsed = JSON.parse(match[1]);
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  throw new Error(`Design tokens: the \`\`\`tokens fence is not valid JSON — ${detail}.`);
}

const TEMPLATES = ["slate", "midnight", "press", "daylight", "night", "field"];
const COLOR_KEYS = [
  "bg",
  "surface",
  "surfaceAlt",
  "fg",
  "muted",
  "border",
  "accent",
  "accentHover",
  "accentFg",
  "highlight",
  "band",
  "bandFg",
  "bandMuted",
  "headerBg",
  "headerFg",
  "footerBg",
  "footerFg",
  "focus",
];
const HEX = /^#[0-9A-Fa-f]{6}$/;
const DENSITY = {
  compact: { mobile: 40, desktop: 64 },
  regular: { mobile: 56, desktop: 96 },
  airy: { mobile: 72, desktop: 128 },
};

function fail(key, detail) {
  throw new Error(`Design tokens: invalid "${key}" — ${detail}.`);
}

function missing(key) {
  throw new Error(`Design tokens: missing "${key}".`);
}

function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function requireObject(value, key) {
  if (!isObject(value)) missing(key);
  return value;
}

function requireKey(obj, key, path) {
  if (!Object.prototype.hasOwnProperty.call(obj, key) || obj[key] == null) missing(path);
  return obj[key];
}

function oneOf(value, key, allowed) {
  if (!allowed.includes(value)) fail(key, `expected one of ${allowed.join(" | ")}`);
  return value;
}

function requireString(value, key) {
  if (typeof value !== "string") fail(key, "expected a string");
  return value;
}

function requireNumber(value, key) {
  if (typeof value !== "number" || Number.isNaN(value)) fail(key, "expected a number");
  return value;
}

function requirePx(value, key) {
  const text = requireString(value, key);
  if (!/^\d+(?:\.\d+)?px$/.test(text)) fail(key, "expected a px length");
  return text;
}

function requireRem(value, key) {
  const text = requireString(value, key);
  if (!/^\d+(?:\.\d+)?rem$/.test(text)) fail(key, "expected a rem length");
  return text;
}

function pxNumber(value) {
  return Number.parseFloat(value);
}

if (!isObject(parsed)) missing("tokens");

if (!Object.prototype.hasOwnProperty.call(parsed, "version")) missing("version");
if (parsed.version !== 2) fail("version", "expected 2");

oneOf(requireKey(parsed, "template", "template"), "template", TEMPLATES);
requireString(requireKey(parsed, "templateName", "templateName"), "templateName");
requireString(requireKey(parsed, "tagline", "tagline"), "tagline");
oneOf(requireKey(parsed, "mode", "mode"), "mode", ["light", "dark"]);

const brand = requireObject(requireKey(parsed, "brand", "brand"), "brand");
requireString(requireKey(brand, "wordmarkPrimary", "brand.wordmarkPrimary"), "brand.wordmarkPrimary");
requireString(requireKey(brand, "wordmarkAccent", "brand.wordmarkAccent"), "brand.wordmarkAccent");

const colors = requireObject(requireKey(parsed, "colors", "colors"), "colors");
for (const key of COLOR_KEYS) {
  const value = requireKey(colors, key, `colors.${key}`);
  if (typeof value !== "string" || !HEX.test(value)) fail(`colors.${key}`, "expected a 6-digit hex color");
}

const type = requireObject(requireKey(parsed, "type", "type"), "type");
if (requireKey(type, "family", "type.family") !== "Inter Variable") {
  fail("type.family", 'expected "Inter Variable"');
}
requirePx(requireKey(type, "base", "type.base"), "type.base");
const scale = requireNumber(requireKey(type, "scale", "type.scale"), "type.scale");
if (scale <= 1) fail("type.scale", "expected a ratio greater than 1");
requireNumber(requireKey(type, "headingWeight", "type.headingWeight"), "type.headingWeight");
requireNumber(requireKey(type, "bodyWeight", "type.bodyWeight"), "type.bodyWeight");
const headingTracking = requireString(requireKey(type, "headingTracking", "type.headingTracking"), "type.headingTracking");
if (!/^-?\d+(?:\.\d+)?em$/.test(headingTracking)) fail("type.headingTracking", "expected an em length");
requireNumber(requireKey(type, "headingLeading", "type.headingLeading"), "type.headingLeading");
oneOf(requireKey(type, "eyebrow", "type.eyebrow"), "type.eyebrow", ["uppercase", "sentence"]);

const shape = requireObject(requireKey(parsed, "shape", "shape"), "shape");
requirePx(requireKey(shape, "radius", "shape.radius"), "shape.radius");
requirePx(requireKey(shape, "radiusLg", "shape.radiusLg"), "shape.radiusLg");
oneOf(requireKey(shape, "button", "shape.button"), "shape.button", ["solid", "outline", "pill"]);

const layout = requireObject(requireKey(parsed, "layout", "layout"), "layout");
oneOf(requireKey(layout, "density", "layout.density"), "layout.density", ["compact", "regular", "airy"]);
requireRem(requireKey(layout, "container", "layout.container"), "layout.container");
requireRem(requireKey(layout, "measure", "layout.measure"), "layout.measure");

const variants = requireObject(requireKey(parsed, "variants", "variants"), "variants");
oneOf(requireKey(variants, "header", "variants.header"), "variants.header", ["solid", "blur", "band"]);
oneOf(requireKey(variants, "hero", "variants.hero"), "variants.hero", ["plain", "band", "glow", "framed"]);
oneOf(requireKey(variants, "card", "variants.card"), "variants.card", ["line", "filled", "elevated"]);
oneOf(requireKey(variants, "rhythm", "variants.rhythm"), "variants.rhythm", ["alternate", "flat", "bands"]);
oneOf(requireKey(variants, "texture", "variants.texture"), "variants.texture", ["none", "grid", "dots"]);

const motion = requireObject(requireKey(parsed, "motion", "motion"), "motion");
oneOf(requireKey(motion, "style", "motion.style"), "motion.style", ["none", "fade", "rise"]);
requireNumber(requireKey(motion, "duration", "motion.duration"), "motion.duration");
requireString(requireKey(motion, "easing", "motion.easing"), "motion.easing");
requireNumber(requireKey(motion, "stagger", "motion.stagger"), "motion.stagger");
requireNumber(requireKey(motion, "carouselInterval", "motion.carouselInterval"), "motion.carouselInterval");

const imagery = requireObject(requireKey(parsed, "imagery", "imagery"), "imagery");
for (const key of ["treatment", "cssFilter", "direction", "avoid"]) {
  const value = requireString(requireKey(imagery, key, `imagery.${key}`), `imagery.${key}`);
  if (!value.trim()) fail(`imagery.${key}`, "expected a non-empty string");
}
requirePx(requireKey(imagery, "radius", "imagery.radius"), "imagery.radius");
const aspect = requireString(requireKey(imagery, "aspect", "imagery.aspect"), "imagery.aspect");
if (!/^\d+:\d+$/.test(aspect)) fail("imagery.aspect", 'expected a ratio like "4:5"');

const breakpoints = requireObject(requireKey(parsed, "breakpoints", "breakpoints"), "breakpoints");
for (const key of ["sm", "md", "lg", "xl"]) {
  requirePx(requireKey(breakpoints, key, `breakpoints.${key}`), `breakpoints.${key}`);
}

export const tokens = parsed;

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function clampFluid(minPx, maxPx, minVw, maxVw) {
  const min = round(minPx);
  const max = round(maxPx);
  if (max <= min) return `${max}px`;
  const slope = (max - min) / (maxVw - minVw);
  const intercept = min - slope * minVw;
  return `clamp(${min}px, ${round(intercept)}px + ${round(slope * 100)}vw, ${max}px)`;
}

const base = pxNumber(type.base);
const lgPx = pxNumber(breakpoints.lg);
const minVw = 390;

/** Modular steps for Tailwind keys xs…4xl. Headings use the clamp variables. */
export const typeScale = {
  xs: `${round(base / scale ** 2)}px`,
  sm: `${round(base / scale)}px`,
  base: `${round(base)}px`,
  lg: `${round(base * scale)}px`,
  xl: `${round(base * scale ** 2)}px`,
  "2xl": `${round(base * scale ** 3)}px`,
  "3xl": `${round(base * scale ** 4)}px`,
  "4xl": `${round(base * scale ** 5)}px`,
};

const h3 = base * scale ** 2;
const h2 = base * scale ** 3;
const h1 = base * scale ** 4;
const h3Mobile = base * scale;
const h2Mobile = h3;
const h1Mobile = h2;
const lead = base * 1.2;
const uppercase = type.eyebrow === "uppercase";
const density = DENSITY[layout.density];
const [aspectW, aspectH] = aspect.split(":");
const buttonRadius = shape.button === "pill" ? "999px" : shape.radius;

const colorVars = COLOR_KEYS.map((key) => `  --c-${key}: ${colors[key]};`).join("\n");

export function themeCss() {
  return `:root {
${colorVars}
  --font-sans: "${type.family}", system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --type-base: ${round(base)}px;
  --type-lead: ${round(lead)}px;
  --fs-h1: ${clampFluid(h1Mobile, h1, minVw, lgPx)};
  --fs-h2: ${clampFluid(h2Mobile, h2, minVw, lgPx)};
  --fs-h3: ${clampFluid(h3Mobile, h3, minVw, lgPx)};
  --heading-weight: ${type.headingWeight};
  --body-weight: ${type.bodyWeight};
  --heading-tracking: ${type.headingTracking};
  --heading-leading: ${type.headingLeading};
  --eyebrow-size: ${uppercase ? "0.78rem" : "0.95rem"};
  --eyebrow-tracking: ${uppercase ? "0.12em" : "0"};
  --eyebrow-transform: ${uppercase ? "uppercase" : "none"};
  --eyebrow-color: ${uppercase ? "var(--c-accent)" : "var(--c-muted)"};
  --eyebrow-band-color: ${uppercase ? "var(--c-highlight)" : "var(--c-muted)"};
  --radius: ${shape.radius};
  --radius-lg: ${shape.radiusLg};
  --radius-button: ${buttonRadius};
  --container: ${layout.container};
  --measure: ${layout.measure};
  --article-max-width: ${layout.container};
  --section-py: ${density.mobile}px;
  --motion-duration: ${motion.duration}ms;
  --motion-easing: ${motion.easing};
  --motion-stagger: ${motion.stagger}ms;
  --carousel-interval: ${motion.carouselInterval}ms;
  --imagery-filter: ${imagery.cssFilter};
  --imagery-radius: ${imagery.radius};
  --imagery-aspect: ${aspectW} / ${aspectH};
  --mask-solid: #000;
  color-scheme: ${parsed.mode};
}
@media (min-width: ${breakpoints.lg}) {
  :root { --section-py: ${density.desktop}px; }
}`;
}
