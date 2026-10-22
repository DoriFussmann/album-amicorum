import { z } from "astro/zod";

const cta = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});

const hero = z.object({
  type: z.literal("hero"),
  eyebrow: z.string().min(1),
  h1: z.string().min(1),
  sub: z.string().min(1),
  cta_primary: cta,
  cta_secondary: cta.optional(),
  slides: z
    .array(
      z.object({
        image: z.string().min(1),
        alt: z.string().min(1),
        src: z.string().min(1).optional(),
      }),
    )
    .min(3, "hero.slides needs 3 to 4 items")
    .max(4, "hero.slides needs 3 to 4 items"),
});

const pageHeader = z.object({
  type: z.literal("page-header"),
  eyebrow: z.string().min(1).optional(),
  h1: z.string().min(1),
  intro: z.string().min(1),
});

const trust = z.object({
  type: z.literal("trust"),
  heading: z.string().min(1),
  items: z.array(z.object({ label: z.string().min(1) })).min(1),
});

const featureSplit = z.object({
  type: z.literal("feature-split"),
  eyebrow: z.string().min(1).optional(),
  heading: z.string().min(1),
  body: z.string().min(1),
  highlights: z
    .array(z.object({ title: z.string().min(1), text: z.string().min(1) }))
    .min(2, "feature-split.highlights needs 2 to 3 items")
    .max(3, "feature-split.highlights needs 2 to 3 items"),
  image: z.string().min(1),
  alt: z.string().min(1),
  src: z.string().min(1).optional(),
});

const featureGrid = z.object({
  type: z.literal("feature-grid"),
  eyebrow: z.string().min(1).optional(),
  heading: z.string().min(1),
  intro: z.string().min(1).optional(),
  items: z
    .array(z.object({ title: z.string().min(1), text: z.string().min(1) }))
    .min(3, "feature-grid.items needs 3 to 6 items")
    .max(6, "feature-grid.items needs 3 to 6 items"),
});

const stats = z.object({
  type: z.literal("stats"),
  heading: z.string().min(1).optional(),
  items: z
    .array(z.object({ value: z.string().min(1), label: z.string().min(1) }))
    .min(3, "stats.items needs 3 to 4 items")
    .max(4, "stats.items needs 3 to 4 items"),
});

const process = z.object({
  type: z.literal("process"),
  eyebrow: z.string().min(1).optional(),
  heading: z.string().min(1),
  intro: z.string().min(1).optional(),
  steps: z
    .array(z.object({ title: z.string().min(1), text: z.string().min(1) }))
    .min(3, "process.steps needs 3 to 6 items")
    .max(6, "process.steps needs 3 to 6 items"),
});

const offeringItem = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
  cta: cta,
});

const offerings = z.object({
  type: z.literal("offerings"),
  eyebrow: z.string().min(1).optional(),
  heading: z.string().min(1),
  intro: z.string().min(1).optional(),
  source: z.enum(["services", "items"]),
  items: z.array(offeringItem).optional(),
});

const testimonials = z.object({
  type: z.literal("testimonials"),
  heading: z.string().min(1),
  items: z.array(z.object({ quote: z.string().min(1), name: z.string().min(1), role: z.string().min(1) })).min(1),
});

const faq = z.object({
  type: z.literal("faq"),
  eyebrow: z.string().min(1).optional(),
  heading: z.string().min(1),
  intro: z.string().min(1).optional(),
  cta: cta.optional(),
  items: z.array(z.object({ q: z.string().min(1), a: z.string().min(1) })).min(1),
});

const ctaBand = z.object({
  type: z.literal("cta-band"),
  heading: z.string().min(1),
  sub: z.string().min(1).optional(),
  cta_primary: cta,
  cta_secondary: cta.optional(),
});

const richText = z.object({
  type: z.literal("rich-text"),
  heading: z.string().min(1).optional(),
  body: z.string().min(1).refine((value) => !/^#\s/m.test(value), {
    message: "rich-text body may use ## and ### only, never #",
  }),
});

const contact = z.object({
  type: z.literal("contact"),
  heading: z.string().min(1),
  body: z.string().min(1),
  email: z.string().email(),
  response_note: z.string().min(1).optional(),
});

const teamTeaser = z.object({
  type: z.literal("team-teaser"),
  heading: z.string().min(1),
  intro: z.string().min(1).optional(),
});

const articlesTeaser = z.object({
  type: z.literal("articles-teaser"),
  heading: z.string().min(1),
  intro: z.string().min(1).optional(),
});

export const sectionSchema = z.discriminatedUnion("type", [
  hero,
  pageHeader,
  trust,
  featureSplit,
  featureGrid,
  stats,
  process,
  offerings,
  testimonials,
  faq,
  ctaBand,
  richText,
  contact,
  teamTeaser,
  articlesTeaser,
]);

export const pageSchema = z
  .object({
    route: z.string().regex(/^\/(?:[a-z0-9-]+\/)?$/, 'route must be "/" or "/slug/"'),
    meta_title: z.string().min(1),
    meta_description: z.string().min(1),
    sections: z.array(sectionSchema).min(1, "A page needs at least one section."),
  })
  .superRefine((page, ctx) => {
    const first = page.sections[0];
    const expected = page.route === "/" ? "hero" : "page-header";
    if (!first || first.type !== expected) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sections", 0, "type"],
        message: `Page "${page.route}": the first section must be ${expected}. It holds the page's only H1.`,
      });
    }
    page.sections.forEach((section, index) => {
      if (section.type !== "offerings") return;
      if (section.source === "items" && (!section.items || section.items.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sections", index, "items"],
          message: 'offerings.items is required when source is "items".',
        });
      }
    });
  });
