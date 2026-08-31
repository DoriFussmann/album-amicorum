import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';

const modules = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/images/books/**/*.{jpg,jpeg,png}',
  { eager: true },
);

const byPublicPath = new Map<string, ImageMetadata>();
for (const [key, mod] of Object.entries(modules)) {
  const rel = key.replace(/^.*\/assets\/images\/books\//, '');
  byPublicPath.set(`/images/books/${rel}`, mod.default);
}

export function bookImage(publicPath: string): ImageMetadata {
  const asset = byPublicPath.get(publicPath);
  if (!asset) {
    throw new Error(`Missing book image asset for ${publicPath}`);
  }
  return asset;
}

export async function bookImageSrc(publicPath: string): Promise<string> {
  const img = await getImage({ src: bookImage(publicPath) });
  return img.src;
}
