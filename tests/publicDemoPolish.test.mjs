import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const PUBLIC_ORIGIN = 'https://protocap-production.up.railway.app';

test('public demo metadata is canonical and shareable', async () => {
  const [indexHtml, viteConfig, robots, sitemap, socialCard] = await Promise.all([
    read('index.html'),
    read('vite.config.ts'),
    read('public/robots.txt'),
    read('public/sitemap.xml'),
    read('public/social-card.svg'),
  ]);

  assert.match(indexHtml, new RegExp(`<link rel="canonical" href="${PUBLIC_ORIGIN}/"`));
  assert.match(indexHtml, /property="og:title"/);
  assert.match(indexHtml, /property="og:image"/);
  assert.match(indexHtml, /name="twitter:card" content="summary_large_image"/);
  assert.match(indexHtml, /name="robots" content="index,follow"/);

  assert.match(viteConfig, /id: base/);
  assert.match(viteConfig, /scope: base/);
  assert.match(viteConfig, /lang: 'fr'/);

  assert.match(robots, /User-agent: \*/);
  assert.match(robots, new RegExp(`Sitemap: ${PUBLIC_ORIGIN}/sitemap\\.xml`));
  assert.match(sitemap, new RegExp(`<loc>${PUBLIC_ORIGIN}/</loc>`));
  assert.match(socialCard, /ProtoCap/);
});

test('Céline disclosure states AI boundary and local history behavior', async () => {
  const homePage = await read('src/pages/HomePage.tsx');

  assert.match(homePage, /règles déterministes/);
  assert.match(homePage, /service IA distant/);
  assert.match(homePage, /historique est conservé localement/);
  assert.match(homePage, /ne pas saisir de donnée sensible/);
  assert.match(homePage, /Céline guide, l'opérateur décide/);
});
