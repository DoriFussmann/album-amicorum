/* global document, window, fetch, FormData, File, URLSearchParams */

function pageKind() {
  const path = window.location.pathname;
  if (path.endsWith('add-article.html')) return 'article-form';
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

async function loadTeamOptions() {
  const res = await fetch('/api/team');
  const data = await parseJsonResponse(res);
  if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load team');
  const sel = $('author');
  const current = sel.value;
  sel.innerHTML = '<option value="">— select team member —</option>';
  for (const m of data.team) {
    const opt = document.createElement('option');
    opt.value = m.slug;
    opt.textContent = `${m.name} (${m.slug})`;
    sel.appendChild(opt);
  }
  if (current) sel.value = current;
}

async function loadArticleList() {
  const res = await fetch('/articles');
  const data = await parseJsonResponse(res);
  if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load articles');
  const ul = $('article-list');
  if (!ul) return;
  ul.innerHTML = '';
  if (!data.articles.length) {
    ul.innerHTML = '<li>No articles yet.</li>';
    return;
  }
  for (const a of data.articles) {
    const li = document.createElement('li');
    li.className = 'article-item';
    li.innerHTML = `<a href="/add-article.html?edit=${encodeURIComponent(a.slug)}">${escapeHtml(a.title)}</a>
      <span class="status-pill">${escapeHtml(a.slug)}</span>
      ${a.draft ? '<span class="status-pill is-blocked">draft</span>' : '<span class="status-pill is-ready">live</span>'}
      <button type="button" class="btn btn-ghost" data-unpublish="${a.slug}">Unpublish</button>
      <button type="button" class="btn btn-ghost" data-publish="${a.slug}">Publish</button>
      <button type="button" class="btn btn-danger" data-delete="${a.slug}">Delete</button>`;
    ul.appendChild(li);
  }

  ul.querySelectorAll('[data-unpublish]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        const res = await fetch(`/articles/${btn.getAttribute('data-unpublish')}/unpublish`, {
          method: 'POST',
        });
        const json = await parseJsonResponse(res);
        if (!res.ok || !json.ok) throw new Error(json.error || 'Unpublish failed');
        showSuccess('Unpublished (draft: true)', 'Updated');
        loadArticleList();
      } catch (e) {
        showError(e.message);
      }
    });
  });
  ul.querySelectorAll('[data-publish]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        const res = await fetch(`/articles/${btn.getAttribute('data-publish')}/publish`, {
          method: 'POST',
        });
        const json = await parseJsonResponse(res);
        if (!res.ok || !json.ok) throw new Error(json.error || 'Publish failed');
        showSuccess('Published (draft: false)', 'Updated');
        loadArticleList();
      } catch (e) {
        showError(e.message);
      }
    });
  });
  ul.querySelectorAll('[data-delete]').forEach((btn) => {
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
    // Force an explicit author choice on every new upload (do not keep parsed author).
    $('author').value = '';
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

async function initArticleListPage() {
  try {
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
    await initArticleFormPage();
  }
}

init();
