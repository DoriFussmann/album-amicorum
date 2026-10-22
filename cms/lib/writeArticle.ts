import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { ArticleFrontmatter } from './schema.ts';
import { isUsableExistingImagePath, type SessionImages } from './validateFrontmatter.ts';
import { ARTICLES_DIR, ARTICLE_ASSETS_DIR } from './paths.ts';
import { generateLlmsTxt } from './generateLlmsTxt.ts';

function extOf(filename: string): string {
  const e = path.extname(filename).toLowerCase();
  return e || '.jpg';
}

function buildFrontmatter(
  data: ArticleFrontmatter,
  imagePaths: { image: string; image2?: string; image3?: string }
): Record<string, unknown> {
  const fm: Record<string, unknown> = {
    title: data.title,
    description: data.description,
    slug: data.slug,
    date: formatDate(data.date),
    author: data.author,
    category: data.category,
    tags: data.tags,
    image: imagePaths.image,
    imageAlt: data.imageAlt,
    robots: data.robots ?? 'index, follow',
    schemaType: data.schemaType ?? 'BlogPosting',
    locale: data.locale ?? 'en-US',
    twitterCard: data.twitterCard ?? 'summary_large_image',
    draft: data.draft ?? false,
    updatedDate: formatDate(data.updatedDate ?? data.date),
  };

  if (data.keywords?.length) fm.keywords = data.keywords;
  if (data.pillarKeyword) fm.pillarKeyword = data.pillarKeyword;
  if (data.supportingKeyword) fm.supportingKeyword = data.supportingKeyword;
  if (data.articleType) fm.articleType = data.articleType;
  if (data.targetKeyword) fm.targetKeyword = data.targetKeyword;
  if (data.canonical) fm.canonical = data.canonical;
  if (imagePaths.image2) {
    fm.image2 = imagePaths.image2;
    if (data.image2Alt) fm.image2Alt = data.image2Alt;
  }
  if (imagePaths.image3) {
    fm.image3 = imagePaths.image3;
    if (data.image3Alt) fm.image3Alt = data.image3Alt;
  }

  // Only write og* when explicitly different from base (already filtered in validate)
  if (data.ogTitle) fm.ogTitle = data.ogTitle;
  if (data.ogDescription) fm.ogDescription = data.ogDescription;
  if (data.ogImage) fm.ogImage = data.ogImage;

  if (data.internalLinks?.length) fm.internalLinks = data.internalLinks;
  if (data.externalLinks?.length) fm.externalLinks = data.externalLinks;
  if (data.faqs?.length) fm.faqs = data.faqs;

  return fm;
}

function formatDate(d: string | Date): string {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.valueOf())) return String(d);
  return date.toISOString().slice(0, 10);
}

export interface WriteArticleInput {
  data: ArticleFrontmatter;
  body: string;
  sessionImages: SessionImages;
  /** When true, omit optional image2 that was cleared in the editor */
  clearImage2?: boolean;
  /** When true, omit optional image3 that was cleared in the editor */
  clearImage3?: boolean;
  overwrite?: boolean;
  /** Skip llms.txt rebuild (bulk writes regenerate once at the end). */
  skipLlmsTxt?: boolean;
}

export function writeArticle(input: WriteArticleInput): { path: string; slug: string } {
  const {
    data,
    body,
    sessionImages,
    clearImage2 = false,
    clearImage3 = false,
    overwrite = false,
    skipLlmsTxt = false,
  } = input;
  const slug = data.slug;

  const outMd = path.join(ARTICLES_DIR, `${slug}.md`);
  if (fs.existsSync(outMd) && !overwrite) {
    const err = new Error(`Slug collision: ${slug}.md already exists. Pass overwrite=true to replace.`);
    (err as Error & { code: string }).code = 'SLUG_COLLISION';
    throw err;
  }

  const assetDir = path.join(ARTICLE_ASSETS_DIR, slug);
  fs.mkdirSync(assetDir, { recursive: true });
  fs.mkdirSync(ARTICLES_DIR, { recursive: true });

  let imageRel: string;
  if (sessionImages.image) {
    const heroExt = extOf(sessionImages.image.originalName);
    const heroName = `hero${heroExt}`;
    fs.copyFileSync(sessionImages.image.stagedPath, path.join(assetDir, heroName));
    // Relative from site/src/content/articles/{slug}.md → site/src/assets/articles/{slug}/hero.ext
    imageRel = `../../assets/articles/${slug}/${heroName}`;
  } else if (isUsableExistingImagePath(data.image)) {
    imageRel = data.image;
  } else {
    throw new Error('Hero image is required — upload a file or keep an existing image when editing.');
  }

  let image2Rel: string | undefined;
  if (sessionImages.image2) {
    const e = extOf(sessionImages.image2.originalName);
    const name = `image2${e}`;
    fs.copyFileSync(sessionImages.image2.stagedPath, path.join(assetDir, name));
    image2Rel = `../../assets/articles/${slug}/${name}`;
  } else if (!clearImage2 && isUsableExistingImagePath(data.image2)) {
    image2Rel = data.image2;
  }

  let image3Rel: string | undefined;
  if (sessionImages.image3) {
    const e = extOf(sessionImages.image3.originalName);
    const name = `image3${e}`;
    fs.copyFileSync(sessionImages.image3.stagedPath, path.join(assetDir, name));
    image3Rel = `../../assets/articles/${slug}/${name}`;
  } else if (!clearImage3 && isUsableExistingImagePath(data.image3)) {
    image3Rel = data.image3;
  }

  const fm = buildFrontmatter(data, {
    image: imageRel,
    image2: image2Rel,
    image3: image3Rel,
  });

  const yaml = YAML.stringify(fm, { lineWidth: 0 }).trimEnd();
  const markdown = `---\n${yaml}\n---\n\n${body.trim()}\n`;
  fs.writeFileSync(outMd, markdown, 'utf8');

  if (!skipLlmsTxt) generateLlmsTxt();

  return { path: outMd, slug };
}

export function readArticleFile(slug: string): {
  frontmatter: Record<string, unknown>;
  body: string;
  filename: string;
} | null {
  const filePath = path.join(ARTICLES_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: raw, filename: `${slug}.md` };
  return {
    frontmatter: (YAML.parse(match[1]) as Record<string, unknown>) || {},
    body: String(match[2] || '').trim(),
    filename: `${slug}.md`,
  };
}

export function setArticleDraft(slug: string, draft: boolean): void {
  const existing = readArticleFile(slug);
  if (!existing) throw new Error(`Article not found: ${slug}`);
  const fm = { ...existing.frontmatter, draft };
  const yaml = YAML.stringify(fm, { lineWidth: 0 }).trimEnd();
  fs.writeFileSync(
    path.join(ARTICLES_DIR, `${slug}.md`),
    `---\n${yaml}\n---\n\n${existing.body}\n`,
    'utf8'
  );
  generateLlmsTxt();
}

/**
 * Patch frontmatter and/or body in place (preserves unrelated fields).
 * Used by Articles Health Connect / external-link writes.
 */
export function patchArticleContent(
  slug: string,
  options: {
    frontmatterPatch?: Record<string, unknown>;
    body?: string;
    bumpUpdatedDate?: boolean;
  }
): { slug: string; updatedDate?: string } {
  const existing = readArticleFile(slug);
  if (!existing) throw new Error(`Article not found: ${slug}`);

  const fm: Record<string, unknown> = {
    ...existing.frontmatter,
    ...(options.frontmatterPatch || {}),
  };

  if (options.bumpUpdatedDate !== false) {
    fm.updatedDate = new Date().toISOString().slice(0, 10);
  }

  const body = options.body !== undefined ? options.body : existing.body;
  const yaml = YAML.stringify(fm, { lineWidth: 0 }).trimEnd();
  fs.writeFileSync(
    path.join(ARTICLES_DIR, `${slug}.md`),
    `---\n${yaml}\n---\n\n${body.trim()}\n`,
    'utf8'
  );
  generateLlmsTxt();

  return {
    slug,
    updatedDate: fm.updatedDate ? String(fm.updatedDate) : undefined,
  };
}

export function deleteArticle(slug: string): void {
  const filePath = path.join(ARTICLES_DIR, `${slug}.md`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  const assetDir = path.join(ARTICLE_ASSETS_DIR, slug);
  if (fs.existsSync(assetDir)) fs.rmSync(assetDir, { recursive: true, force: true });
  generateLlmsTxt();
}
