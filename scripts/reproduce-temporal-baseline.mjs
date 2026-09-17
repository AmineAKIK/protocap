import { spawnSync } from 'node:child_process';

const SOURCE_COMMIT = 'e5adec6d7c656a9dd63cea2a6db2509b23dbdf10';
const runtimeEnvironmentKeys = ['PATH', 'SystemRoot', 'ComSpec', 'PATHEXT', 'TEMP', 'TMP', 'TMPDIR'];

function childEnvironment(timeZone) {
  const environment = { TZ: timeZone };
  for (const key of runtimeEnvironmentKeys) {
    if (process.env[key] !== undefined) environment[key] = process.env[key];
  }
  return environment;
}

function evaluateInTimeZone(timeZone, source) {
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
    encoding: 'utf8',
    env: childEnvironment(timeZone),
  });
  if (result.status !== 0) {
    throw new Error(`Temporal reproduction failed in ${timeZone}: ${result.stderr.trim()}`);
  }
  return JSON.parse(result.stdout);
}

function reproduceLegacyRoundTrip(timeZone, instant) {
  return evaluateInTimeZone(timeZone, `
    const instant = ${JSON.stringify(instant)};
    const date = new Date(instant);
    const pad = (value) => String(value).padStart(2, '0');
    const actualLocalMinute = [
      date.getFullYear(), '-', pad(date.getMonth() + 1), '-', pad(date.getDate()),
      'T', pad(date.getHours()), ':', pad(date.getMinutes()),
    ].join('');
    const legacyDefaultValue = date.toISOString().slice(0, 16);
    const legacyStoredInstant = new Date(legacyDefaultValue).toISOString();
    console.log(JSON.stringify({
      timeZone: ${JSON.stringify(timeZone)},
      instant,
      actualLocalMinute,
      legacyDefaultValue,
      legacyStoredInstant,
      offsetMinutes: date.getTimezoneOffset(),
    }));
  `);
}

function reproduceCalendarDays(timeZone, year, monthIndex, day) {
  return evaluateInTimeZone(timeZone, `
    const start = new Date(${year}, ${monthIndex}, ${day}, 12, 0, 0, 0);
    const expiry = new Date(start);
    expiry.setDate(expiry.getDate() + 5);
    console.log(JSON.stringify({
      timeZone: ${JSON.stringify(timeZone)},
      start: start.toISOString(),
      expiry: expiry.toISOString(),
      elapsedHours: (expiry.getTime() - start.getTime()) / 36e5,
    }));
  `);
}

const roundTrips = [
  reproduceLegacyRoundTrip('UTC', '2026-09-17T12:00:00.000Z'),
  reproduceLegacyRoundTrip('Europe/Paris', '2026-09-17T12:00:00.000Z'),
  reproduceLegacyRoundTrip('Europe/Paris', '2026-01-17T12:00:00.000Z'),
  reproduceLegacyRoundTrip('America/New_York', '2026-09-17T12:00:00.000Z'),
].map((result) => ({
  ...result,
  mismatchReproduced: result.actualLocalMinute !== result.legacyDefaultValue,
}));

const calendarDays = [
  reproduceCalendarDays('Europe/Paris', 2026, 2, 27),
  reproduceCalendarDays('Europe/Paris', 2026, 9, 23),
];

const now = new Date('2026-09-17T12:00:00.000Z');
const futureElement = {
  lastChangedAt: '2026-10-17T12:00:00.000Z',
  expiresAt: '2026-10-22T12:00:00.000Z',
};
const remaining = (new Date(futureElement.expiresAt).getTime() - now.getTime()) / 36e5;
const futureStatus = !Number.isFinite(remaining) || remaining <= 0
  ? 'expired'
  : remaining <= 48
    ? 'warning'
    : 'ok';

const results = {
  schemaVersion: 1,
  sourceCommit: SOURCE_COMMIT,
  executedAt: new Date().toISOString(),
  nodeVersion: process.version,
  note: 'Characterization of inspected legacy expressions; this is evidence, not a regression test that preserves defects.',
  roundTrips,
  calendarDays,
  futureIntervention: {
    now: now.toISOString(),
    ...futureElement,
    legacyElementStatus: futureStatus,
    futureInterventionTreatedAsOk: futureStatus === 'ok',
  },
};

const reproduced = roundTrips[0].mismatchReproduced === false
  && roundTrips.slice(1).every((result) => result.mismatchReproduced)
  && calendarDays.map((result) => result.elapsedHours).join(',') === '119,121'
  && results.futureIntervention.futureInterventionTreatedAsOk;

console.log(JSON.stringify({ ...results, reproduced }, null, 2));
if (!reproduced) process.exitCode = 1;
