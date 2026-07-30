import fs from 'node:fs';

const html = fs.readFileSync(
  'site/dist/articles/cms-ui-verification-article/index.html',
  'utf8'
);
const meta = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1];
const og = (html.match(/<meta property="og:description" content="([^"]*)"/) || [])[1];
const tw = (html.match(/<meta name="twitter:description" content="([^"]*)"/) || [])[1];

const sitemap = fs.readFileSync('site/dist/sitemap-0.xml', 'utf8');
const rss = fs.readFileSync('site/dist/rss.xml', 'utf8');
const llms = fs.readFileSync('site/dist/llms.txt', 'utf8');

const articleDirs = fs
  .readdirSync('site/dist/articles')
  .filter((n) => fs.statSync(`site/dist/articles/${n}`).isDirectory());

console.log(
  JSON.stringify(
    {
      meta,
      og,
      tw,
      metaEqOg: meta === og,
      metaEqTw: meta === tw,
      draftRouteExists: fs.existsSync('site/dist/articles/draft-should-not-exist'),
      draftInSitemap: sitemap.includes('draft-should-not-exist'),
      draftInRss: rss.includes('draft-should-not-exist'),
      draftInLlms:
        llms.includes('draft-should-not-exist') || llms.includes('Draft Article'),
      articleDirs,
    },
    null,
    2
  )
);
