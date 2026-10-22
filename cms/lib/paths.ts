import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the monorepo root (parent of cms/). */
export const ROOT_DIR = path.resolve(__dirname, '../..');

export const SITE_DIR = path.join(ROOT_DIR, 'site');
export const ARTICLES_DIR = path.join(SITE_DIR, 'src/content/articles');
export const TEAM_DIR = path.join(SITE_DIR, 'src/content/team');
export const SERVICES_DIR = path.join(SITE_DIR, 'src/content/services');
export const ARTICLE_ASSETS_DIR = path.join(SITE_DIR, 'src/assets/articles');
export const TEAM_ASSETS_DIR = path.join(SITE_DIR, 'src/assets/team');
export const LLMS_TXT_PATH = path.join(SITE_DIR, 'public/llms.txt');
export const SITE_CONFIG_PATH = path.join(SITE_DIR, 'src/config/site.ts');
export const STAGING_DIR = path.join(ROOT_DIR, 'cms/staging');
