import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { articleSchema, teamSchema } from 'seo-core/schemas';

/** Core stores YYYY-MM-DD strings; Album's frozen cards/filters still expect Date. */
function isoToUtcNoon(iso: string): Date {
  return new Date(`${iso}T12:00:00.000Z`);
}

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: ({ image }) =>
    articleSchema(image)
      .extend({
        canonical: z.string().optional(),
        image2Alt: z.string().min(10).optional(),
        image3Alt: z.string().min(10).optional(),
        ogTitle: z.string().optional(),
        ogDescription: z.string().optional(),
        ogImage: z.string().optional(),
      })
      .transform((data) => ({
        ...data,
        date: isoToUtcNoon(data.date),
        updatedDate: data.updatedDate ? isoToUtcNoon(data.updatedDate) : undefined,
      })),
});

const team = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/team' }),
  schema: ({ image }) =>
    teamSchema(image).extend({
      slug: z.string(),
    }),
});

const books = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/books' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    tagline: z.string(),
    price: z.string(),
    cover: z.string(),
    interior: z.string(),
    gallery: z.array(z.string()).optional(),
    hidden: z.boolean().default(false),
    draft: z.boolean().default(false),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    heroImage: z.string().optional(),
    order: z.number(),
  }),
});

export const collections = { articles, team, books };
