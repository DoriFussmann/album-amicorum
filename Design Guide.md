# Design Guide

## 1. Brand identity
- **Name / tagline:** Album Amicorum
- **One-sentence description of the intended feel:** Soft watercolor aesthetic, Waldorf-inspired, Scandinavian minimalism, organic layouts, elegant simplicity, airy compositions, handmade feeling, plenty of whitespace
- **Mission statement:** Help children create lifelong keepsakes by collecting stories, drawings, photos, and memories of the people who shape their childhood.
- **Brand values:** Timeless over trendy,Authentic over digital,Thoughtful over commercial,Handcrafted over mass-produced,Nature over noise,Childhood wonder,Friendship,Creativity,Quality
- **Emotional goal — how visitors should feel:** Every visitor should feel as though they've stepped into a beautifully illustrated storybook — evoking slow childhood, wonder, warmth, friendship, nature, nostalgia, and calm.
- **Reference sites/brands/inspiration:** Elsa Beskow,Beatrix Potter,Kinfolk,Bella Luna Toys,Anthropologie Kids,Rifle Paper Co. (minimal influence),Modern Waldorf interiors

## 2. Color palette
- **Named palette (if no hex given):** Primary: Warm White, Cream, Oatmeal, Sage Green, Eucalyptus, Dusty Blue, Muted Teal, Mushroom, Soft Blush. Accents: Moss Green, Warm Gold (used sparingly). Overall: muted, earthy, calming, natural.
- **Primary color:** #7A9E7E
- **Secondary color:** #8FA8A0
- **Accent color:** #B8963E
- **Background:** #FAF8F4
- **Surface:** #F3EFE8
- **Border:** #DDD8CE
- **Muted text:** #9E9488
- **Heading text color:** #3B3530
- **Body text color:** #5A5248
- **Success:** #7A9E7E
- **Warning:** #C4A35A
- **Error:** #B97070
- **Dark mode required?** Not offered; brand relies on warm whites and natural light — dark mode would undermine the aesthetic.
- **Minimum contrast ratio:** 4.5:1 for body text, 3:1 for large headings, per WCAG AA

## 3. Typography
- **Heading font:** Cormorant Garamond, DM Serif Display
- **Body font:** Nunito, Avenir, Inter
- **Monospace font:** not applicable — no code or technical content; omit from design system
- **Typographic feel:** Refined, timeless, readable, understated
- **Type scale:** 1.250 Major Third — base 16px; steps: 12, 14, 16, 20, 25, 31, 39, 49px
- **Line height:** 1.7 for body, 1.2 for display headings, 1.4 for subheadings
- **Font weights in use:** 300 light (captions), 400 regular (body), 600 semibold (UI labels), 700 bold (headings only)

## 4. Spacing & layout
- **Base spacing unit:** 8px — all spacing in multiples: 8, 16, 24, 32, 48, 64, 96px
- **Max content width (article body):** 680px
- **Container/page max width:** 1200px
- **Breakpoints:** sm 480px, md 768px, lg 1024px, xl 1280px
- **Grid/column system:** 12-column fluid grid, 24px gutters, 48px outer margins on desktop, collapses to 4-column on mobile

## 5. Component styling direction
- **Buttons:** Rounded pill shape (border-radius 100px); primary filled sage green, secondary ghost with sage border; soft hover lift shadow; no harsh gradients
- **Cards:** Large product photography, interior page previews, lifestyle photography, reviews, gift options, wishlist
- **Forms:** Minimal underline or soft-bordered inputs on cream surface; Nunito body font; generous padding; muted placeholder text; no harsh box shadows
- **Navigation:** Minimal top bar, warm white background, Cormorant Garamond wordmark, sparse links in Nunito light, no mega-menu; collapses to discreet hamburger on mobile
- **Footer:** Subtle botanical watercolor border; links: About, Shop, FAQ, Contact, Instagram, Copyright
- **Links within body text:** Inline links in colorPrimary sage, delicate single underline on hover, no blue defaults; visited state in colorTextMuted

## 6. Imagery & photography
- **Photography style (overall):** Authentic and lived-in; soft natural window light, neutral backgrounds, warm tones, genuine expressions
- **Typical subjects/scenes:** Children filling out Friend Books,Friends exchanging books,Parents helping children write,Wooden tables,Linen fabrics,Wildflowers,Colored pencils,Cozy reading nooks,School memories,Birthday parties
- **Lighting & mood to use:** Soft natural window light, neutral backgrounds, warm tones, genuine expressions
- **What to avoid in photography:** Flash, harsh shadows, busy scenes, obvious stock photography
- **Icon set:** Phosphor Icons (Thin or Light weight) or custom hand-drawn-style SVG icons; no filled bold icons; botanical or simple geometric motifs preferred
- **Image treatment:** Subtle warm tone overlay (+5% cream tint), very slight vignette, no filters or sharpening; soft rounded corners (8px) on product cards; full-bleed on hero

## 7. Illustration style
- **Illustration characteristics:** Hand-painted; soft watercolor, botanical details, delicate line work, gentle color transitions, minimal compositions
- **Illustration themes/subjects:** Woodland,Mermaids,Horses,Dinosaurs,Space,Nature

## 8. Tone & motion
- **Overall visual tone:** Warm,Gentle,Honest,Encouraging,Timeless
- **Animation/motion level:** Subtle only — no flashy animations
- **Specific animation/motion ideas:** Gentle hover lift on books, watercolor fade transitions, floating leaves, soft page-turn effects
- **Explicitly avoid (visual style):** Loud marketing, corporate design, bright saturated colors, busy layouts, clip art, glossy effects, heavy gradients, cartoonish graphics

## 9. Brand voice & copywriting
- **Writing tone:** Write like a thoughtful children's author rather than a marketer
- **Words/phrases to avoid:** Best,Must-have,Revolutionary,Marketing hype
- **Example preferred phrases:** Made to be treasured.,Created with care.,Helping friendships grow.,A keepsake for years to come.,Collect memories, not just signatures.

## 10. Page structure & hero copy
- **Homepage section order:** Hero,What is a Friend Book?,The Album Amicorum Story,Product Collection,Why Parents Love It,Testimonials,Footer
- **Hero headline:** Childhood is too precious to scroll past.
- **Hero subheadline:** Beautiful Friend Books inspired by a centuries-old tradition of preserving friendships, memories, and childhood by hand.
- **Primary CTA text:** Explore the Collection

## 11. Accessibility requirements (non-negotiable baseline)
- Minimum contrast ratio: 4.5:1 for body text, 3:1 for large headings, per WCAG AA
- Focus state: All interactive elements must have a visible focus state
- Minimum tap target: 44×44px
- Zoom readability: Readable at 200% zoom, no horizontal scroll

## 12. Explicit anti-patterns
Bright saturated colors,Busy layouts,Clip art,Corporate design,Loud marketing,Glossy effects,Heavy gradients,Cartoonish graphics,Flashy animations
