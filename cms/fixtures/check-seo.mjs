import fs from 'node:fs';

const html = fs.readFileSync(
  'site/dist/articles/cms-ui-verification-article/index.html',
  'utf8'
);
const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1];
const canon = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) =>
  m[1].replace(/<[^>]+>/g, '')
);
const headings = [...html.matchAll(/<(h[1-6])[^>]*>/gi)].map((m) => m[1].toLowerCase());
const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
  (m) => JSON.parse(m[1])
);

const cmsTitle = 'CMS UI Verification Pass Confirms Trailing Slash Checks';
const cmsDesc =
  'This article was generated through the real CMS index.html UI to verify drag-drop parsing, image session uploads, validation, JSON-LD preview, and Generate.';

function headingSkips(list) {
  const nums = list.map((h) => Number(h[1]));
  const skips = [];
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] > nums[i - 1] + 1) skips.push(`${list[i - 1]} -> ${list[i]}`);
  }
  return skips;
}

const out = {
  title,
  titleMatchesCms: title === cmsTitle,
  desc,
  descMatchesCms: desc === cmsDesc,
  canon,
  h1Count: h1s.length,
  h1s,
  headings,
  headingSkips: headingSkips(headings),
  types: blocks.map((b) => b['@type']),
  blocks,
};

fs.writeFileSync('cms/fixtures/seo-check.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({ ...out, blocks: out.types }, null, 2));
