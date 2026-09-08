import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const viewports = [
  [320, 568], [360, 640], [390, 844], [412, 915], [480, 800], [600, 900],
  [768, 1024], [820, 1180], [912, 1368], [1024, 768], [1152, 864], [1280, 720],
  [1366, 768], [1440, 900], [1536, 864], [1600, 900], [1920, 1080], [2560, 1440],
] as const;

const outDir = 'test-results/packing-visual-audit';

type AuditFinding = {
  viewport: string;
  state: string;
  horizontalOverflow: number;
  outsideViewport: Array<{ tag: string; text: string; left: number; right: number; width: number }>;
  clippedText: Array<{ tag: string; text: string; scrollWidth: number; clientWidth: number; overflow: string; textOverflow: string }>;
  tinyTargets: Array<{ tag: string; text: string; width: number; height: number }>;
  brokenBusinessNumbers: Array<{ text: string; lines: number; width: number }>;
  arbitraryPackingWraps: Array<{ tag: string; text: string; overflowWrap: string; wordBreak: string }>;
};

async function resetPackingState(page: Page) {
  await page.goto('/packing-calculator');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function fillReference(page: Page, quantity = '30880') {
  await page.getByLabel('Quantité demandée en unités').fill(quantity);
  await page.getByLabel('Unités par carton').fill('128');
  await page.getByLabel('Cartons par palette').fill('40');
  await page.getByRole('radio', { name: /Carton/i }).click();
  await expect(page.getByRole('heading', { name: 'Découpage final sélectionné' })).toBeVisible();
}

async function auditDom(page: Page, viewport: string, state: string): Promise<AuditFinding> {
  return page.evaluate(({ viewport, state }) => {
    const horizontalOverflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth;
    const outsideViewport: AuditFinding['outsideViewport'] = [];
    const clippedText: AuditFinding['clippedText'] = [];
    const tinyTargets: AuditFinding['tinyTargets'] = [];
    const brokenBusinessNumbers: AuditFinding['brokenBusinessNumbers'] = [];
    const arbitraryPackingWraps: AuditFinding['arbitraryPackingWraps'] = [];

    const visible = (el: Element) => {
      const node = el as HTMLElement;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0 && rect.width > 0 && rect.height > 0;
    };

    const isScreenReaderOnly = (node: HTMLElement) => node.classList.contains('sr-only') || Boolean(node.closest('.sr-only'));

    for (const el of Array.from(document.querySelectorAll('body *'))) {
      if (!visible(el)) continue;
      const node = el as HTMLElement;
      const rect = node.getBoundingClientRect();
      const text = (node.childElementCount === 0 ? node.textContent : '').trim().replace(/\s+/g, ' ').slice(0, 180);
      const style = getComputedStyle(node);

      if (!isScreenReaderOnly(node) && (rect.left < -1 || rect.right > window.innerWidth + 1)) {
        outsideViewport.push({ tag: node.tagName.toLowerCase(), text, left: rect.left, right: rect.right, width: rect.width });
      }

      if (!isScreenReaderOnly(node) && text && node.scrollWidth > node.clientWidth + 1 && ['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX)) {
        clippedText.push({ tag: node.tagName.toLowerCase(), text, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth, overflow: style.overflowX, textOverflow: style.textOverflow });
      }

      if (node.matches('button, input, [role="radio"]') && !node.hasAttribute('disabled')) {
        if (rect.height < 44 || rect.width < 44) tinyTargets.push({ tag: node.tagName.toLowerCase(), text, width: rect.width, height: rect.height });
      }

      if (node.classList.contains('tabular-nums') && text) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const lines = new Set(Array.from(range.getClientRects()).map((line) => Math.round(line.top))).size;
        if (lines > 1) brokenBusinessNumbers.push({ text, lines, width: rect.width });
      }

      if (
        text &&
        node.closest("[aria-label='Référence et résultat exact'], [aria-label='Découpage final et suivi manuel']") &&
        (style.overflowWrap === 'anywhere' || style.wordBreak === 'break-all')
      ) {
        arbitraryPackingWraps.push({ tag: node.tagName.toLowerCase(), text, overflowWrap: style.overflowWrap, wordBreak: style.wordBreak });
      }
    }

    return { viewport, state, horizontalOverflow, outsideViewport, clippedText, tinyTargets, brokenBusinessNumbers, arbitraryPackingWraps };
  }, { viewport, state });
}

test('capture exhaustive packing visual matrix', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await mkdir(outDir, { recursive: true });
  const findings: AuditFinding[] = [];

  for (const [width, height] of viewports) {
    const viewport = `${width}x${height}`;
    await page.setViewportSize({ width, height });

    await resetPackingState(page);
    findings.push(await auditDom(page, viewport, 'empty'));
    await page.screenshot({ path: `${outDir}/${viewport}-empty.png`, fullPage: true });

    await fillReference(page);
    findings.push(await auditDom(page, viewport, 'filled'));
    await page.screenshot({ path: `${outDir}/${viewport}-filled.png`, fullPage: true });

    const shipment = page.getByRole('region', { name: 'Charges à expédier' });
    for (let i = 0; i < 6; i += 1) await shipment.getByRole('button', { name: 'Déclarer la prochaine charge expédiée' }).click();
    findings.push(await auditDom(page, viewport, 'remainder-6-of-7'));
    await page.screenshot({ path: `${outDir}/${viewport}-remainder.png`, fullPage: true });

    await shipment.getByRole('button', { name: 'Déclarer la prochaine charge expédiée' }).click();
    findings.push(await auditDom(page, viewport, 'complete'));
    await page.screenshot({ path: `${outDir}/${viewport}-complete.png`, fullPage: true });

    await resetPackingState(page);
    await fillReference(page, '5120000000');
    findings.push(await auditDom(page, viewport, 'large-numbers'));
    await page.screenshot({ path: `${outDir}/${viewport}-large.png`, fullPage: true });
  }

  const totals = {
    horizontalOverflowCases: findings.filter((finding) => finding.horizontalOverflow > 1).length,
    outsideViewportElements: findings.reduce((sum, finding) => sum + finding.outsideViewport.length, 0),
    clippedTextElements: findings.reduce((sum, finding) => sum + finding.clippedText.length, 0),
    tinyTargets: findings.reduce((sum, finding) => sum + finding.tinyTargets.length, 0),
    brokenBusinessNumbers: findings.reduce((sum, finding) => sum + finding.brokenBusinessNumbers.length, 0),
    arbitraryPackingWraps: findings.reduce((sum, finding) => sum + finding.arbitraryPackingWraps.length, 0),
  };
  const report = { generatedAt: new Date().toISOString(), findings, totals };

  await writeFile(`${outDir}/report.json`, JSON.stringify(report, null, 2));
  await testInfo.attach('packing-visual-audit-report', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });

  expect(totals).toEqual({
    horizontalOverflowCases: 0,
    outsideViewportElements: 0,
    clippedTextElements: 0,
    tinyTargets: 0,
    brokenBusinessNumbers: 0,
    arbitraryPackingWraps: 0,
  });
});
