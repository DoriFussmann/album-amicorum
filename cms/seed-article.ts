/**
 * One-shot seed: uses the same writeArticle + generateLlmsTxt path as the CMS Generate button.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeArticle } from './lib/writeArticle.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staging = path.join(__dirname, 'staging');

const title = 'Technical SEO Signals for Answer Engine Visibility Guides';
// 55-60 chars check
console.log('title length', title.length);

const description =
  'A practical overview of crawlability, structured data, authorship, and freshness signals that help search and answer engines select trustworthy pages to cite.';
console.log('description length', description.length);

const result = writeArticle({
  data: {
    title,
    description,
    slug: 'technical-seo-answer-engine-visibility',
    date: '2026-07-30',
    updatedDate: '2026-07-30',
    author: 'alex-rivera',
    category: 'Technical SEO',
    tags: ['technical-seo', 'structured-data', 'eeat', 'geo', 'crawlability'],
    image: '', // overwritten by write path
    imageAlt: 'Diagram of crawl, index, and structured data signals for answer engines',
    image2Alt: 'Example breadcrumb and FAQ schema blocks on an article page',
    robots: 'index, follow',
    schemaType: 'BlogPosting',
    locale: 'en-US',
    twitterCard: 'summary_large_image',
    draft: false,
    keywords: ['answer engines', 'llms.txt', 'canonical URLs'],
    internalLinks: [
      { label: 'Team', url: '/team/' },
      { label: 'All articles', url: '/articles/' },
    ],
    externalLinks: [
      {
        label: 'Google Search Central — Documentation',
        url: 'https://developers.google.com/search/docs',
      },
    ],
    faqs: [
      {
        question: 'What is GEO in this context?',
        answer:
          'Generative engine optimization: making pages clear, citable, and trustworthy for answer engines as well as classic search results.',
      },
    ],
  },
  body: `Technical SEO is no longer only about rankings. Answer engines and AI assistants prefer pages that are crawlable, clearly authored, and backed by structured data.

## Crawlability and canonicals

Consistent trailing-slash URLs, a complete sitemap-index, and an accurate robots.txt help crawlers discover the pages you intend to publish.

## Authorship and freshness

Visible author bios, credentials, and publish/update dates reinforce E-E-A-T. Pair them with Person and Article JSON-LD so machines can attribute claims correctly.

## Structured answers

FAQ blocks, related internal links, and cited external sources give both readers and models a reliable path to verify and expand on a topic.
`,
  sessionImages: {
    image: {
      stagedPath: path.join(staging, 'hero.png'),
      originalName: 'hero.png',
    },
    image2: {
      stagedPath: path.join(staging, 'image2.png'),
      originalName: 'image2.png',
    },
  },
  overwrite: true,
});

console.log('Wrote', result);
