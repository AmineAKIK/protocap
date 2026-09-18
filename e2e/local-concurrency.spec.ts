import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const EXPIRY_V1 = 'lineops.expiry.aggregate.v1';
const EXPIRY_V2 = 'lineops.expiry.aggregate.v2';
const LOGISTICS_V8 = 'lineops.logistics.requests.v8';
const LOGISTICS_V9 = 'lineops.logistics.requests.v9';

async function openExpiry(page: Page) {
  await page.clock.setFixedTime(new Date('2026-09-17T12:00:30.000Z'));
  await page.goto('/expiry-check');
  await expect(page.getByRole('heading', { name: 'Expiry Check', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), EXPIRY_V2)).not.toBeNull();
}

async function openLogistics(page: Page) {
  await page.goto('/logistics-call');
  await expect(page.getByRole('heading', { name: 'Logistics Call' })).toBeVisible();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), LOGISTICS_V9)).not.toBeNull();
}

async function secondPage(context: BrowserContext) {
  return context.newPage();
}

test.describe('PR-08 local concurrency contract', () => {
  test('T23/T40/T41: two Expiry tabs preserve both compatible declarations across v1 -> v2 migration and reload', async ({ page, context }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lineops.expiry.aggregate.v1', JSON.stringify({
        schemaVersion: 1,
        lines: [{
          id: 'a', name: 'Ligne de conditionnement A', vat: 'Cuve 1', product: 'Fixture',
          conditioningStartedAt: '2026-09-15T12:00:00.000Z',
          elements: [{
            type: 'fillingBlock', label: 'Bloc', lastChangedAt: '2026-09-15T12:00:00.000Z',
            expiresAt: '2026-09-20T12:00:00.000Z', validityDays: 5, operator: 'Fixture',
          }],
        }],
        history: [],
      }));
    });
    await openExpiry(page);
    const other = await secondPage(context);
    await openExpiry(other);
    const v1Before = await page.evaluate((key) => localStorage.getItem(key), EXPIRY_V1);

    for (const [target, operator, vat] of [[page, 'Onglet A', 'Cuve A'], [other, 'Onglet B', 'Cuve B']] as const) {
      await target.getByRole('button', { name: 'Ajouter une recharge de cuve' }).click();
      await target.getByLabel('Opérateur', { exact: true }).fill(operator);
      await target.getByLabel('Cuve rechargée').fill(vat);
    }

    await Promise.all([
      page.getByRole('button', { name: 'Tracer la recharge' }).click(),
      other.getByRole('button', { name: 'Tracer la recharge' }).click(),
    ]);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(other.getByRole('dialog')).toHaveCount(0);

    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), EXPIRY_V2) as {
      revision: number;
      history: { id: string; operator: string }[];
    };
    expect(stored.revision).toBeGreaterThanOrEqual(3);
    expect(stored.history.map((entry) => entry.operator)).toEqual(expect.arrayContaining(['Onglet A', 'Onglet B']));
    expect(new Set(stored.history.map((entry) => entry.id)).size).toBe(stored.history.length);
    expect(await page.evaluate((key) => localStorage.getItem(key), EXPIRY_V1)).toBe(v1Before);

    const v2Raw = await page.evaluate((key) => localStorage.getItem(key), EXPIRY_V2);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Expiry Check', exact: true })).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), EXPIRY_V2)).toBe(v2Raw);
    await other.close();
  });

  test('T23/T40/T41: two Logistics tabs preserve both creates and v8 remains an immutable migration source', async ({ page, context }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lineops.logistics.requests.v8', JSON.stringify([]));
    });
    await openLogistics(page);
    const other = await secondPage(context);
    await openLogistics(other);
    const v8Before = await page.evaluate((key) => localStorage.getItem(key), LOGISTICS_V8);

    await page.getByLabel('Zone de ligne').fill('Zone onglet A');
    await page.getByLabel('Commentaire').fill('Mutation A');
    await other.getByLabel('Zone de ligne').fill('Zone onglet B');
    await other.getByLabel('Commentaire').fill('Mutation B');

    await Promise.all([
      page.getByRole('button', { name: "Enregistrer l'appel logistique" }).click(),
      other.getByRole('button', { name: "Enregistrer l'appel logistique" }).click(),
    ]);
    await expect(page.getByText(/enregistré localement/)).toBeVisible();
    await expect(other.getByText(/enregistré localement/)).toBeVisible();

    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), LOGISTICS_V9) as {
      revision: number;
      requests: { zone: string; id: string }[];
    };
    expect(stored.requests.map((entry) => entry.zone)).toEqual(expect.arrayContaining(['Zone onglet A', 'Zone onglet B']));
    expect(new Set(stored.requests.map((entry) => entry.id)).size).toBe(stored.requests.length);
    expect(stored.revision).toBeGreaterThanOrEqual(3);
    expect(await page.evaluate((key) => localStorage.getItem(key), LOGISTICS_V8)).toBe(v8Before);

    const raw = await page.evaluate((key) => localStorage.getItem(key), LOGISTICS_V9);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Logistics Call' })).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), LOGISTICS_V9)).toBe(raw);
    await other.close();
  });

  test('T23: a queued Web Lock is cancellable before its mutation enters', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      let release!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      let entered = false;
      const holder = navigator.locks.request('protocap:e2e:cancellable', async () => held);
      const controller = new AbortController();
      const queued = navigator.locks.request(
        'protocap:e2e:cancellable',
        { signal: controller.signal },
        async () => { entered = true; },
      ).then(() => 'completed', (error) => error instanceof DOMException ? error.name : 'error');
      controller.abort();
      release();
      await holder;
      return { outcome: await queued, entered };
    });
    expect(result).toEqual({ outcome: 'AbortError', entered: false });
  });

  test('T23/T42: absence of Web Locks is explicit read-only, not a silent local write', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
      localStorage.setItem('lineops.logistics.requests.v8', JSON.stringify([]));
    });
    await page.goto('/logistics-call');
    await expect(page.getByRole('heading', { name: 'Logistics Call' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/lecture seule/i);
    await expect(page.getByRole('button', { name: "Enregistrer l'appel logistique" })).toBeDisabled();
    expect(await page.evaluate((key) => localStorage.getItem(key), LOGISTICS_V9)).toBeNull();
  });
});
