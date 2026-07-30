import { validateFrontmatter } from '../lib/validateFrontmatter.ts';
import { SITE_URL, FORBIDDEN_EXTERNAL_HOSTS } from '../../site/src/config/site.ts';

const base = {
  title: 'CMS UI Verification Pass Confirms Trailing Slash Checks',
  description:
    'This article was regenerated through the CMS edit flow to confirm overwrite replaces the prior markdown file without leaving duplicates behind.',
  slug: 'cms-ui-verification-article',
  date: '2026-07-30',
  author: 'alex-rivera',
  category: 'Verification',
  tags: ['cms', 'verification', 'seo', 'geo'],
  imageAlt: 'Updated hero alt text for overwrite verification',
};

function check(url: string) {
  const result = validateFrontmatter({
    data: {
      ...base,
      externalLinks: [{ label: 'Bad', url }],
    },
    sessionImages: {
      image: { stagedPath: 'session', originalName: 'hero.png' },
    },
    teamSlugs: ['alex-rivera'],
    knownSlugs: { articles: [], team: ['alex-rivera'], services: [] },
  });
  const hit = result.invalid.some((i) => i.includes('externalLinks[0].url'));
  return { url, rejected: hit, summary: result.summary, ok: result.ok };
}

const siteHost = new URL(SITE_URL).hostname;
const siteUrlExternal = `${SITE_URL.replace(/\/+$/, '')}/some-page`;

console.log(
  JSON.stringify(
    {
      SITE_URL,
      siteHost,
      FORBIDDEN_EXTERNAL_HOSTS,
      rejectExampleCom: check('https://example.com/foo'),
      rejectWwwExample: check('https://www.example.com/foo'),
      rejectSiteUrl: check(siteUrlExternal),
      // control: should NOT reject a third-party domain
      allowThirdParty: check('https://developers.google.com/search/docs'),
    },
    null,
    2
  )
);
