import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let fileEnv: Record<string, string> | null = null;

function getFileEnv(): Record<string, string> {
  if (fileEnv) return fileEnv;

  // On Vercel, secrets come only from process.env — never read .env files.
  if (process.env.VERCEL) {
    fileEnv = {};
    return fileEnv;
  }

  try {
    const require = createRequire(import.meta.url);
    const { loadEnv } = require('vite') as typeof import('vite');
    const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    const mode = process.env.NODE_ENV || 'development';
    fileEnv = loadEnv(mode, siteRoot, '');

    if (!fileEnv.STRIPE_SECRET_KEY && existsSync(path.join(process.cwd(), '.env.local'))) {
      fileEnv = { ...fileEnv, ...loadEnv(mode, process.cwd(), '') };
    }
  } catch (error) {
    console.warn('[serverEnv] loadEnv unavailable, using process.env only:', error);
    fileEnv = {};
  }

  return fileEnv ?? {};
}

/** Read server env from process.env (Vercel) or site/.env* (local). */
export function getEnv(name: string): string | undefined {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) return fromProcess;
  const fromFile = getFileEnv()[name]?.trim();
  return fromFile || undefined;
}
