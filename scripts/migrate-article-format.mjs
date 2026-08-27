/**
 * One-time migration: flatten article hero image paths and convert
 * internalLinks from { label, url } to { slug, anchor }.
 *
 * Reversible: git checkout -- site/src/content/articles site/src/assets/articles
 * (or discard this branch). Does not touch CMS.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARTICLES_DIR = path.join(ROOT, 'site', 'src', 'content', 'articles');
const ASSETS_DIR = path.join(ROOT, 'site', 'src', 'assets', 'articles');

const NESTED_IMAGE =
  /^(image:\s+)\.\.\/\.\.\/assets\/articles\/([^/\s]+)\/hero\.([A-Za-z0-9]+)\s*$/;
const FLAT_IMAGE =
  /^image:\s+\.\.\/\.\.\/assets\/articles\/[^/\s]+\.[A-Za-z0-9]+\s*$/;
const INTERNAL_URL = /^\/articles\/([^/?#\s]+)\/?$/;

const report = {
  articlesChanged: 0,
  imagesMoved: 0,
  internalLinksConverted: 0,
  articlesUnchanged: [],
  unhandled: [],
};

function splitFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
  if (!match) {
    throw new Error('Could not find YAML frontmatter');
  }
  return {
    fm: match[1],
    body: raw.slice(match[0].length),
    nl: raw.includes('\r\n') ? '\r\n' : '\n',
  };
}

function convertInternalLinks(fm, nl, fileName) {
  if (!/^internalLinks:\s*$/m.test(fm)) {
    return { fm, converted: 0 };
  }

  const lines = fm.split(/\r?\n/);
  const start = lines.findIndex((line) => line === 'internalLinks:');
  if (start === -1) {
    report.unhandled.push(`${fileName}: internalLinks key present but not a standalone line`);
    return { fm, converted: 0, failed: true };
  }

  let end = start + 1;
  while (end < lines.length && (lines[end].startsWith(' ') || lines[end].startsWith('\t'))) {
    end += 1;
  }

  const block = lines.slice(start + 1, end);
  if (block.length === 0) {
    report.unhandled.push(`${fileName}: internalLinks key is empty`);
    return { fm, converted: 0, failed: true };
  }

  const convertedLines = [];
  let converted = 0;

  for (let i = 0; i < block.length; ) {
    const labelLine = block[i];
    const urlLine = block[i + 1];
    const labelMatch = labelLine?.match(/^  - label: (.+)$/);
    const urlMatch = urlLine?.match(/^    url: (.+)$/);

    if (!labelMatch || !urlMatch) {
      report.unhandled.push(
        `${fileName}: unexpected internalLinks item at lines ${start + 2 + i}-${start + 3 + i}: ${JSON.stringify(block.slice(i, i + 2))}`,
      );
      return { fm, converted: 0, failed: true };
    }

    const labelRaw = labelMatch[1];
    let urlRaw = urlMatch[1].trim();
    if (
      (urlRaw.startsWith('"') && urlRaw.endsWith('"')) ||
      (urlRaw.startsWith("'") && urlRaw.endsWith("'"))
    ) {
      urlRaw = urlRaw.slice(1, -1);
    }

    const slugMatch = urlRaw.match(INTERNAL_URL);
    if (!slugMatch) {
      report.unhandled.push(
        `${fileName}: could not extract slug from internalLinks url "${urlRaw}"`,
      );
      return { fm, converted: 0, failed: true };
    }

    convertedLines.push(`  - slug: ${slugMatch[1]}`);
    convertedLines.push(`    anchor: ${labelRaw}`);
    converted += 1;
    i += 2;
  }

  const next = [
    ...lines.slice(0, start + 1),
    ...convertedLines,
    ...lines.slice(end),
  ];
  return { fm: next.join(nl), converted };
}

function flattenImage(fm, fileName) {
  const lines = fm.split(/\r?\n/);
  const idx = lines.findIndex((line) => line.startsWith('image:'));
  if (idx === -1) {
    report.unhandled.push(`${fileName}: no image: field`);
    return { lines, move: null, failed: true };
  }

  const line = lines[idx];
  const nested = line.match(NESTED_IMAGE);
  if (nested) {
    const [, prefix, slug, ext] = nested;
    lines[idx] = `${prefix}../../assets/articles/${slug}.${ext}`;
    return { lines, move: { slug, ext } };
  }

  if (FLAT_IMAGE.test(line)) {
    return { lines, move: null };
  }

  report.unhandled.push(`${fileName}: unexpected image path: ${line}`);
  return { lines, move: null, failed: true };
}

function joinLines(lines, nl) {
  return lines.join(nl);
}

function imageMovePaths(slug, ext) {
  const fromDir = path.join(ASSETS_DIR, slug);
  return {
    fromDir,
    from: path.join(fromDir, `hero.${ext}`),
    to: path.join(ASSETS_DIR, `${slug}.${ext}`),
  };
}

function validateImageMove(slug, ext, fileName) {
  const { fromDir, from, to } = imageMovePaths(slug, ext);
  if (!fs.existsSync(from)) {
    report.unhandled.push(`${fileName}: image file missing at ${path.relative(ROOT, from)}`);
    return false;
  }
  if (fs.existsSync(to)) {
    report.unhandled.push(`${fileName}: destination already exists at ${path.relative(ROOT, to)}`);
    return false;
  }
  const extra = fs.readdirSync(fromDir).filter((name) => name !== `hero.${ext}`);
  if (extra.length > 0) {
    report.unhandled.push(
      `${fileName}: extra files in ${path.relative(ROOT, fromDir)}: ${extra.join(', ')}`,
    );
    return false;
  }
  return true;
}

function moveHeroImage(slug, ext) {
  const { fromDir, from, to } = imageMovePaths(slug, ext);
  fs.renameSync(from, to);
  const remaining = fs.readdirSync(fromDir);
  if (remaining.length === 0) {
    fs.rmdirSync(fromDir);
  }
}

function processArticle(fileName) {
  const filePath = path.join(ARTICLES_DIR, fileName);
  const raw = fs.readFileSync(filePath, 'utf8');
  let parts;
  try {
    parts = splitFrontmatter(raw);
  } catch (err) {
    report.unhandled.push(`${fileName}: ${err.message}`);
    return;
  }

  const { nl, body } = parts;
  let fm = parts.fm;

  const imageResult = flattenImage(fm, fileName);
  if (imageResult.failed) return;
  fm = joinLines(imageResult.lines, nl);

  const linksResult = convertInternalLinks(fm, nl, fileName);
  if (linksResult.failed) return;
  fm = linksResult.fm;

  const willMove = Boolean(imageResult.move);
  const willConvert = linksResult.converted > 0;
  if (!willMove && !willConvert) {
    report.articlesUnchanged.push(fileName);
    return;
  }

  if (willMove && !validateImageMove(imageResult.move.slug, imageResult.move.ext, fileName)) {
    return;
  }

  fs.writeFileSync(filePath, `---${nl}${fm}${nl}---${nl}${body}`, 'utf8');
  if (willMove) {
    moveHeroImage(imageResult.move.slug, imageResult.move.ext);
    report.imagesMoved += 1;
  }
  if (willConvert) {
    report.internalLinksConverted += linksResult.converted;
  }
  report.articlesChanged += 1;
}

function main() {
  const files = fs
    .readdirSync(ARTICLES_DIR)
    .filter((name) => name.endsWith('.md'))
    .sort();

  for (const file of files) {
    processArticle(file);
  }

  console.log(JSON.stringify(report, null, 2));
  console.log(
    `\nSummary: ${report.articlesChanged} articles changed, ${report.imagesMoved} images moved, ${report.internalLinksConverted} internalLinks converted, ${report.unhandled.length} unhandled.`,
  );

  if (report.unhandled.length > 0) {
    process.exitCode = 1;
  }
}

main();
