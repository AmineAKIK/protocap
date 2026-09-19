import { expect, test, type Page } from '@playwright/test';

const ACCESS_CODE = 'e2e-access-code';
const productionStart = '2026-09-15T07:30';
const ESSAY_PDF_PATH = '/rendre-l-attention-au-reel-akik-mohamed-amine.pdf';

async function expectNoHorizontalOverflow(page: Page) {
  const viewport = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.innerWidth + 1);
}

async function expectPilotCriticalContentVisible(page: Page) {
  await expect(page.getByRole('heading', { name: 'Assistant de rappel des prélèvements en production' })).toBeVisible();
  await expect(page.getByText('Aujourd’hui')).toBeVisible();
  await expect(page.getByText('Interprétation de la règle')).toBeVisible();
  await expect(page.getByText('Prélèvement', { exact: true }).first()).toBeVisible();
}

test.describe('browser and responsive smoke', () => {
  test('renders the public shell with installable PWA metadata and no horizontal overflow', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ProtoCap/);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /manifest/i);
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /width=device-width/);
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBeTruthy();
    const manifest = await page.evaluate(async (href) => {
      const response = await fetch(href!);
      return { ok: response.ok, body: await response.json() };
    }, manifestHref);
    expect(manifest.ok).toBe(true);
    expect(manifest.body.name).toBe('ProtoCap');
    expect(manifest.body.short_name).toBe('ProtoCap');
    await expectNoHorizontalOverflow(page);
  });

  test('essay page exposes readable and downloadable PDF actions without overflow', async ({ page }) => {
    await page.goto('/essai');
    await expect(page.getByRole('heading', { name: 'Rendre l’attention au réel' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Couverture de l’essai Rendre l’attention au réel' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Lire le PDF' })).toHaveAttribute('href', ESSAY_PDF_PATH);
    await expect(page.getByRole('link', { name: 'Télécharger le PDF' })).toHaveAttribute(
      'download',
      'rendre-l-attention-au-reel-akik-mohamed-amine.pdf',
    );
    await expectNoHorizontalOverflow(page);
  });

  test('PWA navigation serves the essay PDF instead of the SPA fallback', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    const pdfResponse = page.waitForResponse((response) =>
      response.request().url().endsWith(ESSAY_PDF_PATH),
    );
    await page.evaluate((path) => {
      const frame = document.createElement('iframe');
      frame.src = path;
      frame.hidden = true;
      document.body.appendChild(frame);
    }, ESSAY_PDF_PATH);

    const response = await pdfResponse;
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/pdf');
  });

  test('T40: a PWA update check and reload preserve browser-local planning data', async ({ page }) => {
    await page.goto('/packing-calculator');
    await page.getByLabel('Quantité demandée').fill('30880');
    await page.getByLabel('Unités par carton').fill('128');
    await page.getByLabel('Cartons par palette').fill('40');

    const storageKey = 'lineops.packing.form.inputs.v8';
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey)).not.toBeNull();
    const before = await page.evaluate((key) => localStorage.getItem(key), storageKey);

    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
    });
    await page.reload();

    await expect(page.getByLabel('Quantité demandée')).toHaveValue('30880');
    await expect(page.getByLabel('Unités par carton')).toHaveValue('128');
    await expect(page.getByLabel('Cartons par palette')).toHaveValue('40');
    expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(before);
  });

  test('Pilot proposal is stable on mobile, tablet, small laptop and desktop widths', async ({ page }) => {
    const viewports = [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1180, height: 820 },
      { width: 1366, height: 768 },
    ];
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/proposition-pilote');
      await expectPilotCriticalContentVisible(page);
      await expectNoHorizontalOverflow(page);
    }
  });

  test('Packing Calculator keeps its primary declaration action usable without horizontal overflow', async ({ page }) => {
    await page.goto('/packing-calculator');
    await page.getByLabel('Quantité demandée').fill('30880');
    await page.getByLabel('Unités par carton').fill('128');
    await page.getByLabel('Cartons par palette').fill('40');
    await page.getByRole('textbox', { name: 'Début OC' }).fill(productionStart);
    await page
      .getByRole('radiogroup', { name: 'Stratégie de conditionnement' })
      .getByRole('radio', { name: /Carton complet/i })
      .click();
    await page.getByLabel('Cadence réf.').fill('60');
    await page.getByRole('button', { name: 'Lancer le suivi de production' }).click();

    await expect(page.getByRole('heading', { name: 'Conduite de production' })).toBeVisible();
    const primaryAction = page.getByRole('button', { name: /Déclarer une palette complète/i });
    await primaryAction.scrollIntoViewIfNeeded();
    await expect(primaryAction).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('unlocks a protected ShiftGuide deep link and keeps the primary action usable', async ({ page }) => {
    await page.goto('/shiftguide/module/module_standard');
    await expect(page.getByText('Accès restreint')).toBeVisible();
    await page.getByLabel("Code d'accès").fill(ACCESS_CODE);
    await page.getByRole('button', { name: 'Déverrouiller' }).click();
    await expect(page.getByText('Valider le contrôle E2E')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Valider' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
