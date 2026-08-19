import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let fileEnv: Record<string, string> | null = null;

function getFileEnv(): Record<string, string> {
  if (fileEnv) return fileEnv;

  const mode = import.meta.env.MODE || process.env.NODE_ENV || 'development';
  // Empty prefix loads all keys (including secrets), not only PUBLIC_*.
  fileEnv = loadEnv(mode, siteRoot, '');

  // Fallback if cwd-based resolution is needed (monorepo edge cases).
  if (!fileEnv.STRIPE_SECRET_KEY && existsSync(path.join(process.cwd(), '.env.local'))) {
    fileEnv = { ...fileEnv, ...loadEnv(mode, process.cwd(), '') };
  }

  return fileEnv;
}

/** Read server env from process.env (Vercel) or site/.env* (local). */
export function getEnv(name: string): string | undefined {
  const value = process.env[name] ?? getFileEnv()[name];
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
