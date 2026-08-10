import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import matter from 'gray-matter';
import {
  ARTICLES_DIR,
  TEAM_DIR,
  SERVICES_DIR,
  STAGING_DIR,
} from './lib/paths.ts';
import { IMAGE_MAX_BYTES } from './lib/schema.ts';
import { validateFrontmatter, type SessionImages } from './lib/validateFrontmatter.ts';
import { normalizeParsedArticle } from './lib/normalizeParsedArticle.ts';
import { writeArticle, setArticleDraft, deleteArticle } from './lib/writeArticle.ts';
import { writeTeamMember, deleteTeamMember } from './lib/writeTeamMember.ts';
import { generateLlmsTxt } from './lib/generateLlmsTxt.ts';
import type { ArticleFrontmatter } from './lib/schema.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.CMS_PORT) || 4322;

fs.mkdirSync(STAGING_DIR, { recursive: true });
fs.mkdirSync(ARTICLES_DIR, { recursive: true });
fs.mkdirSync(TEAM_DIR, { recursive: true });
fs.mkdirSync(SERVICES_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  dest: STAGING_DIR,
  limits: { fileSize: IMAGE_MAX_BYTES },
});

function jsonError(res: express.Response, status: number, message: string, extra?: Record<string, unknown>) {
  res.status(status).json({ ok: false, error: message, ...extra });
}

function listMarkdown(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
}

function readEntries(dir: string) {
  return listMarkdown(dir).map((file) => {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const parsed = matter(raw);
    return {
      file,
      slug: String(parsed.data.slug ?? file.replace(/\.md$/, '')),
      data: parsed.data,
      body: parsed.content.trim(),
    };
  });
}

function knownSlugs() {
  return {
    articles: readEntries(ARTICLES_DIR).map((e) => e.slug),
    team: readEntries(TEAM_DIR).map((e) => e.slug),
    services: readEntries(SERVICES_DIR).map((e) => e.slug),
  };
}

/** GET /articles — list all articles for edit UI + dashboard */
app.get('/articles', (_req, res) => {
  try {
    const articles = readEntries(ARTICLES_DIR).map((e) => ({
      slug: e.slug,
      title: e.data.title ?? e.slug,
      draft: Boolean(e.data.draft),
      updatedDate: e.data.updatedDate ?? e.data.date ?? null,
      internalLinks: e.data.internalLinks ?? [],
      externalLinks: e.data.externalLinks ?? [],
      faqs: e.data.faqs ?? [],
      data: e.data,
      body: e.body,
    }));
    res.json({ ok: true, articles });
  } catch (err) {
    jsonError(res, 500, err instanceof Error ? err.message : 'Failed to list articles');
  }
});

app.get('/api/team', (_req, res) => {
  try {
    const team = readEntries(TEAM_DIR).map((e) => ({
      slug: e.slug,
      name: e.data.name,
      role: e.data.role,
      bio: e.data.bio,
      credentials: e.data.credentials,
      photo: e.data.photo,
      sameAs: e.data.sameAs ?? [],
      data: e.data,
    }));
    res.json({ ok: true, team });
  } catch (err) {
    jsonError(res, 500, err instanceof Error ? err.message : 'Failed to list team');
  }
});

app.get('/api/services', (_req, res) => {
  try {
    const services = readEntries(SERVICES_DIR).map((e) => ({
      slug: e.slug,
      title: e.data.title,
      summary: e.data.summary,
      order: e.data.order,
    }));
    res.json({ ok: true, services });
  } catch (err) {
    jsonError(res, 500, err instanceof Error ? err.message : 'Failed to list services');
  }
});

app.get('/api/known-routes', (_req, res) => {
  try {
    res.json({ ok: true, ...knownSlugs() });
  } catch (err) {
    jsonError(res, 500, err instanceof Error ? err.message : 'Failed to load routes');
  }
});

app.post('/parse', upload.single('markdown'), (req, res) => {
  try {
    if (!req.file) return jsonError(res, 400, 'No markdown file uploaded');
    const raw = fs.readFileSync(req.file.path, 'utf8');
    fs.unlinkSync(req.file.path);
    const parsed = matter(raw);
    const normalized = normalizeParsedArticle({
      data: (parsed.data ?? {}) as Record<string, unknown>,
      body: parsed.content.trim(),
    });
    res.json({
      ok: true,
      data: normalized.data,
      body: normalized.body,
    });
  } catch (err) {
    jsonError(res, 400, err instanceof Error ? err.message : 'Failed to parse markdown');
  }
});

app.post('/validate', (req, res) => {
  try {
    const { data, sessionImages = {} } = req.body as {
      data: Partial<ArticleFrontmatter>;
      sessionImages: SessionImages;
    };
    const team = readEntries(TEAM_DIR);
    const result = validateFrontmatter({
      data: data ?? {},
      sessionImages: sessionImages ?? {},
      teamSlugs: team.map((t) => t.slug),
      knownSlugs: knownSlugs(),
    });
    const slug = String(data?.slug ?? '');
    const collision =
      slug && fs.existsSync(path.join(ARTICLES_DIR, `${slug}.md`))
        ? { exists: true, file: `${slug}.md` }
        : { exists: false };
    res.json({ ok: true, validation: result, collision });
  } catch (err) {
    jsonError(res, 500, err instanceof Error ? err.message : 'Validation failed');
  }
});

app.post(
  '/generate',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const payloadRaw = req.body.payload;
      if (!payloadRaw) return jsonError(res, 400, 'Missing payload');
      const payload = JSON.parse(payloadRaw) as {
        data: ArticleFrontmatter;
        body: string;
        overwrite?: boolean;
        clearImage2?: boolean;
        clearImage3?: boolean;
      };

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const sessionImages: SessionImages = {};
      if (files?.image?.[0]) {
        sessionImages.image = {
          stagedPath: files.image[0].path,
          originalName: files.image[0].originalname,
        };
      }
      if (files?.image2?.[0]) {
        sessionImages.image2 = {
          stagedPath: files.image2[0].path,
          originalName: files.image2[0].originalname,
        };
      }
      if (files?.image3?.[0]) {
        sessionImages.image3 = {
          stagedPath: files.image3[0].path,
          originalName: files.image3[0].originalname,
        };
      }

      // Cleared optional slots should not keep prior paths through validation
      const dataForValidate = { ...payload.data };
      if (payload.clearImage2 && !sessionImages.image2) {
        delete dataForValidate.image2;
        delete dataForValidate.image2Alt;
      }
      if (payload.clearImage3 && !sessionImages.image3) {
        delete dataForValidate.image3;
        delete dataForValidate.image3Alt;
      }

      const team = readEntries(TEAM_DIR);
      const validation = validateFrontmatter({
        data: dataForValidate,
        sessionImages,
        teamSlugs: team.map((t) => t.slug),
        knownSlugs: knownSlugs(),
      });

      if (!validation.ok) {
        return jsonError(res, 400, validation.summary, { validation });
      }

      const result = writeArticle({
        data: { ...dataForValidate, ...validation.data } as ArticleFrontmatter,
        body: payload.body ?? '',
        sessionImages,
        clearImage2: Boolean(payload.clearImage2),
        clearImage3: Boolean(payload.clearImage3),
        overwrite: Boolean(payload.overwrite),
      });

      res.json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generate failed';
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : undefined;
      jsonError(res, code === 'SLUG_COLLISION' ? 409 : 500, message, { code });
    }
  }
);

app.post('/articles/:slug/unpublish', (req, res) => {
  try {
    setArticleDraft(req.params.slug, true);
    res.json({ ok: true });
  } catch (err) {
    jsonError(res, 500, err instanceof Error ? err.message : 'Unpublish failed');
  }
});

app.post('/articles/:slug/publish', (req, res) => {
  try {
    setArticleDraft(req.params.slug, false);
    res.json({ ok: true });
  } catch (err) {
    jsonError(res, 500, err instanceof Error ? err.message : 'Publish failed');
  }
});

app.delete('/articles/:slug', (req, res) => {
  try {
    deleteArticle(req.params.slug);
    res.json({ ok: true });
  } catch (err) {
    jsonError(res, 500, err instanceof Error ? err.message : 'Delete failed');
  }
});

app.post('/api/team', upload.single('photo'), (req, res) => {
  try {
    const body = req.body;
    const sameAs = body.sameAs
      ? (typeof body.sameAs === 'string' ? JSON.parse(body.sameAs) : body.sameAs)
      : [];
    const result = writeTeamMember({
      name: body.name,
      slug: body.slug,
      role: body.role,
      bio: body.bio,
      credentials: body.credentials,
      sameAs,
      photoStagedPath: req.file?.path,
      photoOriginalName: req.file?.originalname,
      existingPhoto: body.existingPhoto,
      overwrite: body.overwrite === 'true' || body.overwrite === true,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save team member';
    const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : undefined;
    jsonError(res, code === 'SLUG_COLLISION' ? 409 : 400, message, { code });
  }
});

app.delete('/api/team/:slug', (req, res) => {
  try {
    deleteTeamMember(req.params.slug);
    res.json({ ok: true });
  } catch (err) {
    jsonError(res, 500, err instanceof Error ? err.message : 'Delete failed');
  }
});

app.post('/api/rebuild-llms', (_req, res) => {
  try {
    const content = generateLlmsTxt();
    res.json({ ok: true, content });
  } catch (err) {
    jsonError(res, 500, err instanceof Error ? err.message : 'Rebuild failed');
  }
});

// Multer / generic error handler — always JSON
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return jsonError(res, 400, `File too large. Maximum size is ${IMAGE_MAX_BYTES / (1024 * 1024)}MB per file.`);
      }
      return jsonError(res, 400, err.message);
    }
    const message = err instanceof Error ? err.message : 'Server error';
    return jsonError(res, 500, message);
  }
);

app.use((_req, res) => {
  jsonError(res, 404, 'Not found');
});

app.listen(PORT, () => {
  console.log(`CMS listening at http://localhost:${PORT}`);
});
