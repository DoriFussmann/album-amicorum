/* global document, fetch, FormData, File, URLSearchParams */

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

function showError(msg) {
  const el = $('error-box');
  el.hidden = false;
  el.textContent = msg;
  $('success-box').hidden = true;
}

function showSuccess(msg) {
  const el = $('success-box');
  el.hidden = false;
  el.textContent = msg;
  $('error-box').hidden = true;
}

function clearAlerts() {
  $('error-box').hidden = true;
  $('success-box').hidden = true;
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
    image2Alt: $('image2Alt').value.trim(),
    image3Alt: $('image3Alt').value.trim(),
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
  const row = document.createElement('p');
  row.dataset.row = '1';
  fields.forEach((f) => {
    const label = document.createElement('label');
    label.textContent = f + ' ';
    const input = document.createElement('input');
    input.type = 'text';
    input.dataset.field = f;
    input.value = values[f] || '';
    input.addEventListener('input', () => scheduleValidate());
    label.appendChild(input);
    row.appendChild(label);
    row.appendChild(document.createTextNode(' '));
  });
  const remove = document.createElement('button');
  remove.type = 'button';
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
  tc.textContent = `${t.length} chars (need ${TITLE_MIN}–${TITLE_MAX})`;
  tc.style.color = t.length >= TITLE_MIN && t.length <= TITLE_MAX ? 'green' : 'red';

  const d = $('description').value;
  const dc = $('description-count');
  dc.textContent = `${d.length} chars (need ${DESCRIPTION_MIN}–${DESCRIPTION_MAX})`;
  dc.style.color = d.length >= DESCRIPTION_MIN && d.length <= DESCRIPTION_MAX ? 'green' : 'red';
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

function renderChecklist(validation) {
  const ul = $('field-checklist');
  ul.innerHTML = '';
  const byField = Object.fromEntries((validation?.statuses || []).map((s) => [s.field, s]));

  for (const field of CHECKLIST_FIELDS) {
    const li = document.createElement('li');
    const status = byField[field];
    const ok = status ? status.ok : false;
    if (ok) {
      li.textContent = `✓ ${field}${status.message ? ` — ${status.message}` : ''}`;
    } else {
      const label = document.createElement('span');
      label.textContent = `✗ ${field}${status?.message ? ` — ${status.message}` : ' — needs input'}: `;
      li.appendChild(label);
      // editable hint: focus corresponding control if exists
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Focus';
      btn.addEventListener('click', () => {
        const el = $(field) || $(field === 'image' ? 'image-drop' : field);
        if (el) el.focus?.();
      });
      li.appendChild(btn);
    }
    ul.appendChild(li);
  }
}

function hasHeroImage() {
  return Boolean(sessionImageFiles.image || $('title').dataset.priorImage);
}

function basenamePath(p) {
  if (!p) return '';
  const parts = String(p).replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || p;
}

function updateGenerateButton(validation, collision) {
  const btn = $('generate');
  const reason = $('generate-reason');
  const reasons = [];

  if (!validation?.ok) {
    reasons.push(validation?.summary || 'Validation incomplete');
  }
  if (!hasHeroImage()) {
    reasons.push('Hero image required — drop or choose a file');
  }
  if (collision?.exists && !$('overwrite').checked) {
    reasons.push(`Slug collision: ${collision.file} exists — enable overwrite or rename slug`);
    $('collision-warning').hidden = false;
    $('collision-warning').textContent =
      `Warning: ${collision.file} already exists. Enable overwrite or change the slug.`;
  } else {
    $('collision-warning').hidden = true;
  }

  const unique = [...new Set(reasons)];
  const canGenerate = Boolean(
    validation?.ok && hasHeroImage() && (!collision?.exists || $('overwrite').checked)
  );

  btn.disabled = !canGenerate || generating;
  reason.textContent = canGenerate
    ? 'Ready to generate.'
    : `Generate disabled: ${unique.join(' · ')}`;

  $('warnings').textContent = (validation?.warnings || []).join('\n');
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
    $('missing-summary').textContent = json.validation.summary;
    renderChecklist(json.validation);
    updateGenerateButton(json.validation, json.collision);
  } catch (e) {
    showError(e.message);
    $('generate').disabled = true;
    $('generate-reason').textContent = `Generate disabled: ${e.message}`;
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
  $('image2Alt').value = data.image2Alt || '';
  $('image3Alt').value = data.image3Alt || '';
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

function updateImageSlotStatus() {
  const prior = $('title').dataset.priorImage || '';
  const prior2 = $('title').dataset.priorImage2 || '';
  const prior3 = $('title').dataset.priorImage3 || '';

  $('slot-image-status').textContent = sessionImageFiles.image
    ? `new: ${sessionImageFiles.image.name}`
    : prior
      ? `keeping: ${basenamePath(prior)}`
      : 'not uploaded';

  $('slot-image2-status').textContent = sessionImageFiles.image2
    ? `new: ${sessionImageFiles.image2.name}`
    : clearedImageSlots.image2
      ? 'cleared'
      : prior2
        ? `keeping: ${basenamePath(prior2)}`
        : 'not uploaded';

  $('slot-image3-status').textContent = sessionImageFiles.image3
    ? `new: ${sessionImageFiles.image3.name}`
    : clearedImageSlots.image3
      ? 'cleared'
      : prior3
        ? `keeping: ${basenamePath(prior3)}`
        : 'not uploaded';
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

function acceptImages(fileList) {
  const incoming = [...fileList];
  if (!incoming.length) return;

  let blockedBySize = false;

  if (pendingReplaceSlot) {
    const slot = pendingReplaceSlot;
    pendingReplaceSlot = null;
    const file = incoming[0];
    if (file.size > 10 * 1024 * 1024) {
      showError(`${file.name} exceeds 10MB limit (max 10MB per file)`);
      $('generate').disabled = true;
      $('generate-reason').textContent = `Generate disabled: ${file.name} exceeds 10MB`;
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
      $('generate').disabled = true;
      $('generate-reason').textContent = `Generate disabled: ${msg}`;
      continue;
    }
    if (!isImageFile(file)) {
      showError(`${file.name} is not a recognized image file`);
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
      $('generate').disabled = true;
      if (!$('generate-reason').textContent.includes('10MB')) {
        $('generate-reason').textContent = `Generate disabled: ${msg}`;
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
  ul.innerHTML = '';
  if (!data.articles.length) {
    ul.innerHTML = '<li>No articles yet.</li>';
    return;
  }
  for (const a of data.articles) {
    const li = document.createElement('li');
    li.innerHTML = `<a href="?edit=${encodeURIComponent(a.slug)}">${escapeHtml(a.title)}</a>
      (${a.slug}) ${a.draft ? '[draft]' : ''}
      <button type="button" data-unpublish="${a.slug}">Unpublish</button>
      <button type="button" data-publish="${a.slug}">Publish</button>
      <button type="button" data-delete="${a.slug}">Delete</button>`;
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
        showSuccess('Unpublished (draft: true)');
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
        showSuccess('Published (draft: false)');
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
        showSuccess(`Deleted ${slug}`);
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
  el.addEventListener('click', () => {
    pendingReplaceSlot = null;
    fileInput.value = '';
    fileInput.click();
  });
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  el.addEventListener('drop', (e) => {
    e.preventDefault();
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
  const input = $('image-files');
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
    showSuccess(`Parsed ${file.name}`);
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
  clearAlerts();
  generating = true;
  $('generate').disabled = true;
  $('generate-reason').textContent = 'Generating…';

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
    // Keep existing relative paths for slots without a new upload; strip session markers
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
    showSuccess(`Generated ${json.slug}.md and rebuilt llms.txt`);
    await loadArticleList();
    // Refresh prior paths from what we just wrote
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
    showError(e.message);
    $('generate-reason').textContent = `Generate failed: ${e.message}`;
  } finally {
    generating = false;
    const preservedError = $('error-box').hidden ? null : $('error-box').textContent;
    const preservedReason = $('generate-reason').textContent;
    await runValidate();
    if (preservedError) {
      showError(preservedError);
      $('generate').disabled = true;
      $('generate-reason').textContent = preservedReason;
    }
  }
}

function extFromName(name) {
  const m = /\.[a-z0-9]+$/i.exec(name || '');
  return m ? m[0].toLowerCase() : '.jpg';
}

async function init() {
  setupDropZone($('md-drop'), $('md-file'), handleMarkdownFiles);
  setupDropZone($('image-drop'), $('image-files'), acceptImages);

  $('image-choose').addEventListener('click', () => openImagePickerForSlot(null));

  document.querySelectorAll('[data-replace-slot]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openImagePickerForSlot(btn.getAttribute('data-replace-slot'));
    });
  });
  document.querySelectorAll('[data-clear-slot]').forEach((btn) => {
    btn.addEventListener('click', () => {
      clearOptionalImageSlot(btn.getAttribute('data-clear-slot'));
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
    'image2Alt',
    'image3Alt',
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

  try {
    const routesRes = await fetch('/api/known-routes');
    const routesJson = await parseJsonResponse(routesRes);
    if (routesRes.ok && routesJson.ok) knownRoutes = routesJson;

    await loadTeamOptions();
    await loadArticleList();
    await loadEditFromQuery();
    renderChecklist({ statuses: CHECKLIST_FIELDS.map((f) => ({ field: f, ok: false, message: 'not validated yet' })) });
    scheduleValidate();
  } catch (e) {
    showError(e.message);
  }
}

init();
