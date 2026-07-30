import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { ARTICLES_DIR, LLMS_TXT_PATH } from './paths.ts';
import { loadSiteIdentity } from './validateFrontmatter.ts';

function absoluteArticleUrl(siteUrl: string, slug: string): string {
  const base = siteUrl.replace(/\/+$/, '');
  return `${base}/articles/${slug}/`;
}

export function generateLlmsTxt(): string {
  const { SITE_URL, SITE_NAME } = loadSiteIdentity();
  fs.mkdirSync(path.dirname(LLMS_TXT_PATH), { recursive: true });
  fs.mkdirSync(ARTICLES_DIR, { recursive: true });

  const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith('.md'));
  const articles: { title: string; slug: string; description: string; date: Date }[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(ARTICLES_DIR, file), 'utf8');
    const { data } = matter(raw);
    if (data.draft === true) continue;
    const slug = String(data.slug || file.replace(/\.md$/, ''));
    articles.push({
      title: String(data.title ?? slug),
      slug,
      description: String(data.description ?? ''),
      date: new Date(data.date ?? 0),
    });
  }

  articles.sort((a, b) => b.date.valueOf() - a.date.valueOf());

  const lines: string[] = [
    `# ${SITE_NAME}`,
    '',
    `> ${SITE_NAME} content index for AI systems and answer engines. Lists published articles only.`,
    '',
    '## Articles',
    '',
  ];

  if (articles.length === 0) {
    lines.push('(No published articles yet.)', '');
  } else {
    for (const a of articles) {
      lines.push(`[${a.title}](${absoluteArticleUrl(SITE_URL, a.slug)}): ${a.description}`);
      lines.push('');
    }
  }

  const content = lines.join('\n');
  fs.writeFileSync(LLMS_TXT_PATH, content, 'utf8');
  return content;
}
