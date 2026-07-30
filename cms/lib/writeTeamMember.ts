import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { TEAM_DIR, TEAM_ASSETS_DIR } from './paths.ts';

export interface TeamMemberInput {
  name: string;
  slug: string;
  role: string;
  bio: string;
  credentials?: string;
  sameAs?: string[];
  /** Absolute path to staged photo file */
  photoStagedPath?: string;
  photoOriginalName?: string;
  /** Keep existing relative photo path when editing without new upload */
  existingPhoto?: string;
  overwrite?: boolean;
}

export function writeTeamMember(input: TeamMemberInput): { path: string; slug: string } {
  const { name, slug, role, bio, credentials, sameAs = [], overwrite = false } = input;

  if (!name?.trim() || !slug?.trim() || !role?.trim() || !bio?.trim()) {
    throw new Error('name, slug, role, and bio are required');
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error('slug must be lowercase kebab-case');
  }

  fs.mkdirSync(TEAM_DIR, { recursive: true });
  fs.mkdirSync(TEAM_ASSETS_DIR, { recursive: true });

  const outMd = path.join(TEAM_DIR, `${slug}.md`);
  if (fs.existsSync(outMd) && !overwrite) {
    const err = new Error(`Team member slug collision: ${slug}.md already exists`);
    (err as Error & { code: string }).code = 'SLUG_COLLISION';
    throw err;
  }

  let photoRel: string;
  if (input.photoStagedPath && input.photoOriginalName) {
    const ext = path.extname(input.photoOriginalName).toLowerCase() || '.jpg';
    const photoName = `${slug}${ext}`;
    fs.copyFileSync(input.photoStagedPath, path.join(TEAM_ASSETS_DIR, photoName));
    photoRel = `../../assets/team/${photoName}`;
  } else if (input.existingPhoto) {
    photoRel = input.existingPhoto;
  } else {
    throw new Error('photo is required');
  }

  const fm: Record<string, unknown> = {
    name: name.trim(),
    slug,
    role: role.trim(),
    bio: bio.trim(),
    photo: photoRel,
    sameAs,
  };
  if (credentials?.trim()) fm.credentials = credentials.trim();

  const yaml = YAML.stringify(fm, { lineWidth: 0 }).trimEnd();
  const markdown = `---\n${yaml}\n---\n`;
  fs.writeFileSync(outMd, markdown, 'utf8');

  return { path: outMd, slug };
}

export function deleteTeamMember(slug: string): void {
  const filePath = path.join(TEAM_DIR, `${slug}.md`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}
