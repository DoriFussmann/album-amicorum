/* global document, window, fetch, FormData, File, URLSearchParams */

function pageKind() {
  const path = window.location.pathname;
  if (path.endsWith('add-article.html')) return 'article-form';
  if (path.endsWith('bulk-add.html')) return 'bulk-add';
  if (path.endsWith('articles-health.html')) return 'articles-health';
  if (path.endsWith('team.html')) return 'team';
  if (path.endsWith('dashboard.html')) return 'dashboard';
  return 'article-list';
}

const CHECKLIST_FIELDS = [
  'title',
  'description',
  'slug',
  'date',
  'author',
  'category',
  'tags',
  'image',
  'imageAlt',
  'robots',
  'schemaType',
  'locale',
  'twitterCard',
  'draft',
  'updatedDate',
  'keywords',
  'canonical',
  'image2',
  'image2Alt',
  'image3',
  'image3Alt',
  'ogTitle',
  'ogDescription',
  'ogImage',
];

const TITLE_MIN = 55;
const TITLE_MAX = 60;
const DESCRIPTION_MIN = 140;
const DESCRIPTION_MAX = 160;
const ALT_MIN = 10;
const DEFAULT_AUTHOR_SLUG = 'dori-fussmann';
const LIVE_SITE_ORIGIN = 'https://www.albumamicorum.com';

/** @type {{ articles: any[], authorNames: Record<string, string>, titleQuery: string, pillar: string, sortCol: string, sortDir: 'asc' | 'desc' }} */
const articleListState = {
  articles: [],
  authorNames: {},
  titleQuery: '',
  pillar: '',
  sortCol: 'date',
  sortDir: 'desc',
};

/** @type {Record<string, File | null>} */
const sessionImageFiles = { image: null, image2: null, image3: null };
/** Optional slots cleared explicitly while editing */
const clearedImageSlots = { image2: false, image3: false };
/** Which slot the next file-picker selection should fill (null = fill next empty) */
let pendingReplaceSlot = null;

let lastValidation = null;
let knownRoutes = { articles: [], team: [], services: [] };
let generating = false;
let lastCanGenerate = false;

async function parseJsonResponse(res) {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const text = await res.text();
    throw new Error(text?.slice(0, 300) || `Unexpected response (HTTP ${res.status})`);
  }
  return res.json();
}

function $(id) {
  return document.getElementById(id);
}

function showToast(message, type = 'success', title) {
  const host = $('toast-host');
  if (!host) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const heading =
    title ||
    (type === 'success' ? 'Done' : type === 'warning' ? 'Not ready' : 'Error');
  toast.innerHTML = `<span class="toast__title">${escapeHtml(heading)}</span>${escapeHtml(message)}`;
  host.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add('is-leaving');
    window.setTimeout(() => toast.remove(), 220);
  }, 4200);
}

function setPreloader(visible, text = 'Generating article…') {
  const el = $('preloader');
  if (!el) return;
  const label = $('preloader-text');
  if (label && text) label.textContent = text;
  el.hidden = !visible;
  document.body.style.overflow = visible ? 'hidden' : '';
}

function showError(msg, toastTitle = 'Error') {
  const el = $('error-box');
  if (el) {
    el.hidden = false;
    el.textContent = msg;
  }
  const ok = $('success-box');
  if (ok) ok.hidden = true;
  showToast(msg, 'error', toastTitle);
}

function showSuccess(msg, toastTitle = 'Done') {
  const el = $('success-box');
  if (el) {
    el.hidden = false;
    el.textContent = msg;
  }
  const err = $('error-box');
  if (err) err.hidden = true;
  showToast(msg, 'success', toastTitle);
}

function clearAlerts() {
  const err = $('error-box');
  const ok = $('success-box');
  if (err) err.hidden = true;
  if (ok) ok.hidden = true;
}

function csvToArray(val) {
  return String(val || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function collectFormData() {
  return {
    title: $('title').value.trim(),
    description: $('description').value.trim(),
    slug: $('slug').value.trim(),
    date: $('date').value,
    updatedDate: $('updatedDate').value || $('date').value,
    author: $('author').value,
    category: $('category').value.trim(),
    tags: csvToArray($('tags').value),
    keywords: csvToArray($('keywords').value),
    canonical: $('canonical').value.trim(),
    robots: $('robots').value.trim() || 'index, follow',
    schemaType: $('schemaType').value.trim() || 'BlogPosting',
    locale: $('locale').value.trim() || 'en-US',
    twitterCard: $('twitterCard').value.trim() || 'summary_large_image',
    draft: $('draft').checked,
    imageAlt: $('imageAlt').value.trim(),
    image2Alt: $('image2Alt')?.value.trim() || '',
    image3Alt: $('image3Alt')?.value.trim() || '',
    ogTitle: $('ogTitle').value.trim(),
    ogDescription: $('ogDescription').value.trim(),
    ogImage: $('ogImage').value.trim(),
    // Existing relative paths (edit) or session-upload marker
    image: sessionImageFiles.image
      ? '(session upload)'
      : $('title').dataset.priorImage || '',
    image2:
      clearedImageSlots.image2 && !sessionImageFiles.image2
        ? ''
        : sessionImageFiles.image2
          ? '(session upload)'
          : $('title').dataset.priorImage2 || '',
    image3:
      clearedImageSlots.image3 && !sessionImageFiles.image3
        ? ''
        : sessionImageFiles.image3
          ? '(session upload)'
          : $('title').dataset.priorImage3 || '',
    internalLinks: collectRows('internal-rows', ['label', 'url']),
    externalLinks: collectRows('external-rows', ['label', 'url']),
    faqs: collectRows('faq-rows', ['question', 'answer']),
  };
}

function collectRows(containerId, fields) {
  const rows = [];
  $(containerId).querySelectorAll('[data-row]').forEach((row) => {
    const obj = {};
    fields.forEach((f) => {
      const input = row.querySelector(`[data-field="${f}"]`);
      obj[f] = input ? input.value.trim() : '';
    });
    if (Object.values(obj).some(Boolean)) rows.push(obj);
  });
  return rows;
}

function addRow(containerId, fields, values = {}) {
  const row = document.createElement('div');
  row.dataset.row = '1';
  fields.forEach((f) => {
    const label = document.createElement('label');
    label.appendChild(document.createTextNode(f));
    const input = document.createElement('input');
    input.type = 'text';
    input.dataset.field = f;
    input.value = values[f] || '';
    input.addEventListener('input', () => scheduleValidate());
    label.appendChild(input);
    row.appendChild(label);
  });
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'btn btn-danger';
  remove.textContent = 'Remove';
  remove.addEventListener('click', () => {
    row.remove();
    scheduleValidate();
  });
  row.appendChild(remove);
  $(containerId).appendChild(row);
}

function updateCharCounters() {
  const t = $('title').value;
  const tc = $('title-count');
  const titleOk = t.length >= TITLE_MIN && t.length <= TITLE_MAX;
  tc.textContent = `${t.length} chars (need ${TITLE_MIN}–${TITLE_MAX})`;
  tc.classList.toggle('is-ok', titleOk);
  tc.classList.toggle('is-bad', !titleOk);

  const d = $('description').value;
  const dc = $('description-count');
  const descOk = d.length >= DESCRIPTION_MIN && d.length <= DESCRIPTION_MAX;
  dc.textContent = `${d.length} chars (need ${DESCRIPTION_MIN}–${DESCRIPTION_MAX})`;
  dc.classList.toggle('is-ok', descOk);
  dc.classList.toggle('is-bad', !descOk);
}

function sessionImagesPayload() {
  /** Paths are opaque tokens for the server validate endpoint — real files go on /generate */
  const out = {};
  if (sessionImageFiles.image) {
    out.image = { stagedPath: 'session', originalName: sessionImageFiles.image.name };
  }
  if (sessionImageFiles.image2) {
    out.image2 = { stagedPath: 'session', originalName: sessionImageFiles.image2.name };
  }
  if (sessionImageFiles.image3) {
    out.image3 = { stagedPath: 'session', originalName: sessionImageFiles.image3.name };
  }
  return out;
}

function updateMissingPanelHeader(validation) {
  const label = $('missing-heading-label');
  if (!label) return;
  const count = (validation?.missing?.length || 0) + (validation?.invalid?.length || 0);
  label.textContent =
    count === 0 ? 'All required fields present' : `Missing Fields (${count})`;
}

function updateChecklistPanelHeader(validation) {
  const label = $('checklist-heading-label');
  if (!label) return;
  const incomplete = (validation?.statuses || []).filter((s) => !s.ok).length;
  label.textContent =
    incomplete === 0
      ? 'Field Checklist (complete)'
      : `Field Checklist (${incomplete} incomplete)`;
}

function renderChecklist(validation) {
  const ul = $('field-checklist');
  if (!ul) return;
  ul.innerHTML = '';
  const byField = Object.fromEntries((validation?.statuses || []).map((s) => [s.field, s]));

  for (const field of CHECKLIST_FIELDS) {
    const li = document.createElement('li');
    const status = byField[field];
    const ok = status ? status.ok : false;
    li.className = ok ? 'is-ok' : 'is-bad';
    if (ok) {
      li.textContent = `✓ ${field}${status.message ? ` — ${status.message}` : ''}`;
    } else {
      const label = document.createElement('span');
      label.textContent = `✗ ${field}${status?.message ? ` — ${status.message}` : ' — needs input'}`;
      li.appendChild(label);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-ghost';
      btn.textContent = 'Focus';
      btn.addEventListener('click', () => {
        const el = $(field) || $(field === 'image' ? 'image-drop' : field);
        if (el) {
          el.focus?.();
          el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        }
      });
      li.appendChild(btn);
    }
    ul.appendChild(li);
  }

  updateChecklistPanelHeader(validation);
}

function hasHeroImage() {
  return Boolean(sessionImageFiles.image || $('title').dataset.priorImage);
}

function basenamePath(p) {
  if (!p) return '';
  const parts = String(p).replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || p;
}

function setGenerateEnabled(canGenerate, reasonText) {
  const enabled = Boolean(canGenerate) && !generating;
  lastCanGenerate = enabled;

  for (const id of ['generate', 'generate-sticky', 'generate-top']) {
    const btn = $(id);
    if (!btn) continue;
    btn.disabled = false;
    btn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    btn.classList.toggle('is-disabled', !enabled);
  }

  for (const id of ['generate-reason', 'generate-reason-top']) {
    const reason = $(id);
    if (reason) reason.textContent = reasonText;
  }

  const barReason = $('action-bar-reason');
  if (barReason) barReason.textContent = reasonText;

  for (const id of ['action-bar-pill', 'action-top-pill']) {
    const pill = $(id);
    if (!pill) continue;
    pill.textContent = enabled ? 'Ready' : generating ? 'Generating…' : 'Not ready';
    pill.classList.toggle('is-ready', enabled);
    pill.classList.toggle('is-blocked', !enabled);
  }
}

function updateGenerateButton(validation, collision) {
  const reasons = [];

  if (!validation?.ok) {
    reasons.push(validation?.summary || 'Validation incomplete');
  }
  if (!hasHeroImage()) {
    reasons.push('Hero image required — drop or choose a file');
  }
  if (collision?.exists && !$('overwrite').checked) {
    reasons.push(`Slug collision: ${collision.file} exists — enable overwrite or rename slug`);
    const warn = $('collision-warning');
    if (warn) {
      warn.hidden = false;
      warn.textContent =
        `Warning: ${collision.file} already exists. Enable overwrite or change the slug.`;
    }
  } else {
    const warn = $('collision-warning');
    if (warn) warn.hidden = true;
  }

  const unique = [...new Set(reasons)];
  const canGenerate = Boolean(
    validation?.ok && hasHeroImage() && (!collision?.exists || $('overwrite').checked)
  );

  setGenerateEnabled(
    canGenerate,
    canGenerate ? 'Ready to add.' : `Add disabled: ${unique.join(' · ')}`
  );

  const warnings = $('warnings');
  if (warnings) warnings.textContent = (validation?.warnings || []).join('\n');
}

let validateTimer = null;
function scheduleValidate() {
  updateCharCounters();
  clearTimeout(validateTimer);
  validateTimer = setTimeout(runValidate, 250);
}

async function runValidate() {
  try {
    const data = collectFormData();
    const res = await fetch('/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, sessionImages: sessionImagesPayload() }),
    });
    const json = await parseJsonResponse(res);
    if (!res.ok || !json.ok) throw new Error(json.error || 'Validate failed');
    lastValidation = json.validation;
    const missingSummary = $('missing-summary');
    if (missingSummary) missingSummary.textContent = json.validation.summary;
    updateMissingPanelHeader(json.validation);
    renderChecklist(json.validation);
    updateGenerateButton(json.validation, json.collision);
  } catch (e) {
    showError(e.message);
    setGenerateEnabled(false, `Add disabled: ${e.message}`);
  }
}

function fillFormFromData(data, body) {
  $('title').value = data.title || '';
  $('description').value = data.description || '';
  $('slug').value = data.slug || '';
  $('date').value = toDateInput(data.date);
  $('updatedDate').value = toDateInput(data.updatedDate || data.date);
  $('author').value = data.author || '';
  $('category').value = data.category || '';
  $('tags').value = Array.isArray(data.tags) ? data.tags.join(', ') : '';
  $('keywords').value = Array.isArray(data.keywords) ? data.keywords.join(', ') : '';
  $('canonical').value = data.canonical || '';
  $('robots').value = data.robots || 'index, follow';
  $('schemaType').value = data.schemaType || 'BlogPosting';
  $('locale').value = data.locale || 'en-US';
  $('twitterCard').value = data.twitterCard || 'summary_large_image';
  $('draft').checked = Boolean(data.draft);
  $('imageAlt').value = data.imageAlt || '';
  if ($('image2Alt')) $('image2Alt').value = data.image2Alt || '';
  if ($('image3Alt')) $('image3Alt').value = data.image3Alt || '';
  $('ogTitle').value = data.ogTitle || '';
  $('ogDescription').value = data.ogDescription || '';
  $('ogImage').value = data.ogImage || '';
  $('body').value = body || '';

  // Store prior image paths — kept on edit unless replaced/cleared
  $('title').dataset.priorImage = data.image || '';
  $('title').dataset.priorImage2 = data.image2 || '';
  $('title').dataset.priorImage3 = data.image3 || '';

  sessionImageFiles.image = null;
  sessionImageFiles.image2 = null;
  sessionImageFiles.image3 = null;
  clearedImageSlots.image2 = false;
  clearedImageSlots.image3 = false;
  updateImageSlotStatus();

  $('internal-rows').innerHTML = '';
  $('external-rows').innerHTML = '';
  $('faq-rows').innerHTML = '';
  (data.internalLinks || []).forEach((l) => addRow('internal-rows', ['label', 'url'], l));
  (data.externalLinks || []).forEach((l) => addRow('external-rows', ['label', 'url'], l));
  (data.faqs || []).forEach((f) => addRow('faq-rows', ['question', 'answer'], f));

  updateCharCounters();
  scheduleValidate();
}

function toDateInput(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.valueOf())) return String(v).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function setSlotStatus(el, text, filled) {
  el.textContent = text;
  el.classList.toggle('is-ready', filled);
  el.classList.toggle('is-blocked', !filled);
}

function updateImageSlotStatus() {
  const statusEl = $('slot-image-status');
  if (!statusEl || !$('title')) return;
  const prior = $('title').dataset.priorImage || '';

  setSlotStatus(
    statusEl,
    sessionImageFiles.image
      ? `new: ${sessionImageFiles.image.name}`
      : prior
        ? `keeping: ${basenamePath(prior)}`
        : 'not uploaded',
    Boolean(sessionImageFiles.image || prior)
  );
}

function isImageFile(file) {
  if (file.type && file.type.startsWith('image/')) return true;
  return /\.(avif|gif|jpe?g|png|webp|svg)$/i.test(file.name || '');
}

function assignImageToSlot(slot, file) {
  sessionImageFiles[slot] = file;
  if (slot === 'image') {
    $('title').dataset.priorImage = '';
  } else if (slot === 'image2') {
    clearedImageSlots.image2 = false;
    $('title').dataset.priorImage2 = '';
  } else if (slot === 'image3') {
    clearedImageSlots.image3 = false;
    $('title').dataset.priorImage3 = '';
  }
}

function slotIsEmpty(slot) {
  if (slot === 'image') {
    return !sessionImageFiles.image && !$('title').dataset.priorImage;
  }
  if (slot === 'image2') {
    return (
      !sessionImageFiles.image2 &&
      (clearedImageSlots.image2 || !$('title').dataset.priorImage2)
    );
  }
  if (slot === 'image3') {
    return (
      !sessionImageFiles.image3 &&
      (clearedImageSlots.image3 || !$('title').dataset.priorImage3)
    );
  }
  return true;
}

/** @param {'hero' | 'optional' | 'auto'} mode */
function acceptImages(fileList, mode = 'auto') {
  const incoming = [...fileList];
  if (!incoming.length) return;

  let blockedBySize = false;

  if (pendingReplaceSlot) {
    const slot = pendingReplaceSlot;
    pendingReplaceSlot = null;
    const file = incoming[0];
    if (file.size > 10 * 1024 * 1024) {
      showError(`${file.name} exceeds 10MB limit (max 10MB per file)`);
      setGenerateEnabled(false, `Add disabled: ${file.name} exceeds 10MB`);
      return;
    }
    if (!isImageFile(file)) {
      showError(`${file.name} is not a recognized image file`);
      return;
    }
    assignImageToSlot(slot, file);
    updateImageSlotStatus();
    scheduleValidate();
    return;
  }

  for (const file of incoming) {
    if (file.size > 10 * 1024 * 1024) {
      blockedBySize = true;
      const msg = `${file.name} exceeds 10MB limit (max 10MB per file)`;
      showError(msg);
      setGenerateEnabled(false, `Add disabled: ${msg}`);
      continue;
    }
    if (!isImageFile(file)) {
      showError(`${file.name} is not a recognized image file`);
      continue;
    }

    if (mode === 'hero') {
      assignImageToSlot('image', file);
      break;
    }

    if (mode === 'optional') {
      if (slotIsEmpty('image2')) assignImageToSlot('image2', file);
      else if (slotIsEmpty('image3')) assignImageToSlot('image3', file);
      else {
        showError('Optional image slots are full. Use Replace or Clear on a slot.');
        break;
      }
      continue;
    }

    if (slotIsEmpty('image')) assignImageToSlot('image', file);
    else if (slotIsEmpty('image2')) assignImageToSlot('image2', file);
    else if (slotIsEmpty('image3')) assignImageToSlot('image3', file);
    else {
      showError('Maximum of 3 images. Use Replace on a slot, or Clear an optional slot.');
      break;
    }
  }
  updateImageSlotStatus();
  scheduleValidate();
  if (blockedBySize) {
    setTimeout(() => {
      const msg = 'One or more images exceed the 10MB limit';
      if (!$('error-box').textContent.includes('10MB')) {
        showError(msg);
      }
      if (!$('generate-reason').textContent.includes('10MB')) {
        setGenerateEnabled(false, `Add disabled: ${msg}`);
      }
    }, 400);
  }
}

async function loadTeamOptions(selectId = 'author') {
  const res = await fetch('/api/team');
  const data = await parseJsonResponse(res);
  if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load team');
  const sel = $(selectId);
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML =
    selectId === 'bulk-author' ? '' : '<option value="">— select team member —</option>';
  for (const m of data.team) {
    const opt = document.createElement('option');
    opt.value = m.slug;
    opt.textContent = `${m.name} (${m.slug})`;
    sel.appendChild(opt);
  }
  const preferred = current || DEFAULT_AUTHOR_SLUG;
  if ([...sel.options].some((opt) => opt.value === preferred)) {
    sel.value = preferred;
  } else if (current) {
    sel.value = current;
  }
}

function formatArticleDate(value) {
  if (!value) return 'No date';
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return String(value);
  return d.toISOString().slice(0, 10);
}

async function toggleArticleStatus(slug, makeDraft) {
  const action = makeDraft ? 'unpublish' : 'publish';
  const res = await fetch(`/articles/${slug}/${action}`, { method: 'POST' });
  const json = await parseJsonResponse(res);
  if (!res.ok || !json.ok) {
    throw new Error(json.error || (makeDraft ? 'Could not set Draft' : 'Could not publish'));
  }
  showSuccess(makeDraft ? 'Marked as Draft' : 'Marked as Published', 'Updated');
  await loadArticleList();
}

function articleLiveUrl(article) {
  const data = article?.data || {};
  const explicit = data.published_url || data.publishedUrl;
  if (explicit) return String(explicit);
  if (article.draft) return '';
  const slug = article.slug || data.slug;
  return slug ? `${LIVE_SITE_ORIGIN}/articles/${slug}/` : '';
}

function articleSortValue(article, col) {
  const data = article.data || {};
  switch (col) {
    case 'title':
      return String(article.title || '').toLowerCase();
    case 'draft':
      return article.draft ? 1 : 0;
    case 'date': {
      const raw = article.updatedDate || article.date || data.updatedDate || data.date;
      const t = raw ? new Date(raw).valueOf() : 0;
      return Number.isNaN(t) ? 0 : t;
    }
    case 'author': {
      const slug = data.author || '';
      return String(articleListState.authorNames[slug] || slug).toLowerCase();
    }
    case 'internal':
      return (article.internalLinks || data.internalLinks || []).length;
    case 'external':
      return (article.externalLinks || data.externalLinks || []).length;
    default:
      return '';
  }
}

function getFilteredSortedArticles() {
  const q = articleListState.titleQuery.trim().toLowerCase();
  const pillar = articleListState.pillar.trim().toLowerCase();
  const rows = articleListState.articles.filter((article) => {
    const title = String(article.title || '').toLowerCase();
    const articlePillar = String(article.data?.pillarKeyword || '').toLowerCase();
    if (q && !title.includes(q)) return false;
    if (pillar && articlePillar !== pillar) return false;
    return true;
  });
  const { sortCol, sortDir } = articleListState;
  rows.sort((a, b) => {
    const va = articleSortValue(a, sortCol);
    const vb = articleSortValue(b, sortCol);
    let cmp = 0;
    if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
    else cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  });
  return rows;
}

function populatePillarFilter() {
  const sel = $('filter-pillar');
  if (!sel) return;
  const current = articleListState.pillar;
  const pillars = [
    ...new Set(
      articleListState.articles
        .map((a) => String(a.data?.pillarKeyword || '').trim())
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b));
  sel.innerHTML = '<option value="">All pillars</option>';
  for (const pillar of pillars) {
    const opt = document.createElement('option');
    opt.value = pillar;
    opt.textContent = pillar;
    sel.appendChild(opt);
  }
  sel.value = pillars.includes(current) ? current : '';
  articleListState.pillar = sel.value;
}

function updateSortHeaders() {
  document.querySelectorAll('.article-table th[data-col]').forEach((th) => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.col === articleListState.sortCol) {
      th.classList.add(articleListState.sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

function renderArticleTable() {
  const tbody = $('article-list');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!articleListState.articles.length) {
    tbody.innerHTML = '<tr><td colspan="7">No articles yet.</td></tr>';
    updateSortHeaders();
    return;
  }
  const rows = getFilteredSortedArticles();
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7">No articles match these filters.</td></tr>';
    updateSortHeaders();
    return;
  }
  for (const a of rows) {
    const tr = document.createElement('tr');
    const statusLabel = a.draft ? 'Draft' : 'Published';
    const statusClass = a.draft ? 'is-blocked' : 'is-ready';
    const nextAction = a.draft ? 'publish' : 'unpublish';
    const dateLabel = formatArticleDate(a.updatedDate || a.date);
    const authorSlug = a.data?.author || '';
    const authorName = articleListState.authorNames[authorSlug] || authorSlug || '—';
    const internalCount = (a.internalLinks || a.data?.internalLinks || []).length;
    const externalCount = (a.externalLinks || a.data?.externalLinks || []).length;
    const liveUrl = articleLiveUrl(a);
    tr.innerHTML = `
      <td>
        <a class="article-item__title" href="/add-article.html?edit=${encodeURIComponent(a.slug)}">${escapeHtml(a.title)}</a>
        <span class="article-item__slug">${escapeHtml(a.slug)}</span>
      </td>
      <td>
        <button
          type="button"
          class="status-pill status-pill--toggle ${statusClass}"
          data-toggle-status="${escapeHtml(a.slug)}"
          data-next="${nextAction}"
          title="${a.draft ? 'Click to publish' : 'Click to set as draft'}"
          aria-label="${statusLabel}. Click to ${a.draft ? 'publish' : 'set as draft'}"
        >${statusLabel}</button>
      </td>
      <td><time datetime="${escapeHtml(dateLabel)}">${escapeHtml(dateLabel)}</time></td>
      <td>${escapeHtml(authorName)}</td>
      <td>${internalCount}</td>
      <td>${externalCount}</td>
      <td>
        <div class="article-actions">
          ${
            liveUrl
              ? `<a class="live-url-icon" href="${escapeHtml(liveUrl)}" target="_blank" rel="noopener noreferrer" title="Open live URL" aria-label="Open live URL">🔗</a>`
              : ''
          }
          <a class="btn btn-ghost" href="/add-article.html?edit=${encodeURIComponent(a.slug)}">Edit</a>
          <button type="button" class="btn btn-danger" data-delete="${escapeHtml(a.slug)}">Delete</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll('[data-toggle-status]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const slug = btn.getAttribute('data-toggle-status');
      const makeDraft = btn.getAttribute('data-next') === 'unpublish';
      try {
        await toggleArticleStatus(slug, makeDraft);
      } catch (e) {
        showError(e.message);
      }
    });
  });
  tbody.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const slug = btn.getAttribute('data-delete');
      if (!confirm(`Delete article ${slug}?`)) return;
      try {
        const res = await fetch(`/articles/${slug}`, { method: 'DELETE' });
        const json = await parseJsonResponse(res);
        if (!res.ok || !json.ok) throw new Error(json.error || 'Delete failed');
        showSuccess(`Deleted ${slug}`, 'Deleted');
        loadArticleList();
      } catch (e) {
        showError(e.message);
      }
    });
  });
  updateSortHeaders();
}

async function loadArticleList() {
  const res = await fetch('/articles');
  const data = await parseJsonResponse(res);
  if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load articles');
  if (!$('article-list')) return;
  articleListState.articles = data.articles || [];
  populatePillarFilter();
  renderArticleTable();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadEditFromQuery() {
  const params = new URLSearchParams(location.search);
  const slug = params.get('edit');
  if (!slug) return;
  const res = await fetch('/articles');
  const data = await parseJsonResponse(res);
  if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load');
  const article = data.articles.find((a) => a.slug === slug);
  if (!article) {
    showError(`Article not found: ${slug}`);
    return;
  }
  fillFormFromData(article.data, article.body);
  $('overwrite').checked = true;
}

function setupDropZone(el, fileInput, onFiles) {
  if (!el || !fileInput) return;
  el.addEventListener('click', () => {
    pendingReplaceSlot = null;
    fileInput.value = '';
    fileInput.click();
  });
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.classList.add('is-dragover');
  });
  el.addEventListener('dragleave', () => {
    el.classList.remove('is-dragover');
  });
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('is-dragover');
    pendingReplaceSlot = null;
    if (e.dataTransfer?.files?.length) onFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files?.length) onFiles(fileInput.files);
    fileInput.value = '';
  });
}

function openImagePickerForSlot(slot) {
  pendingReplaceSlot = slot || null;
  const inputId =
    slot === 'image2' || slot === 'image3' ? 'optional-image-files' : 'image-files';
  const input = $(inputId);
  if (!input) return;
  input.value = '';
  input.click();
}

function clearOptionalImageSlot(slot) {
  if (slot !== 'image2' && slot !== 'image3') return;
  sessionImageFiles[slot] = null;
  clearedImageSlots[slot] = true;
  if (slot === 'image2') {
    $('title').dataset.priorImage2 = '';
    $('image2Alt').value = '';
  } else {
    $('title').dataset.priorImage3 = '';
    $('image3Alt').value = '';
  }
  updateImageSlotStatus();
  scheduleValidate();
}

async function handleMarkdownFiles(fileList) {
  const file = fileList[0];
  if (!file) return;
  clearAlerts();
  const fd = new FormData();
  fd.append('markdown', file);
  try {
    const res = await fetch('/parse', { method: 'POST', body: fd });
    const json = await parseJsonResponse(res);
    if (!res.ok || !json.ok) throw new Error(json.error || 'Parse failed');
    fillFormFromData(json.data, json.body);
    $('author').value = DEFAULT_AUTHOR_SLUG;
    scheduleValidate();
    showSuccess(`Parsed ${file.name}`, 'Markdown loaded');
  } catch (e) {
    showError(e.message);
  }
}

function buildJsonLdPreview() {
  const data = collectFormData();
  const authorOpt = $('author').selectedOptions[0];
  const authorName = authorOpt ? authorOpt.textContent : data.author;
  const blocks = [];

  blocks.push({
    '@context': 'https://schema.org',
    '@type': data.schemaType || 'BlogPosting',
    headline: data.title,
    description: data.description,
    datePublished: data.date,
    dateModified: data.updatedDate || data.date,
    author: { '@type': 'Person', name: authorName },
  });

  blocks.push({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: authorName,
  });

  blocks.push({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: '/' },
      { '@type': 'ListItem', position: 2, name: 'Articles', item: '/articles/' },
      {
        '@type': 'ListItem',
        position: 3,
        name: data.title,
        item: `/articles/${data.slug}/`,
      },
    ],
  });

  if (data.faqs?.length) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: data.faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    });
  }

  return blocks;
}

async function onGenerate() {
  if (generating) return;

  if (!lastCanGenerate) {
    const reason =
      $('generate-reason')?.textContent ||
      $('generate-reason-top')?.textContent ||
      $('action-bar-reason')?.textContent ||
      'Complete validation before adding.';
    showToast(
      reason.replace(/^Add disabled:\s*/, '').replace(/^Generate disabled:\s*/, ''),
      'warning',
      'Not ready'
    );
    $('required-heading')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    return;
  }

  clearAlerts();
  generating = true;
  setGenerateEnabled(false, 'Generating…');
  setPreloader(true, 'Generating article…');
  const preloaderStartedAt = Date.now();

  try {
    if (!hasHeroImage()) {
      throw new Error('Hero image required — drop or choose a file');
    }

    for (const key of ['image', 'image2', 'image3']) {
      const f = sessionImageFiles[key];
      if (f && f.size > 10 * 1024 * 1024) {
        throw new Error(`${f.name} exceeds 10MB limit (max 10MB per file)`);
      }
    }

    const data = collectFormData();
    if (sessionImageFiles.image) data.image = '(session upload)';
    if (sessionImageFiles.image2) data.image2 = '(session upload)';
    if (sessionImageFiles.image3) data.image3 = '(session upload)';

    const fd = new FormData();
    fd.append(
      'payload',
      JSON.stringify({
        data,
        body: $('body').value,
        overwrite: $('overwrite').checked,
        clearImage2: clearedImageSlots.image2 && !sessionImageFiles.image2,
        clearImage3: clearedImageSlots.image3 && !sessionImageFiles.image3,
      })
    );
    if (sessionImageFiles.image) fd.append('image', sessionImageFiles.image);
    if (sessionImageFiles.image2) fd.append('image2', sessionImageFiles.image2);
    if (sessionImageFiles.image3) fd.append('image3', sessionImageFiles.image3);

    const res = await fetch('/generate', { method: 'POST', body: fd });
    const json = await parseJsonResponse(res);
    if (!res.ok || !json.ok) {
      throw new Error(json.error || `Generate failed (HTTP ${res.status})`);
    }
    const elapsed = Date.now() - preloaderStartedAt;
    if (elapsed < 450) await new Promise((r) => setTimeout(r, 450 - elapsed));
    showSuccess(`Generated ${json.slug}.md and rebuilt llms.txt`, 'Article generated');
    await loadArticleList();
    if (sessionImageFiles.image) {
      $('title').dataset.priorImage =
        `../../assets/articles/${json.slug}/hero${extFromName(sessionImageFiles.image.name)}`;
      sessionImageFiles.image = null;
    }
    if (sessionImageFiles.image2) {
      $('title').dataset.priorImage2 =
        `../../assets/articles/${json.slug}/image2${extFromName(sessionImageFiles.image2.name)}`;
      sessionImageFiles.image2 = null;
    }
    if (sessionImageFiles.image3) {
      $('title').dataset.priorImage3 =
        `../../assets/articles/${json.slug}/image3${extFromName(sessionImageFiles.image3.name)}`;
      sessionImageFiles.image3 = null;
    }
    if (clearedImageSlots.image2) $('title').dataset.priorImage2 = '';
    if (clearedImageSlots.image3) $('title').dataset.priorImage3 = '';
    clearedImageSlots.image2 = false;
    clearedImageSlots.image3 = false;
    updateImageSlotStatus();
    scheduleValidate();
  } catch (e) {
    const elapsed = Date.now() - preloaderStartedAt;
    if (elapsed < 300) await new Promise((r) => setTimeout(r, 300 - elapsed));
    showError(e.message, 'Generate failed');
    setGenerateEnabled(false, `Generate failed: ${e.message}`);
  } finally {
    generating = false;
    setPreloader(false);
    const preservedError = $('error-box').hidden ? null : $('error-box').textContent;
    const preservedReason = $('generate-reason').textContent;
    await runValidate();
    if (preservedError) {
      // Avoid a second toast; restore inline alert + disabled state only
      $('error-box').hidden = false;
      $('error-box').textContent = preservedError;
      $('success-box').hidden = true;
      setGenerateEnabled(false, preservedReason);
    }
  }
}

function extFromName(name) {
  const m = /\.[a-z0-9]+$/i.exec(name || '');
  return m ? m[0].toLowerCase() : '.jpg';
}

const bulkState = {
  files: [],
  items: [],
  unmatchedImages: [],
  busy: false,
};

function bulkUploadName(file, used) {
  const rel = file.webkitRelativePath || file.name || 'file';
  let name = String(rel).replace(/[\\/]/g, '__');
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let n = 2;
  let next = `${stem}-${n}${ext}`;
  while (used.has(next)) {
    n += 1;
    next = `${stem}-${n}${ext}`;
  }
  used.add(next);
  return next;
}

function buildBulkFormData(includeItems) {
  const fd = new FormData();
  const used = new Set();
  for (const file of bulkState.files) {
    fd.append('files', file, bulkUploadName(file, used));
  }
  const payload = {
    author: $('bulk-author')?.value || DEFAULT_AUTHOR_SLUG,
    overwrite: Boolean($('bulk-overwrite')?.checked),
  };
  if (includeItems) {
    payload.items = bulkState.items
      .filter((item) => item.ready)
      .map((item) => ({
        markdown: item.markdown,
        image: item.image,
        image2: item.image2,
        image3: item.image3,
      }));
  }
  fd.append('payload', JSON.stringify(payload));
  return fd;
}

function setBulkReady(readyCount, total, reason) {
  const pill = $('bulk-action-pill');
  const btn = $('bulk-add');
  const label = $('bulk-action-reason');
  const canAdd = readyCount > 0 && !bulkState.busy;
  if (pill) {
    pill.textContent = canAdd ? `${readyCount} ready` : 'Not ready';
    pill.classList.toggle('is-ready', canAdd);
    pill.classList.toggle('is-blocked', !canAdd);
  }
  if (btn) btn.setAttribute('aria-disabled', canAdd ? 'false' : 'true');
  if (label) {
    label.textContent =
      reason ||
      (canAdd
        ? `${readyCount} of ${total} article${total === 1 ? '' : 's'} ready to add.`
        : 'Drop markdown and images, then Add.');
  }
}

function renderBulkPreview(plan) {
  const tbody = $('bulk-preview-body');
  const unmatched = $('bulk-unmatched');
  bulkState.items = plan.items || [];
  bulkState.unmatchedImages = plan.unmatchedImages || [];

  if (unmatched) {
    if (bulkState.unmatchedImages.length) {
      unmatched.hidden = false;
      unmatched.textContent = `Unmatched images: ${bulkState.unmatchedImages.join(', ')}`;
    } else {
      unmatched.hidden = true;
      unmatched.textContent = '';
    }
  }

  if (!tbody) return;
  if (!bulkState.items.length) {
    tbody.innerHTML = '<tr><td colspan="5">No markdown files found in this drop.</td></tr>';
    setBulkReady(0, 0, 'Drop .md files together with images.');
    return;
  }

  tbody.innerHTML = '';
  for (const item of bulkState.items) {
    const tr = document.createElement('tr');
    tr.classList.add(item.ready ? 'is-ready' : 'is-blocked');
    const extras = [item.image2, item.image3].filter(Boolean);
    const notes = item.error
      ? `<span class="bulk-error">${escapeHtml(item.error)}</span>`
      : escapeHtml(item.matchReason || '');
    tr.innerHTML = `
      <td><span class="status-pill ${item.ready ? 'is-ready' : 'is-blocked'}">${
        item.ready ? 'Ready' : 'Blocked'
      }</span></td>
      <td>
        <span class="bulk-title">${escapeHtml(item.title || item.slug || 'Untitled')}</span>
        <span class="bulk-slug">${escapeHtml(item.slug || '')}</span>
      </td>
      <td>${escapeHtml(item.markdown || '')}</td>
      <td>${escapeHtml(item.image || '—')}${
        extras.length ? `<div class="bulk-slug">${escapeHtml(extras.join(', '))}</div>` : ''
      }</td>
      <td>${notes}</td>`;
    tbody.appendChild(tr);
  }

  const readyCount = bulkState.items.filter((item) => item.ready).length;
  setBulkReady(readyCount, bulkState.items.length);
}

async function runBulkPreview() {
  if (!bulkState.files.length) return;
  bulkState.busy = true;
  setBulkReady(0, 0, 'Matching files…');
  setPreloader(true, 'Matching files…');
  try {
    const res = await fetch('/bulk-preview', { method: 'POST', body: buildBulkFormData(false) });
    const json = await parseJsonResponse(res);
    if (!res.ok || !json.ok) throw new Error(json.error || 'Preview failed');
    if ($('bulk-author') && json.author) $('bulk-author').value = json.author;
    renderBulkPreview(json);
    const err = $('bulk-error');
    const ok = $('bulk-success');
    if (err) err.hidden = true;
    if (ok) ok.hidden = true;
  } catch (e) {
    showError(e.message);
    const box = $('bulk-error');
    if (box) {
      box.hidden = false;
      box.textContent = e.message;
    }
    setBulkReady(0, 0, e.message);
  } finally {
    bulkState.busy = false;
    setPreloader(false);
    const readyCount = bulkState.items.filter((item) => item.ready).length;
    if (bulkState.items.length) setBulkReady(readyCount, bulkState.items.length);
  }
}

async function runBulkAdd() {
  if (bulkState.busy) return;
  const readyCount = bulkState.items.filter((item) => item.ready).length;
  if (!readyCount) {
    showToast('No ready articles to add yet.', 'warning', 'Not ready');
    return;
  }
  bulkState.busy = true;
  setBulkReady(readyCount, bulkState.items.length, 'Adding articles…');
  setPreloader(true, `Adding ${readyCount} article${readyCount === 1 ? '' : 's'}…`);
  try {
    const res = await fetch('/bulk-generate', { method: 'POST', body: buildBulkFormData(true) });
    const json = await parseJsonResponse(res);
    if (!res.ok) throw new Error(json.error || 'Bulk add failed');
    const written = Number(json.written) || 0;
    const failed = (json.results || []).filter((r) => !r.ok);
    const message =
      written > 0
        ? `Added ${written} article${written === 1 ? '' : 's'}${
            failed.length ? ` · ${failed.length} skipped` : ''
          }.`
        : failed[0]?.error || 'Nothing was added.';
    if (written > 0) {
      showSuccess(message, 'Articles added');
      const box = $('bulk-success');
      if (box) {
        box.hidden = false;
        box.textContent = message;
      }
      const err = $('bulk-error');
      if (err) err.hidden = true;
      bulkState.files = [];
      bulkState.items = [];
      bulkState.unmatchedImages = [];
      const countEl = $('bulk-file-count');
      if (countEl) countEl.textContent = '';
      const tbody = $('bulk-preview-body');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5">${escapeHtml(message)} Drop more files to add another batch.</td></tr>`;
      }
      const unmatched = $('bulk-unmatched');
      if (unmatched) {
        unmatched.hidden = true;
        unmatched.textContent = '';
      }
      setBulkReady(0, 0, 'Drop markdown and images, then Add.');
    } else {
      throw new Error(message);
    }
  } catch (e) {
    showError(e.message, 'Bulk add failed');
    const box = $('bulk-error');
    if (box) {
      box.hidden = false;
      box.textContent = e.message;
    }
  } finally {
    bulkState.busy = false;
    setPreloader(false);
  }
}

function acceptBulkFiles(fileList) {
  const incoming = [...fileList];
  if (!incoming.length) return;
  const next = [];
  for (const file of incoming) {
    const name = file.name || '';
    const isMd = /\.(md|markdown)$/i.test(name);
    const isImg = isImageFile(file);
    if (!isMd && !isImg) continue;
    if (file.size > 10 * 1024 * 1024) {
      showError(`${file.name} exceeds 10MB limit (max 10MB per file)`);
      continue;
    }
    next.push(file);
  }
  if (!next.length) {
    showError('Drop .md files and images only.');
    return;
  }
  bulkState.files = next;
  const mdCount = next.filter((f) => /\.(md|markdown)$/i.test(f.name)).length;
  const imgCount = next.length - mdCount;
  const countEl = $('bulk-file-count');
  if (countEl) {
    countEl.textContent = `${mdCount} markdown file${mdCount === 1 ? '' : 's'} · ${imgCount} image${
      imgCount === 1 ? '' : 's'
    }`;
  }
  void runBulkPreview();
}

async function initBulkAddPage() {
  setupDropZone($('bulk-drop'), $('bulk-files'), acceptBulkFiles);
  $('bulk-add')?.addEventListener('click', () => {
    if ($('bulk-add').getAttribute('aria-disabled') === 'true') {
      showToast($('bulk-action-reason')?.textContent || 'Not ready', 'warning', 'Not ready');
      return;
    }
    void runBulkAdd();
  });
  $('bulk-author')?.addEventListener('change', () => {
    if (bulkState.files.length) void runBulkPreview();
  });
  $('bulk-overwrite')?.addEventListener('change', () => {
    if (bulkState.files.length) void runBulkPreview();
  });
  try {
    await loadTeamOptions('bulk-author');
  } catch (e) {
    showError(e.message);
  }
}

function switchTab(active) {
  const batch = $('panel-batch');
  const single = $('panel-single');
  if (!batch || !single) return;
  batch.hidden = active !== 'batch';
  single.hidden = active !== 'single';
  $('tab-batch')?.setAttribute('aria-selected', String(active === 'batch'));
  $('tab-single')?.setAttribute('aria-selected', String(active === 'single'));
  document.querySelectorAll('[data-tab]').forEach((el) => {
    el.hidden = el.dataset.tab !== active;
  });
}

function initAddArticleTabs() {
  if (!$('tab-batch') || !$('tab-single')) return;
  $('tab-batch').addEventListener('click', () => switchTab('batch'));
  $('tab-single').addEventListener('click', () => switchTab('single'));
  const params = new URLSearchParams(location.search);
  switchTab(params.get('edit') ? 'single' : 'batch');
}

async function initArticleListPage() {
  try {
    const teamRes = await fetch('/api/team');
    const teamJson = await parseJsonResponse(teamRes);
    if (teamRes.ok && teamJson.ok) {
      articleListState.authorNames = Object.fromEntries(
        (teamJson.team || []).map((m) => [m.slug, m.name])
      );
    }
    $('filter-title')?.addEventListener('input', () => {
      articleListState.titleQuery = $('filter-title').value;
      renderArticleTable();
    });
    $('filter-pillar')?.addEventListener('change', () => {
      articleListState.pillar = $('filter-pillar').value;
      renderArticleTable();
    });
    document.querySelectorAll('.article-table th[data-col]').forEach((th) => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (articleListState.sortCol === col) {
          articleListState.sortDir = articleListState.sortDir === 'desc' ? 'asc' : 'desc';
        } else {
          articleListState.sortCol = col;
          articleListState.sortDir = 'desc';
        }
        renderArticleTable();
      });
    });
    await loadArticleList();
  } catch (e) {
    showError(e.message);
  }
}

async function initArticleFormPage() {
  setupDropZone($('md-drop'), $('md-file'), handleMarkdownFiles);
  setupDropZone($('image-drop'), $('image-files'), (files) => acceptImages(files, 'hero'));

  $('image-choose').addEventListener('click', () => openImagePickerForSlot('image'));

  document.querySelectorAll('[data-replace-slot]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openImagePickerForSlot(btn.getAttribute('data-replace-slot'));
    });
  });

  $('add-internal').addEventListener('click', () => {
    addRow('internal-rows', ['label', 'url']);
    scheduleValidate();
  });
  $('add-external').addEventListener('click', () => {
    addRow('external-rows', ['label', 'url']);
    scheduleValidate();
  });
  $('add-faq').addEventListener('click', () => {
    addRow('faq-rows', ['question', 'answer']);
    scheduleValidate();
  });

  [
    'title',
    'description',
    'slug',
    'date',
    'updatedDate',
    'author',
    'category',
    'tags',
    'keywords',
    'canonical',
    'robots',
    'schemaType',
    'locale',
    'twitterCard',
    'draft',
    'imageAlt',
    'ogTitle',
    'ogDescription',
    'ogImage',
    'overwrite',
  ].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', scheduleValidate);
    el.addEventListener('change', scheduleValidate);
  });

  $('preview-jsonld').addEventListener('click', () => {
    const section = $('jsonld-preview-section');
    section.hidden = false;
    $('jsonld-preview').textContent = JSON.stringify(buildJsonLdPreview(), null, 2);
  });

  $('generate').addEventListener('click', onGenerate);
  $('generate-sticky')?.addEventListener('click', onGenerate);
  $('generate-top')?.addEventListener('click', onGenerate);

  try {
    const routesRes = await fetch('/api/known-routes');
    const routesJson = await parseJsonResponse(routesRes);
    if (routesRes.ok && routesJson.ok) knownRoutes = routesJson;

    await loadTeamOptions();
    await loadEditFromQuery();
    renderChecklist({
      statuses: CHECKLIST_FIELDS.map((f) => ({ field: f, ok: false, message: 'not validated yet' })),
    });
    updateMissingPanelHeader({ missing: [], invalid: [] });
    scheduleValidate();
  } catch (e) {
    showError(e.message);
  }
}

async function init() {
  const kind = pageKind();
  if (kind === 'article-list') {
    await initArticleListPage();
    return;
  }
  if (kind === 'article-form') {
    initAddArticleTabs();
    await initBulkAddPage();
    await initArticleFormPage();
    return;
  }
  if (kind === 'bulk-add') {
    await initBulkAddPage();
    return;
  }
  if (kind === 'articles-health') {
    await initArticlesHealth();
  }
}

/* ---------------- Articles Health ---------------- */

const healthSession = {
  updatedSlugs: new Set(),
  batchRunning: false,
  articles: [],
};

const HEALTH_ICONS = {
  internal: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10.59 13.41a4.5 4.5 0 0 1 0-6.36l2.12-2.12a4.5 4.5 0 1 1 6.36 6.36l-1.77 1.77-1.13-1.13 1.77-1.77a2.9 2.9 0 1 0-4.1-4.1L11.72 8.18a2.9 2.9 0 0 0 0 4.1l.35.35-1.13 1.13-.35-.35Zm2.82-2.82a4.5 4.5 0 0 1 0 6.36l-2.12 2.12a4.5 4.5 0 1 1-6.36-6.36l1.77-1.77 1.13 1.13-1.77 1.77a2.9 2.9 0 1 0 4.1 4.1l2.12-2.12a2.9 2.9 0 0 0 0-4.1l-.35-.35 1.13-1.13.35.35Z"/></svg>`,
  external: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 5h5v5h-1.7V7.9l-6.55 6.55-1.2-1.2L16.1 6.7H14V5ZM7 7h6.25v1.7H8.7v8.6h8.6V12H19v7H7V7Z"/></svg>`,
};

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function setStatus(el, msg, isError = false) {
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('is-error', Boolean(isError));
}

function updateHealthBanner() {
  const banner = document.getElementById('health-session-banner');
  if (!banner) return;
  const n = healthSession.updatedSlugs.size;
  if (!n) {
    banner.hidden = true;
    banner.textContent = '';
    return;
  }
  banner.hidden = false;
  banner.textContent = `${n} article${n === 1 ? '' : 's'} updated this session — remember to commit, push, and deploy.`;
}

function setHealthBatchProgress(message, options = {}) {
  const el = document.getElementById('health-batch-progress');
  if (!el) return;
  const textEl = el.querySelector('.health-batch-progress-text');
  const spinnerEl = el.querySelector('.health-batch-spinner');
  const trackEl = el.querySelector('.health-batch-progress-track');
  const barEl = el.querySelector('.health-batch-progress-bar');

  if (!message) {
    el.hidden = true;
    el.classList.remove('is-active');
    if (textEl) textEl.textContent = '';
    if (spinnerEl) spinnerEl.hidden = true;
    if (trackEl) trackEl.hidden = true;
    if (barEl) barEl.style.width = '0%';
    return;
  }

  const active = Boolean(options.active);
  const total = Number(options.total) || 0;
  const current = Number(options.current) || 0;

  el.hidden = false;
  el.classList.toggle('is-active', active);
  if (textEl) textEl.textContent = message;
  if (spinnerEl) spinnerEl.hidden = !active;
  if (trackEl) {
    const showBar = active && total > 0;
    trackEl.hidden = !showBar;
    if (showBar && barEl) {
      const pct = Math.max(0, Math.min(100, Math.round((current / total) * 100)));
      barEl.style.width = `${pct}%`;
    }
  }
}

function setHealthBatchControlsDisabled(disabled) {
  healthSession.batchRunning = disabled;
  [
    'health-connect-all',
    'health-propose-external-all',
    'health-review-add',
    'health-review-cancel',
  ].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = disabled;
  });
  document
    .querySelectorAll(
      "[data-action='connect-all-internal'], [data-action='connect'], [data-action='propose']"
    )
    .forEach((btn) => {
      btn.disabled = disabled;
    });
}

function scoreBandClass(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) return 'gray';
  if (score >= 90) return 'green';
  if (score >= 50) return 'orange';
  return 'red';
}

function renderScoreRows(strategyResult) {
  if (!strategyResult) {
    return '<p class="health-meta">Not scanned yet.</p>';
  }
  if (!strategyResult.ok) {
    return `<p class="health-score-error">${escapeHtml(
      strategyResult.error || 'Scan failed'
    )}</p>`;
  }
  const scores = strategyResult.scores || {};
  const rows = [
    ['Performance', scores.performance],
    ['Accessibility', scores.accessibility],
    ['Best Practices', scores.bestPractices],
    ['SEO', scores.seo],
  ];
  return `<ul class="health-score-list">${rows
    .map(([label, score]) => {
      const band = scoreBandClass(score);
      const text = typeof score === 'number' ? String(score) : '—';
      return `<li>
        <span>${label}</span>
        <span class="health-score-pill is-${band}">${text}</span>
      </li>`;
    })
    .join('')}</ul>`;
}

function patchArticleSpeedInSession(slug, speed) {
  const article = healthSession.articles.find((a) => a.slug === slug);
  if (!article) return null;
  article.details = article.details || {};
  article.details.speed = speed;
  article.indicators = article.indicators || {};
  article.indicators.speed = speed?.status || 'gray';
  return article;
}

function updateRowSpeedUi(slug, speed) {
  const row = document.querySelector(`.health-row[data-slug="${CSS.escape(slug)}"]`);
  if (!row) return;
  const indicator = row.querySelector('.health-indicators [title="Speed"]');
  if (indicator) {
    indicator.className = `health-indicator is-${escapeAttr(speed?.status || 'gray')}`;
  }
  const section = row.querySelector('[data-section="speed"]');
  if (section) {
    const article = healthSession.articles.find((a) => a.slug === slug) || {
      slug,
      publishedUrl: speed?.publishedUrl || null,
    };
    section.outerHTML = renderSpeedSection(article, speed, speed?.status || 'gray');
    const nextSection = row.querySelector('[data-section="speed"]');
    nextSection?.querySelector('[data-action="speed-scan"]')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      void runSpeedScanForSlug(slug);
    });
  }
}

function hideExternalReview() {
  const panel = document.getElementById('health-external-review');
  const listPanel = document.getElementById('health-list-panel');
  if (panel) panel.hidden = true;
  if (listPanel) listPanel.hidden = false;
}

function showExternalReview(proposals, contextLabel) {
  const panel = document.getElementById('health-external-review');
  const listPanel = document.getElementById('health-list-panel');
  const reviewList = document.getElementById('health-review-list');
  const reviewStatus = document.getElementById('health-review-status');
  if (!panel || !reviewList) return;

  if (!proposals?.length) {
    hideExternalReview();
    setHealthBatchProgress(
      contextLabel
        ? `${contextLabel}: no on-topic proposals found.`
        : 'No on-topic external candidates found.'
    );
    return;
  }

  reviewList.innerHTML = proposals
    .map((p) => {
      const conf = p.confidence === 'high' ? 'high' : 'borderline';
      return `<div class="health-review-item is-${conf}" data-review-id="${escapeAttr(p.id)}" data-slug="${escapeAttr(p.articleSlug)}" data-label="${escapeAttr(p.title)}" data-url="${escapeAttr(p.url)}">
        <span class="health-review-item-body">
          <a href="${escapeAttr(p.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.title)}</a>
          <span class="health-review-item-meta">
            <span>${escapeHtml(p.articleTitle || p.articleSlug)}</span>
            <span>${escapeHtml(p.url)}</span>
          </span>
        </span>
      </div>`;
    })
    .join('');

  panel.hidden = false;
  if (listPanel) listPanel.hidden = true;
  setStatus(
    reviewStatus,
    `${proposals.length} suggested source${proposals.length === 1 ? '' : 's'}${
      contextLabel ? ` · ${contextLabel}` : ''
    }. Click Connect All to write them.`
  );
  setHealthBatchProgress('');
}

async function runProposeAllExternal(slug) {
  if (healthSession.batchRunning) return;
  const statusEl = document.getElementById('health-status');
  setHealthBatchControlsDisabled(true);
  setHealthBatchProgress('');
  setPreloader(true, 'Finding external sources…');
  try {
    const data = await parseJsonResponse(
      await fetch('/api/articles-health/propose-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slug ? { slug } : {}),
      })
    );
    const searchNote =
      data.searchUsedCount > 0
        ? ` · live search used for ${data.searchUsedCount}`
        : '';
    const errorNote =
      Array.isArray(data.searchErrors) && data.searchErrors.length
        ? ` · ${data.searchErrors.length} with no proposals`
        : '';
    showExternalReview(
      data.proposals || [],
      slug
        ? `${slug}${searchNote}${errorNote}`
        : `${data.articlesNeeding || 0} article${
            (data.articlesNeeding || 0) === 1 ? '' : 's'
          } needing sources${searchNote}${errorNote}`
    );
  } catch (err) {
    setStatus(statusEl, err.message, true);
    setHealthBatchProgress(`Find & Suggest stopped: ${err.message}`);
  } finally {
    setPreloader(false);
    setHealthBatchControlsDisabled(false);
  }
}

async function runAddSelectedExternal() {
  const reviewList = document.getElementById('health-review-list');
  const reviewStatus = document.getElementById('health-review-status');
  if (!reviewList) return;

  const nodes = [...reviewList.querySelectorAll('[data-slug][data-url]')];
  const items = nodes.map((el) => ({
    slug: el.getAttribute('data-slug'),
    label: el.getAttribute('data-label'),
    url: el.getAttribute('data-url'),
  }));

  if (!items.length) {
    setStatus(reviewStatus, 'No suggestions to connect.', true);
    return;
  }

  const addBtn = document.getElementById('health-review-add');
  const cancelBtn = document.getElementById('health-review-cancel');
  if (addBtn) addBtn.disabled = true;
  if (cancelBtn) cancelBtn.disabled = true;
  setPreloader(true, 'Connecting external links…');

  try {
    const data = await parseJsonResponse(
      await fetch('/api/articles-health/add-external-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
    );
    for (const w of data.written || []) healthSession.updatedSlugs.add(w.slug);
    updateHealthBanner();
    hideExternalReview();
    setHealthBatchControlsDisabled(false);
    await refreshArticlesHealth();
    const written = (data.written || []).length;
    const skipped = (data.skipped || []).length;
    setHealthBatchProgress(
      `Connected ${written} external link${written === 1 ? '' : 's'}${
        skipped ? ` · skipped ${skipped}` : ''
      }.`
    );
  } catch (err) {
    setStatus(reviewStatus, err.message, true);
    setHealthBatchProgress(`Connect All failed: ${err.message}`);
    if (addBtn) addBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;
  } finally {
    setPreloader(false);
  }
}

async function connectInternalLink(articleSlug, targetSlug, label) {
  try {
    await parseJsonResponse(
      await fetch(`/api/articles/${encodeURIComponent(articleSlug)}/links/internal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetSlug, label }),
      })
    );
    return { ok: true, skipped: false };
  } catch (err) {
    if (String(err.message || '').toLowerCase().includes('already present')) {
      return { ok: true, skipped: true };
    }
    throw err;
  }
}

async function connectAllInternalForArticle(articleSlug, missingInternal, onProgress) {
  const missing = Array.isArray(missingInternal) ? missingInternal : [];
  let connected = 0;
  for (let i = 0; i < missing.length; i++) {
    const target = missing[i];
    if (onProgress) {
      onProgress({
        index: i + 1,
        total: missing.length,
        targetSlug: target.slug,
        label: target.title,
      });
    }
    const result = await connectInternalLink(articleSlug, target.slug, target.title);
    if (!result.skipped) connected += 1;
  }
  if (connected > 0 || missing.length > 0) {
    healthSession.updatedSlugs.add(articleSlug);
  }
  return { connected, attempted: missing.length };
}

function renderFindings(findings) {
  if (!findings?.length) return '<p class="health-meta">No findings.</p>';
  return `<ul class="health-findings">${findings
    .map((f) => `<li>${escapeHtml(f)}</li>`)
    .join('')}</ul>`;
}

function renderLinkList(links, emptyLabel) {
  if (!links?.length) {
    return `<p class="health-meta">${escapeHtml(emptyLabel)}</p>`;
  }
  return `<ul class="health-link-list">${links
    .map(
      (l) => `<li>
        <a href="${escapeAttr(l.href || l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)}</a>
        <span class="health-meta">${escapeHtml(l.url)}</span>
      </li>`
    )
    .join('')}</ul>`;
}

function renderSpeedSection(article, speed, indicatorStatus) {
  const canScan = Boolean(speed?.canScan);
  const scanned = Boolean(speed?.scanned);
  const disabledReason = speed?.disabledReason || '';
  const scanDisabled = !canScan;
  const publishedUrl = speed?.publishedUrl || article.publishedUrl || '';
  const scoreGrid =
    scanned || speed?.mobile || speed?.desktop
      ? `<div class="health-score-grid">
          <div class="health-score-card">
            <h4>Mobile</h4>
            ${renderScoreRows(speed?.mobile)}
          </div>
          <div class="health-score-card">
            <h4>Desktop</h4>
            ${renderScoreRows(speed?.desktop)}
          </div>
        </div>`
      : '';

  return `
    <section class="health-section" data-section="speed">
      <h3><span class="health-indicator is-${escapeAttr(indicatorStatus)}">${HEALTH_ICONS.speed}</span> Speed</h3>
      ${renderFindings(speed?.findings)}
      ${
        publishedUrl
          ? `<p class="health-meta">Live URL: <a href="${escapeAttr(
              publishedUrl
            )}" target="_blank" rel="noopener noreferrer">${escapeHtml(publishedUrl)}</a></p>`
          : '<p class="health-meta">No published URL available for this article.</p>'
      }
      ${
        speed?.fetchedAt
          ? `<p class="health-meta">Last scanned: ${escapeHtml(speed.fetchedAt)}</p>`
          : ''
      }
      ${scoreGrid}
      <div class="health-actions">
        <button
          type="button"
          class="btn btn-secondary"
          data-action="speed-scan"
          ${scanDisabled ? 'disabled' : ''}
          title="${escapeAttr(scanDisabled ? disabledReason || 'Scan unavailable' : 'Run PageSpeed Insights (mobile + desktop)')}"
        >
          ${scanned ? 'Rescan Speed' : 'Scan'}
        </button>
      </div>
      ${
        scanDisabled && disabledReason
          ? `<p class="health-meta">${escapeHtml(disabledReason)}</p>`
          : '<p class="health-meta">Manual scan only — PageSpeed calls are slow. Collapsed ⚡ uses mobile Performance once scanned.</p>'
      }
    </section>`;
}

async function runSpeedScanForSlug(slug, options = {}) {
  const statusEl = document.getElementById('health-status');
  const quiet = Boolean(options.quiet);
  if (!quiet && healthSession.batchRunning) return null;
  if (!quiet) setHealthBatchControlsDisabled(true);
  if (!quiet) {
    setHealthBatchProgress(`Scanning speed for ${slug} (mobile + desktop)...`, {
      active: true,
    });
  }

  try {
    const data = await parseJsonResponse(
      await fetch(`/api/articles/${encodeURIComponent(slug)}/speed-scan`, {
        method: 'POST',
      })
    );
    patchArticleSpeedInSession(slug, data.speed);
    updateRowSpeedUi(slug, data.speed);
    if (!quiet) {
      const score = data.speed?.indicatorScore;
      setHealthBatchProgress(
        `Speed scan complete for ${slug}${
          typeof score === 'number' ? ` · mobile Performance ${score}` : ''
        }.`
      );
      setHealthBatchControlsDisabled(false);
    }
    return data;
  } catch (err) {
    if (!quiet) {
      setStatus(statusEl, err.message, true);
      setHealthBatchProgress(`Speed scan failed: ${err.message}`);
      setHealthBatchControlsDisabled(false);
    }
    throw err;
  }
}

async function runSpeedCheckAllArticles() {
  if (healthSession.batchRunning) return;
  const statusEl = document.getElementById('health-status');
  const targets = (healthSession.articles || []).filter(
    (a) => a.details?.speed?.canScan || (!a.draft && a.publishedUrl)
  );
  const queue = targets.filter((a) => a.details?.speed?.canScan !== false && !a.draft);

  if (!queue.length) {
    const anyDraftOnly = (healthSession.articles || []).every(
      (a) => a.draft || !a.publishedUrl
    );
    setHealthBatchProgress(
      anyDraftOnly
        ? 'No published URLs available to scan.'
        : 'Speed Check unavailable — configure GOOGLE_PAGESPEED_API_KEY or publish articles.'
    );
    return;
  }

  setHealthBatchControlsDisabled(true);
  let okCount = 0;
  let failCount = 0;

  try {
    for (let i = 0; i < queue.length; i++) {
      const article = queue[i];
      setHealthBatchProgress(
        `Speed check ${i + 1} of ${queue.length}: ${article.slug}...`,
        { active: true, current: i, total: queue.length }
      );
      try {
        const scanned = await runSpeedScanForSlug(article.slug, { quiet: true });
        okCount += 1;
        const score = scanned?.speed?.indicatorScore;
        setHealthBatchProgress(
          `Speed check ${i + 1} of ${queue.length}: ${article.slug} done${
            typeof score === 'number' ? ` (mobile ${score})` : ''
          }.`,
          { active: true, current: i + 1, total: queue.length }
        );
      } catch (err) {
        failCount += 1;
        setHealthBatchProgress(
          `Speed check ${i + 1} of ${queue.length}: ${article.slug} failed — ${err.message}`,
          { active: true, current: i + 1, total: queue.length }
        );
      }
    }
    setHealthBatchControlsDisabled(false);
    setHealthBatchProgress(
      `Speed check complete — ${okCount} scanned${failCount ? `, ${failCount} failed` : ''}.`
    );
    setStatus(
      statusEl,
      `Speed Check All finished — ${okCount} ok${failCount ? `, ${failCount} failed` : ''}.`
    );
  } catch (err) {
    setStatus(statusEl, err.message, true);
    setHealthBatchProgress(`Speed check stopped: ${err.message}`);
    setHealthBatchControlsDisabled(false);
  }
}

function renderLinkIndicator(kind, status, title) {
  const tone = status === 'green' ? 'green' : 'red';
  return `<span class="health-indicator is-${tone}" title="${escapeAttr(title)}" aria-label="${escapeAttr(title)}">${HEALTH_ICONS[kind]}</span>`;
}

function renderHealthRow(article) {
  const ind = article.indicators || {};
  const d = article.details || {};
  const links = d.links || {};
  const row = document.createElement('article');
  row.className = 'health-row';
  row.dataset.slug = article.slug;

  const draftBadge = article.draft
    ? '<span class="health-meta"> · draft</span>'
    : '';
  const missingCount = links.missingInternal?.length || 0;
  const externalCount = Number(links.externalCount) || 0;
  const internalStatus = ind.internal || (missingCount === 0 ? 'green' : 'red');
  const externalStatus = ind.external || (externalCount >= 3 ? 'green' : 'red');
  const internalTitle =
    missingCount === 0
      ? 'Internal links: all connected'
      : `Internal links: ${missingCount} missing`;
  const externalTitle =
    externalCount >= 3
      ? `External links: ${externalCount} sources`
      : `External links: ${externalCount} of 3`;

  row.innerHTML = `
    <button type="button" class="health-row-summary" aria-expanded="false">
      <span class="health-row-title">${escapeHtml(article.title)}${draftBadge}</span>
      <span class="health-indicators" aria-label="Link health">
        ${renderLinkIndicator('internal', internalStatus, internalTitle)}
        ${renderLinkIndicator('external', externalStatus, externalTitle)}
      </span>
    </button>
    <div class="health-row-body">
      <section class="health-section" data-section="links">
        <h3>Internal links</h3>
        ${renderLinkList(links.internalLinks, 'No internal links yet.')}
        <div class="missing-internal"></div>
        <h3>External links</h3>
        ${renderLinkList(links.externalLinks, 'No external links yet.')}
      </section>
    </div>
  `;

  const summary = row.querySelector('.health-row-summary');
  summary.addEventListener('click', () => {
    const open = row.classList.toggle('is-open');
    summary.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  const missingBox = row.querySelector('.missing-internal');
  if (links.missingInternal?.length) {
    missingBox.innerHTML = `
      <h4 class="health-meta">Required connections</h4>
      <ul class="health-link-list">${links.missingInternal
        .map(
          (m) => `<li>
          <a href="${escapeAttr(m.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(m.title)}</a>
          <span class="health-meta">${escapeHtml(m.reason)}</span>
        </li>`
        )
        .join('')}</ul>`;
  }

  return row;
}

async function refreshArticlesHealth() {
  const list = document.getElementById('health-list');
  const statusEl = document.getElementById('health-status');
  if (!list) return;
  const openSlugs = new Set(
    [...list.querySelectorAll('.health-row.is-open')].map((el) => el.dataset.slug)
  );
  const data = await parseJsonResponse(await fetch('/api/articles-health'));
  healthSession.articles = data.articles || [];
  list.innerHTML = '';
  for (const article of healthSession.articles) {
    const row = renderHealthRow(article);
    if (openSlugs.has(article.slug)) {
      row.classList.add('is-open');
      row.querySelector('.health-row-summary')?.setAttribute('aria-expanded', 'true');
    }
    list.appendChild(row);
  }
  const counts = { internalGreen: 0, internalRed: 0, externalGreen: 0, externalRed: 0 };
  for (const a of healthSession.articles) {
    if ((a.indicators?.internal || 'red') === 'green') counts.internalGreen += 1;
    else counts.internalRed += 1;
    if ((a.indicators?.external || 'red') === 'green') counts.externalGreen += 1;
    else counts.externalRed += 1;
  }
  const globalBtn = document.getElementById('health-connect-all');
  if (globalBtn && !healthSession.batchRunning) {
    const needing = healthSession.articles.filter(
      (a) => (a.details?.links?.missingInternal || []).length > 0
    ).length;
    globalBtn.disabled = needing === 0;
    globalBtn.textContent =
      needing > 0
        ? `Connect All Internal Links (${needing})`
        : 'Connect All Internal Links';
  }
  const proposeAllBtn = document.getElementById('health-propose-external-all');
  if (proposeAllBtn && !healthSession.batchRunning) {
    const needingExt = healthSession.articles.filter(
      (a) => (a.details?.links?.externalCount || 0) < 3
    ).length;
    proposeAllBtn.disabled = needingExt === 0;
    proposeAllBtn.textContent =
      needingExt > 0
        ? `Find & Suggest External Links (${needingExt})`
        : 'Find & Suggest External Links';
  }
  setStatus(
    statusEl,
    `${healthSession.articles.length} articles · Internal ${counts.internalGreen} green / ${counts.internalRed} red · External ${counts.externalGreen} green / ${counts.externalRed} red`
  );
  updateHealthBanner();
  return data;
}

async function runGlobalConnectAllInternal() {
  if (healthSession.batchRunning) return;
  const statusEl = document.getElementById('health-status');
  const data = await refreshArticlesHealth();
  const queue = (data.articles || []).filter(
    (a) => (a.details?.links?.missingInternal || []).length > 0
  );
  if (!queue.length) {
    setHealthBatchProgress('No missing required internal links.');
    return;
  }

  setHealthBatchControlsDisabled(true);
  let totalConnected = 0;
  let articlesTouched = 0;

  try {
    for (let aIndex = 0; aIndex < queue.length; aIndex++) {
      const article = queue[aIndex];
      const missing = article.details.links.missingInternal;
      const result = await connectAllInternalForArticle(
        article.slug,
        missing,
        ({ index, total }) => {
          setHealthBatchProgress(
            `Article ${aIndex + 1} of ${queue.length}: ${article.slug} — connecting ${index} of ${total} links...`,
            { active: true, current: aIndex, total: queue.length }
          );
        }
      );
      if (result.connected > 0) articlesTouched += 1;
      totalConnected += result.connected;
    }

    updateHealthBanner();
    setHealthBatchControlsDisabled(false);
    await refreshArticlesHealth();
    setHealthBatchProgress(
      `Connected ${totalConnected} link${totalConnected === 1 ? '' : 's'} across ${articlesTouched} article${articlesTouched === 1 ? '' : 's'}.`
    );
    setStatus(
      statusEl,
      `Batch complete — connected ${totalConnected} internal link${totalConnected === 1 ? '' : 's'} across ${articlesTouched} article${articlesTouched === 1 ? '' : 's'}.`
    );
  } catch (err) {
    setStatus(statusEl, err.message, true);
    setHealthBatchProgress(`Batch stopped: ${err.message}`);
    setHealthBatchControlsDisabled(false);
    await refreshArticlesHealth().catch(() => {});
  }
}

async function initArticlesHealth() {
  const list = document.getElementById('health-list');
  if (!list) return;
  document.getElementById('health-connect-all')?.addEventListener('click', () => {
    void runGlobalConnectAllInternal();
  });
  document.getElementById('health-propose-external-all')?.addEventListener('click', () => {
    void runProposeAllExternal();
  });
  document.getElementById('health-review-cancel')?.addEventListener('click', () => {
    hideExternalReview();
    setHealthBatchProgress('External-link review cancelled — nothing written.');
  });
  document.getElementById('health-review-add')?.addEventListener('click', () => {
    void runAddSelectedExternal();
  });
  await refreshArticlesHealth();
}

init();
