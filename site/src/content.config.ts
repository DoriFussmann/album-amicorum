import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { articleSchema, serviceSchema, teamSchema } from "seo-core";
import { pageSchema } from "./lib/page-schema";

const articles = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/articles" }),
  schema: ({ image }) => articleSchema(image),
});

const team = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/team" }),
  schema: ({ image }) => teamSchema(image),
});

const services = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/services" }),
  schema: serviceSchema,
});

const pages = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/pages" }),
  schema: pageSchema,
});

export const collections = { articles, team, services, pages };
