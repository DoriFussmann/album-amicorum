/**
 * Design tokens. Reads the single ```tokens fence in DESIGN_GUIDE.md (repository
 * root), validates it against the guide's "Token contract (v3)", and exposes
 * `tokens`, `typeScale`, `extras` and `themeCss()`.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const GUIDE = "DESIGN_GUIDE.md";

function guidePath() {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "..", GUIDE),
    join(process.cwd(), "..", GUIDE),
    join(process.cwd(), GUIDE),
  ];
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error(`Design tokens: missing ${GUIDE} at the repository root.`);
  return found;
}

const guide = readFileSync(guidePath(), "utf8");
const match = guide.match(/```tokens\r?\n([\s\S]*?)\r?\n```/);
if (!match) throw new Error(`Design tokens: missing \`\`\`tokens fence in ${GUIDE}.`);

let parsed;
try {
  parsed = JSON.parse(match[1]);
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  throw new Error(`Design tokens: the \`\`\`tokens fence is not valid JSON — ${detail}.`);
}

const TEMPLATES = ["alpine", "heritage", "pristine", "kinetic", "tactile", "nocturne"];
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
  "accentInk",
  "highlight",
  "band",
  "bandFg",
  "bandMuted",
  "headerBg",
  "headerFg",
  "footerBg",
  "footerFg",
  "onImage",
  "focus",
];
const HEX = /^#[0-9A-Fa-f]{6}$/;
/** Section padding per density (guide: Layout & spacing). */
const DENSITY = {
  compact: { mobile: 40, desktop: 64 },
  regular: { mobile: 56, desktop: 96 },
  airy: { mobile: 64, desktop: 104 },
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
function requireString(value, key, nonEmpty = false) {
  if (typeof value !== "string") fail(key, "expected a string");
  if (nonEmpty && !value.trim()) fail(key, "expected a non-empty string");
  return value;
}
function requireNumber(value, key, min = -Infinity, max = Infinity) {
  if (typeof value !== "number" || Number.isNaN(value)) fail(key, "expected a number");
  if (value < min || value > max) fail(key, `expected a number from ${min} to ${max}`);
  return value;
}
function requireBoolean(value, key) {
  if (typeof value !== "boolean") fail(key, "expected true or false");
  return value;
}
function requireUnit(value, key, unit) {
  const text = requireString(value, key);
  if (!new RegExp(`^-?\\d+(?:\\.\\d+)?${unit}$`).test(text)) fail(key, `expected a ${unit} length`);
  return text;
}
function pick(obj, key, path) {
  return requireKey(obj, key, path);
}

if (!isObject(parsed)) missing("tokens");
if (!Object.prototype.hasOwnProperty.call(parsed, "version")) missing("version");
if (parsed.version !== 3) fail("version", "expected 3");

oneOf(pick(parsed, "template", "template"), "template", TEMPLATES);
requireString(pick(parsed, "templateName", "templateName"), "templateName", true);
requireString(pick(parsed, "tagline", "tagline"), "tagline");
oneOf(pick(parsed, "mode", "mode"), "mode", ["light", "dark"]);

const brand = requireObject(pick(parsed, "brand", "brand"), "brand");
requireString(pick(brand, "wordmarkPrimary", "brand.wordmarkPrimary"), "brand.wordmarkPrimary");
requireString(pick(brand, "wordmarkAccent", "brand.wordmarkAccent"), "brand.wordmarkAccent");

const colors = requireObject(pick(parsed, "colors", "colors"), "colors");
for (const key of COLOR_KEYS) {
  const value = pick(colors, key, `colors.${key}`);
  if (typeof value !== "string" || !HEX.test(value)) fail(`colors.${key}`, "expected a 6-digit hex color");
}

const type = requireObject(pick(parsed, "type", "type"), "type");
for (const role of ["display", "body"]) {
  const face = requireObject(pick(type, role, `type.${role}`), `type.${role}`);
  requireString(pick(face, "family", `type.${role}.family`), `type.${role}.family`, true);
  requireString(pick(face, "fallback", `type.${role}.fallback`), `type.${role}.fallback`, true);
  requireString(pick(face, "package", `type.${role}.package`), `type.${role}.package`, true);
  const imports = pick(face, "imports", `type.${role}.imports`);
  if (!Array.isArray(imports) || imports.length === 0 || imports.some((item) => typeof item !== "string")) {
    fail(`type.${role}.imports`, "expected a non-empty array of strings");
  }
}
requireUnit(pick(type, "base", "type.base"), "type.base", "px");
const scale = requireNumber(pick(type, "scale", "type.scale"), "type.scale");
if (scale <= 1) fail("type.scale", "expected a ratio greater than 1");
for (const key of ["headingWeight", "uiWeight", "strongWeight", "bodyWeight"]) {
  requireNumber(pick(type, key, `type.${key}`), `type.${key}`, 100, 900);
}
requireUnit(pick(type, "headingTracking", "type.headingTracking"), "type.headingTracking", "em");
requireNumber(pick(type, "headingLeading", "type.headingLeading"), "type.headingLeading");
oneOf(pick(type, "headingCase", "type.headingCase"), "type.headingCase", ["none", "uppercase"]);
oneOf(pick(type, "eyebrow", "type.eyebrow"), "type.eyebrow", ["uppercase", "sentence"]);
requireUnit(pick(type, "eyebrowTracking", "type.eyebrowTracking"), "type.eyebrowTracking", "em");

const shape = requireObject(pick(parsed, "shape", "shape"), "shape");
requireUnit(pick(shape, "radius", "shape.radius"), "shape.radius", "px");
requireUnit(pick(shape, "radiusLg", "shape.radiusLg"), "shape.radiusLg", "px");
oneOf(pick(shape, "button", "shape.button"), "shape.button", ["solid", "outline", "pill"]);

const layout = requireObject(pick(parsed, "layout", "layout"), "layout");
oneOf(pick(layout, "density", "layout.density"), "layout.density", ["compact", "regular", "airy"]);
requireUnit(pick(layout, "container", "layout.container"), "layout.container", "rem");
requireUnit(pick(layout, "measure", "layout.measure"), "layout.measure", "rem");

const variants = requireObject(pick(parsed, "variants", "variants"), "variants");
const VARIANT_ENUMS = {
  header: ["solid", "blur", "band"],
  hero: ["plain", "band", "glow", "framed", "photo"],
  heroOverlay: ["none", "dark", "fade", "vignette"],
  card: ["line", "filled", "elevated"],
  rhythm: ["alternate", "flat", "bands"],
  texture: ["none", "grid", "dots", "scanline"],
  hover: ["zoom", "lift", "jelly", "glitch", "brighten"],
  portrait: ["rounded", "circle", "square", "blob"],
  eyebrowMark: ["none", "dot", "rule", "slashes"],
};
for (const [key, allowed] of Object.entries(VARIANT_ENUMS)) {
  oneOf(pick(variants, key, `variants.${key}`), `variants.${key}`, allowed);
}

const motion = requireObject(pick(parsed, "motion", "motion"), "motion");
oneOf(pick(motion, "style", "motion.style"), "motion.style", ["none", "fade", "rise", "blur", "spring"]);
requireNumber(pick(motion, "duration", "motion.duration"), "motion.duration", 0);
requireString(pick(motion, "easing", "motion.easing"), "motion.easing", true);
requireNumber(pick(motion, "stagger", "motion.stagger"), "motion.stagger", 0);
requireNumber(pick(motion, "carouselInterval", "motion.carouselInterval"), "motion.carouselInterval", 0);

const imagery = requireObject(pick(parsed, "imagery", "imagery"), "imagery");
for (const key of ["treatment", "cssFilter", "direction", "avoid"]) {
  requireString(pick(imagery, key, `imagery.${key}`), `imagery.${key}`, true);
}
requireUnit(pick(imagery, "radius", "imagery.radius"), "imagery.radius", "px");
const aspect = requireString(pick(imagery, "aspect", "imagery.aspect"), "imagery.aspect");
if (!/^\d+:\d+$/.test(aspect)) fail("imagery.aspect", 'expected a ratio like "5:4"');

const overrides = requireObject(pick(parsed, "overrides", "overrides"), "overrides");
requireBoolean(pick(overrides, "forceInter", "overrides.forceInter"), "overrides.forceInter");
requireBoolean(pick(overrides, "forceNoBold", "overrides.forceNoBold"), "overrides.forceNoBold");

const breakpoints = requireObject(pick(parsed, "breakpoints", "breakpoints"), "breakpoints");
for (const key of ["sm", "md", "lg", "xl"]) {
  requireUnit(pick(breakpoints, key, `breakpoints.${key}`), `breakpoints.${key}`, "px");
}

export const tokens = parsed;

/**
 * Values the guide states in prose but not in the tokens block
 * ("Color palette", "Components"). Emitted as --x-<name>.
 */
export const extras = {
  outlineBorder: "#DDD5C8",
  cardHoverBorder: "#D6CDBF",
  footerRule: "#3D3833",
};

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

const base = Number.parseFloat(type.base);
const lgPx = Number.parseFloat(breakpoints.lg);
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
const uppercase = type.eyebrow === "uppercase";
const density = DENSITY[layout.density];
const [aspectW, aspectH] = aspect.split(":");
const buttonRadius = shape.button === "pill" ? "999px" : shape.radius;
const font = (face) => `"${face.family}", ${face.fallback}`;

export function themeCss() {
  const colorVars = COLOR_KEYS.map((key) => `  --c-${key}: ${colors[key]};`).join("\n");
  const extraVars = Object.entries(extras)
    .map(([key, value]) => `  --x-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${value};`)
    .join("\n");
  return `:root {
${colorVars}
${extraVars}
  --font-display: ${font(type.display)};
  --font-body: ${font(type.body)};
  --type-base: ${round(base)}px;
  --type-lead: ${round(base * 1.2)}px;
  --fs-h1: ${clampFluid(h2, h1, minVw, lgPx)};
  --fs-h2: ${clampFluid(h3, h2, minVw, lgPx)};
  --fs-h3: ${clampFluid(base * scale, h3, minVw, lgPx)};
  --weight-heading: ${type.headingWeight};
  --weight-ui: ${type.uiWeight};
  --weight-strong: ${type.strongWeight};
  --weight-body: ${type.bodyWeight};
  --heading-tracking: ${type.headingTracking};
  --heading-leading: ${type.headingLeading};
  --heading-transform: ${type.headingCase === "uppercase" ? "uppercase" : "none"};
  --eyebrow-size: 0.8125rem;
  --eyebrow-tracking: ${type.eyebrowTracking};
  --eyebrow-transform: ${uppercase ? "uppercase" : "none"};
  --eyebrow-color: var(--c-accentInk);
  --eyebrow-band-color: var(--c-highlight);
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
