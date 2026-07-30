import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const linkSchema = z.object({
  label: z.string(),
  url: z.string(),
});

const faqSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(55).max(60),
      description: z.string().min(140).max(160),
      slug: z.string(),
      date: z.coerce.date(),
      author: z.string(),
      category: z.string(),
      tags: z.array(z.string()).min(4).max(6),
      image: image(),
      imageAlt: z.string().min(10),
      robots: z.string().default('index, follow'),
      schemaType: z.string().default('BlogPosting'),
      locale: z.string().default('en-US'),
      twitterCard: z.string().default('summary_large_image'),
      draft: z.boolean().default(false),
      updatedDate: z.coerce.date().optional(),
      keywords: z.array(z.string()).optional(),
      canonical: z.string().optional(),
      image2: image().optional(),
      image2Alt: z.string().min(10).optional(),
      image3: image().optional(),
      image3Alt: z.string().min(10).optional(),
      ogTitle: z.string().optional(),
      ogDescription: z.string().optional(),
      ogImage: z.string().optional(),
      internalLinks: z.array(linkSchema).optional(),
      externalLinks: z.array(linkSchema).optional(),
      faqs: z.array(faqSchema).optional(),
    }),
});

const team = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/team' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      slug: z.string(),
      role: z.string(),
      bio: z.string(),
      credentials: z.string().optional(),
      photo: image(),
      sameAs: z.array(z.string().url()).default([]),
    }),
});

const services = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/services' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    summary: z.string(),
    order: z.number(),
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
    order: z.number(),
  }),
});

export const collections = { articles, team, services, books };
