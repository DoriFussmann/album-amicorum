export type ImageSlot = 'image' | 'image2' | 'image3';

export interface BulkFileHint {
  originalName: string;
  /** Folder-relative path when dropping a directory (webkitRelativePath). */
  relativePath?: string;
}

export interface BulkMarkdownHint extends BulkFileHint {
  slug?: string;
  title?: string;
}

export interface BulkMatchItem {
  markdown: string;
  slug: string;
  title: string;
  image?: string;
  image2?: string;
  image3?: string;
  matchReason: string;
}

export interface BulkMatchResult {
  matches: BulkMatchItem[];
  unmatchedMarkdown: string[];
  unmatchedImages: string[];
}

const IMAGE_SLOT_SUFFIX: Array<{ re: RegExp; slot: ImageSlot }> = [
  { re: /(?:-image-?3|-img-?3|-3)$/, slot: 'image3' },
  { re: /(?:-image-?2|-img-?2|-2)$/, slot: 'image2' },
  { re: /(?:-hero|-cover|-thumb|-image|-img)$/, slot: 'image' },
];

const GENERIC_DIR = new Set(['images', 'image', 'assets', 'img', 'media', 'photos', 'hero']);

export function isMarkdownName(name: string): boolean {
  return /\.(md|markdown)$/i.test(name || '');
}

export function isImageName(name: string): boolean {
  return /\.(avif|gif|jpe?g|png|webp|svg)$/i.test(name || '');
}

export function normalizeStem(filename: string): string {
  const base = String(filename || '')
    .replace(/^.*[\\/]/, '')
    .replace(/\.[^.]+$/, '');
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function splitImageStem(stem: string): { key: string; slot: ImageSlot } {
  const value = String(stem || '');
  for (const { re, slot } of IMAGE_SLOT_SUFFIX) {
    if (re.test(value)) {
      const key = value.replace(re, '').replace(/^-+|-+$/g, '');
      return { key: key || value, slot };
    }
  }
  return { key: value, slot: 'image' };
}

function pathParts(file: BulkFileHint): string[] {
  const raw = String(file.relativePath || file.originalName || '').replace(/\\/g, '/');
  return raw.split('/').filter(Boolean);
}

function directoryHint(file: BulkFileHint): string {
  const parts = pathParts(file);
  if (parts.length < 2) return '';
  const dir = normalizeStem(parts[parts.length - 2] || '');
  if (!dir || GENERIC_DIR.has(dir)) return '';
  return dir;
}

function displayName(file: BulkFileHint): string {
  return String(file.originalName || pathParts(file).at(-1) || '');
}

function bigrams(value: string): string[] {
  const s = ` ${value} `;
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i += 1) out.push(s.slice(i, i + 2));
  return out;
}

/** Dice coefficient on character bigrams. */
export function similarity(a: string, b: string): number {
  const left = String(a || '');
  const right = String(b || '');
  if (!left || !right) return 0;
  if (left === right) return 1;
  const aBi = bigrams(left);
  const bBi = bigrams(right);
  const counts = new Map<string, number>();
  for (const g of aBi) counts.set(g, (counts.get(g) || 0) + 1);
  let overlap = 0;
  for (const g of bBi) {
    const n = counts.get(g) || 0;
    if (n > 0) {
      overlap += 1;
      counts.set(g, n - 1);
    }
  }
  return (2 * overlap) / (aBi.length + bBi.length);
}

function bestArticleScore(imageKey: string, articleKeys: string[]): number {
  let best = 0;
  for (const key of articleKeys) {
    if (!key) continue;
    if (imageKey === key) return 1;
    if (imageKey.includes(key) || key.includes(imageKey)) {
      best = Math.max(best, 0.86);
    }
    best = Math.max(best, similarity(imageKey, key));
  }
  return best;
}

function assignSlot(
  target: BulkMatchItem,
  slot: ImageSlot,
  imageName: string,
  reasons: string[]
): boolean {
  if (target[slot]) return false;
  target[slot] = imageName;
  reasons.push(`${slot}=${imageName}`);
  return true;
}

/**
 * Pair markdown files with images by slug, filename stem, folder name, then leftover similarity.
 */
export function matchBulkUploads(
  markdownFiles: BulkMarkdownHint[],
  imageFiles: BulkFileHint[]
): BulkMatchResult {
  const matches: BulkMatchItem[] = markdownFiles.map((md) => {
    const fileStem = normalizeStem(displayName(md));
    const slug = String(md.slug || '').trim() || fileStem;
    return {
      markdown: displayName(md),
      slug,
      title: String(md.title || slug),
      matchReason: '',
    };
  });

  const usedImages = new Set<string>();
  const reasonsByIndex = matches.map(() => [] as string[]);

  const articleKeys = (item: BulkMatchItem, md: BulkMarkdownHint): string[] => {
    const keys = [item.slug, normalizeStem(item.markdown), directoryHint(md)].filter(Boolean);
    return [...new Set(keys)];
  };

  const tryAssign = (
    image: BulkFileHint,
    imageKey: string,
    slot: ImageSlot,
    minScore: number
  ): boolean => {
    const imageName = displayName(image);
    if (usedImages.has(imageName)) return false;

    let bestIdx = -1;
    let bestScore = minScore;
    for (let i = 0; i < matches.length; i += 1) {
      const keys = articleKeys(matches[i], markdownFiles[i]);
      const score = bestArticleScore(imageKey, keys);
      const slotFree = !matches[i][slot];
      if (!slotFree) continue;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) return false;
    if (assignSlot(matches[bestIdx], slot, imageName, reasonsByIndex[bestIdx])) {
      usedImages.add(imageName);
      return true;
    }
    return false;
  };

  // Pass 1: exact / strong filename + folder matches
  for (const image of imageFiles) {
    const stem = normalizeStem(displayName(image));
    const fromName = splitImageStem(stem);
    const fromDir = directoryHint(image);
    const keys = [fromName.key, fromDir].filter(Boolean);
    for (const key of keys) {
      if (tryAssign(image, key, fromName.slot, 0.84)) break;
    }
  }

  // Pass 2: leftover images → leftover hero slots by similarity
  const leftoverImages = imageFiles.filter((img) => !usedImages.has(displayName(img)));
  leftoverImages.sort((a, b) => displayName(a).localeCompare(displayName(b)));

  for (const image of leftoverImages) {
    const stem = normalizeStem(displayName(image));
    const fromName = splitImageStem(stem);
    const key = directoryHint(image) || fromName.key;
    tryAssign(image, key, fromName.slot === 'image' ? 'image' : fromName.slot, 0.42);
  }

  // Pass 3: one leftover markdown + one leftover image
  const unmatchedMdIdx = matches
    .map((item, i) => (item.image ? -1 : i))
    .filter((i) => i >= 0);
  const stillLeftover = imageFiles.filter((img) => !usedImages.has(displayName(img)));
  if (unmatchedMdIdx.length === 1 && stillLeftover.length === 1) {
    const idx = unmatchedMdIdx[0];
    const imageName = displayName(stillLeftover[0]);
    assignSlot(matches[idx], 'image', imageName, reasonsByIndex[idx]);
    usedImages.add(imageName);
    reasonsByIndex[idx].push('only leftover pair');
  }

  for (let i = 0; i < matches.length; i += 1) {
    matches[i].matchReason = reasonsByIndex[i].length
      ? reasonsByIndex[i].join(', ')
      : 'no image match';
  }

  return {
    matches,
    unmatchedMarkdown: matches.filter((m) => !m.image).map((m) => m.markdown),
    unmatchedImages: imageFiles
      .map((img) => displayName(img))
      .filter((name) => !usedImages.has(name)),
  };
}

export function defaultImageAlt(title: string, slug: string): string {
  const base = String(title || '').trim() || String(slug || '').replace(/-/g, ' ');
  const text = `Illustrated hero image for ${base}`;
  return text.length >= 10 ? text : `${text} article`;
}
