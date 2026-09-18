import { absoluteUrl } from './url';

/** Stable public logo URL for JSON-LD (must not change across rebuilds). */
export async function getLogoAbsoluteUrl(): Promise<string> {
  return absoluteUrl('/images/logo.png');
}
