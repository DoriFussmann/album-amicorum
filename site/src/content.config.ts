import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { articleSchema, teamSchema } from "seo-core";
import { pageSchema } from "./lib/page-schema";

const articles = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/articles" }),
  schema: ({ image }) => articleSchema(image),
});

const team = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/team" }),
  schema: ({ image }) => teamSchema(image),
});

const pages = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/pages" }),
  schema: pageSchema,
});

/** The seven editions of My Friends Book. Image paths resolve through lib/shop/bookAssets. */
const books = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/books" }),
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
    order: z.number(),
  }),
});

export const collections = { articles, team, pages, books };
