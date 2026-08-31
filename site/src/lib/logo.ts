import { getImage } from 'astro:assets';
import logoMark from '../assets/images/logo.png';
import { SITE_URL } from '../config/site';

/** Optimized logo URL for JSON-LD (replaces the old public /images/logo.png). */
export async function getLogoAbsoluteUrl(): Promise<string> {
  const img = await getImage({ src: logoMark, width: 192, format: 'png' });
  return new URL(img.src, SITE_URL).href;
}
