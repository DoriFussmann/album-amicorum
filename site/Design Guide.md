# Design Guide — Site Name

Template: Slate — Structured · optimistic (light)

## Brand identity

The wordmark is "Site" in the header foreground color and "Name" in the accent. When both parts are empty, the site name is the fallback. Voice on placeholder pages is neutral and specific. Imagery is documentary: real work, natural daylight, one teal or coral detail, and clear negative space.

## Color palette

| token | hex | use |
| --- | --- | --- |
| bg | #F3F1EA | Page background |
| surface | #FFFFFF | Raised surfaces and form fields |
| surfaceAlt | #E6EAE7 | Alternate sections and filled frames |
| fg | #26313A | Body and heading text |
| muted | #56626A | Secondary text on bg, surface, and surfaceAlt |
| border | #D6DBD8 | Hairlines, line cards, and frames |
| accent | #0B7560 | Links, primary buttons, and the focus ring |
| accentHover | #085C4B | Primary button hover |
| accentFg | #FFFFFF | Text on the accent |
| highlight | #E8603F | Uppercase eyebrows on band surfaces |
| band | #5E6B72 | Band hero, and stats or call-to-action when rhythm is bands |
| bandFg | #FFFFFF | Text on band |
| bandMuted | #EEF1F2 | Secondary text on band |
| headerBg | #4A565D | Header background |
| headerFg | #FFFFFF | Header text |
| footerBg | #46535A | Footer background |
| footerFg | #FFFFFF | Footer text |
| focus | #0B7560 | Focus ring |

## Typography

Inter Variable only, for every element. Body is 17px at weight 400 and line-height 1.65. Lead is body × 1.2 (20.4px). Headings use weight 600, tracking -0.02em, and leading 1.1. The scale ratio is 1.25. On viewports below lg, each heading drops one step. Eyebrows are uppercase, 0.78rem, tracking 0.12em, in the accent (highlight on band surfaces).

| role | mobile | desktop (≥ lg) |
| --- | --- | --- |
| body | 17px | 17px |
| lead | 20.4px | 20.4px |
| h3 | 21.25px | 26.563px |
| h2 | 26.563px | 33.203px |
| h1 | 33.203px | 41.504px |

## Layout & spacing

Density is regular: section padding is 56px on small screens and 96px from lg up. The page container is 76rem. Prose measure is 42rem. Rhythm is alternate, so content sections switch between bg and surfaceAlt. Breakpoints are sm 640px, md 768px, lg 1024px, and xl 1280px.

## Components

The header is the band variant: an opaque header background with no bottom border, so it reads as one block with the band hero. The hero is split — text on the left (eyebrow, H1, sub, primary and secondary actions) and an image carousel on the right — and stacks text-first below lg. The hero sits on the band color. Cards are line cards: transparent, with a 1px border and an 8px radius. Primary buttons are solid: accent background, accent foreground text, 8px radius, at least 44×44px. Secondary buttons are an outline in the foreground color (band foreground on band surfaces).

## Motion

Style is rise: opacity and a 24px upward move, over 600ms, eased with cubic-bezier(0.16, 1, 0.3, 1). Siblings stagger by 80ms. The carousel crossfades every 5500ms, pauses on hover and focus, and does not autoplay when reduced motion is requested.

## Imagery

Treatment is natural-crisp. CSS filter: saturate(0.98) contrast(1.06). Radius 12px. Aspect 4:5. Direction: documentary photography of real work settings in natural daylight. Cool neutral greys and stone tones with one teal or coral detail. Calm, optimistic, structured compositions with clear negative space. Avoid stock-photo clichés (handshakes, pointing at screens), text or logos baked into the image, heavy gradients, neon, and AI-looking gloss.

Key palette hexes: background #F3F1EA, foreground #26313A, accent #0B7560, highlight #E8603F, band #5E6B72.

## Rules

Never use a font other than Inter. Never hardcode a color outside the token block. Never publish fake testimonials. Never bake text or logos into images.

## Token block

```tokens
{
  "version": 2,
  "template": "slate",
  "templateName": "Slate",
  "tagline": "Structured · optimistic",
  "mode": "light",
  "brand": { "wordmarkPrimary": "Site", "wordmarkAccent": "Name" },
  "colors": {
    "bg": "#F3F1EA",
    "surface": "#FFFFFF",
    "surfaceAlt": "#E6EAE7",
    "fg": "#26313A",
    "muted": "#56626A",
    "border": "#D6DBD8",
    "accent": "#0B7560",
    "accentHover": "#085C4B",
    "accentFg": "#FFFFFF",
    "highlight": "#E8603F",
    "band": "#5E6B72",
    "bandFg": "#FFFFFF",
    "bandMuted": "#EEF1F2",
    "headerBg": "#4A565D",
    "headerFg": "#FFFFFF",
    "footerBg": "#46535A",
    "footerFg": "#FFFFFF",
    "focus": "#0B7560"
  },
  "type": {
    "family": "Inter Variable",
    "base": "17px",
    "scale": 1.25,
    "headingWeight": 600,
    "bodyWeight": 400,
    "headingTracking": "-0.02em",
    "headingLeading": 1.1,
    "eyebrow": "uppercase"
  },
  "shape": { "radius": "8px", "radiusLg": "16px", "button": "solid" },
  "layout": { "density": "regular", "container": "76rem", "measure": "42rem" },
  "variants": { "header": "band", "hero": "band", "card": "line", "rhythm": "alternate", "texture": "grid" },
  "motion": {
    "style": "rise",
    "duration": 600,
    "easing": "cubic-bezier(0.16, 1, 0.3, 1)",
    "stagger": 80,
    "carouselInterval": 5500
  },
  "imagery": {
    "treatment": "natural-crisp",
    "cssFilter": "saturate(0.98) contrast(1.06)",
    "radius": "12px",
    "aspect": "4:5",
    "direction": "Documentary photography of real work settings in natural daylight. Cool neutral greys and stone tones with one teal or coral detail. Calm, optimistic, structured compositions with clear negative space.",
    "avoid": "Stock-photo clichés (handshakes, pointing at screens), text or logos baked into the image, heavy gradients, neon, AI-looking gloss."
  },
  "breakpoints": { "sm": "640px", "md": "768px", "lg": "1024px", "xl": "1280px" }
}
```
