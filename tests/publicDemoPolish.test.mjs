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
  for (const path of [
    '/',
    '/rapport',
    '/proposition-pilote',
    '/shiftguide',
    '/expiry-check',
    '/logistics-call',
    '/knowledge-base',
    '/packing-calculator',
  ]) {
    assert.match(sitemap, new RegExp(`<loc>${PUBLIC_ORIGIN}${path === '/' ? '/' : path}</loc>`));
  }
  assert.match(socialCard, /ProtoCap/);
});

test('Céline disclosure states the browser, server and remote-provider data boundaries', async () => {
  const homePage = await read('src/pages/HomePage.tsx');

  assert.match(homePage, /règles déterministes/);
  assert.match(homePage, /service IA distant/);
  assert.match(homePage, /historique visible reste dans ce navigateur/);
  assert.match(homePage, /contexte sémantique borné/);
  assert.match(homePage, /conservé côté serveur/);
  assert.match(homePage, /transmis au fournisseur IA/);
  assert.match(homePage, /Ne pas saisir de donnée sensible/);
  assert.doesNotMatch(homePage, /L’historique est conservé localement dans ce navigateur/);
  assert.match(homePage, /Céline guide, l'opérateur décide/);
});

test('browser-local modules do not claim shared synchronization', async () => {
  const logistics = await read('src/pages/LogisticsCallPage.tsx');

  assert.match(logistics, /board logistique persisté localement dans ce navigateur/);
  assert.doesNotMatch(logistics, /board logistique synchronisé/);
});

test('release documentation matches the current CI and records known install warnings', async () => {
  const [readme, qualityGates] = await Promise.all([
    read('README.md'),
    read('docs/quality-gates.md'),
  ]);

  assert.match(readme, /installs Chromium and WebKit/);
  assert.match(readme, /mobile Chromium\/WebKit browser smoke tests/);
  assert.match(readme, /axe accessibility regression scans/);

  assert.match(qualityGates, /source-map@0\.8\.0-beta\.0/);
  assert.match(qualityGates, /glob@11\.1\.0/);
  assert.match(qualityGates, /esbuild@0\.25\.12/);
  assert.match(qualityGates, /zero vulnerabilities/);
  assert.match(qualityGates, /npm cache clean --force/);
});
