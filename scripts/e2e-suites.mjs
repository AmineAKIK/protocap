export const E2E_SUITES = Object.freeze({
  critical: Object.freeze({
    script: 'test:e2e',
    config: 'playwright.config.ts',
    projects: ['chromium'],
    specs: [
      'e2e/shiftguide-critical.spec.ts',
      'e2e/packing-calculator.spec.ts',
    ],
  }),
  responsive: Object.freeze({
    script: 'test:e2e:responsive',
    config: 'playwright.config.ts',
    projects: ['chromium'],
    specs: [
      'e2e/responsive-contract.spec.ts',
      'e2e/responsive-coverage.spec.ts',
      'e2e/packing-responsive-contract.spec.ts',
      'e2e/logistics-form-responsive.spec.ts',
    ],
  }),
  'browser-smoke': Object.freeze({
    script: 'test:e2e:browser-smoke',
    config: 'playwright.config.ts',
    projects: ['chromium-mobile', 'webkit'],
    specs: ['e2e/browser-smoke.spec.ts'],
  }),
  accessibility: Object.freeze({
    script: 'test:e2e:a11y',
    config: 'playwright.config.ts',
    projects: ['chromium'],
    specs: ['e2e/accessibility.spec.ts'],
  }),
  expiry: Object.freeze({
    script: 'test:e2e:expiry',
    config: 'playwright.config.ts',
    projects: ['chromium', 'chromium-mobile', 'webkit'],
    specs: ['e2e/expiry-time.spec.ts'],
  }),
  logistics: Object.freeze({
    script: 'test:e2e:logistics',
    config: 'playwright.config.ts',
    projects: ['chromium', 'chromium-mobile', 'webkit'],
    specs: ['e2e/logistics-reliability.spec.ts'],
  }),
  concurrency: Object.freeze({
    script: 'test:e2e:concurrency',
    config: 'playwright.config.ts',
    projects: ['chromium'],
    specs: ['e2e/local-concurrency.spec.ts'],
  }),
  'public-demo': Object.freeze({
    script: 'test:e2e:public-demo',
    config: 'playwright.public-demo.config.ts',
    projects: ['chromium', 'chromium-mobile', 'webkit'],
    specs: ['e2e/public-demo.spec.ts'],
  }),
});

export function playwrightArguments(name, { list = false } = {}) {
  const suite = E2E_SUITES[name];
  if (!suite) throw new Error(`Unknown E2E suite: ${name}`);
  return [
    'test',
    ...suite.specs,
    '--config',
    suite.config,
    ...suite.projects.flatMap((project) => ['--project', project]),
    ...(list ? ['--list'] : []),
  ];
}
