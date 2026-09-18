import { describe, expect, it } from 'vitest';
import { addCalendarDays, formatLocalMinute, instantMilliseconds, parseLocalMinute } from './time';

describe('T01: local minute / explicit-zone instant round trips', () => {
  it.each([
    ['UTC', '2026-09-17T12:00:00.000Z', '2026-09-17T12:00'],
    ['Europe/Paris', '2026-09-17T12:00:00.000Z', '2026-09-17T14:00'],
    ['Europe/Paris', '2026-01-17T13:00:00.000Z', '2026-01-17T14:00'],
    ['America/New_York', '2026-09-17T18:00:00.000Z', '2026-09-17T14:00'],
    ['America/New_York', '2026-01-17T19:00:00.000Z', '2026-01-17T14:00'],
    ['Asia/Kathmandu', '2026-09-17T08:15:00.000Z', '2026-09-17T14:00'],
    ['UTC', '0100-01-01T00:00:00.000Z', '0100-01-01T00:00'],
  ])('%s preserves %s', (timeZone, instant, local) => {
    expect(formatLocalMinute(new Date(instant), timeZone)).toBe(local);
    expect(parseLocalMinute(local, timeZone)).toEqual({ ok: true, instant, timeZone });
  });
  it('truncates only seconds, not an offset', () => {
    expect(formatLocalMinute(new Date('2026-09-17T12:00:59.999Z'), 'Europe/Paris')).toBe('2026-09-17T14:00');
    expect(formatLocalMinute(new Date('invalid'), 'UTC')).toBe('');
    expect(formatLocalMinute(new Date(), 'Not/A_Zone')).toBe('');
  });
});

describe('T02/T03: strict calendars and daylight-saving transitions', () => {
  it.each(['', '2026-02-30T12:00', '2025-02-29T12:00', '2026-13-01T12:00', '2026-01-00T12:00', '2026-01-01T24:00', '2026-01-01T12:60', '0000-01-01T00:00', '10000-01-01T00:00', '2026-01-01T12:00Z', '2026-01-01T12:00:30', ' 2026-01-01T12:00', '2026-1-1T12:00'])('rejects %s without normalizing', (value) => {
    expect(parseLocalMinute(value, 'UTC')).toMatchObject({ ok: false, code: 'invalid' });
  });
  it('accepts a real leap day and rejects invalid zones/choices', () => {
    expect(parseLocalMinute('2024-02-29T12:00', 'UTC').ok).toBe(true);
    expect(parseLocalMinute('2024-02-29T12:00', '+02:00')).toMatchObject({ ok: false, code: 'zone' });
    expect(parseLocalMinute('2024-02-29T12:00', 'Not/A_Zone')).toMatchObject({ ok: false, code: 'zone' });
    expect(parseLocalMinute('2024-02-29T12:00', 'UTC', 'guess')).toMatchObject({ ok: false, code: 'invalid' });
  });
  it.each([
    ['Europe/Paris', '2026-03-29T02:30'],
    ['America/New_York', '2026-03-08T02:30'],
    ['Australia/Lord_Howe', '2026-10-04T02:15'],
    ['Pacific/Apia', '2011-12-30T12:00'],
  ])('rejects a nonexistent time in %s', (zone, value) => {
    for (const occurrence of ['', 'earlier', 'later']) expect(parseLocalMinute(value, zone, occurrence)).toMatchObject({ ok: false, code: 'gap' });
  });
  it.each([
    ['Europe/Paris', '2026-10-25T02:30', '2026-10-25T00:30:00.000Z', '2026-10-25T01:30:00.000Z'],
    ['America/New_York', '2026-11-01T01:30', '2026-11-01T05:30:00.000Z', '2026-11-01T06:30:00.000Z'],
    ['Australia/Lord_Howe', '2026-04-05T01:45', '2026-04-04T14:45:00.000Z', '2026-04-04T15:15:00.000Z'],
  ])('requires a choice for repeated time in %s', (zone, value, earlier, later) => {
    const ambiguous = parseLocalMinute(value, zone);
    expect(ambiguous).toMatchObject({ ok: false, code: 'overlap' });
    if (!ambiguous.ok) expect(ambiguous.candidates.map((entry) => entry.instant)).toEqual([earlier, later]);
    expect(parseLocalMinute(value, zone, 'earlier')).toMatchObject({ ok: true, instant: earlier });
    expect(parseLocalMinute(value, zone, 'later')).toMatchObject({ ok: true, instant: later });
  });
  it.each(['not-a-date', '2026-02-30T12:00:00.000Z', '2026-01-01', '2026-01-01T12:00:00', '2026-01-01T12:00:60Z', '2026-01-01T24:00:00Z', '0000-01-01T00:00:00Z'])('rejects an invalid stored instant: %s', (value) => {
    expect(instantMilliseconds(value)).toBeNull();
  });
});

describe('T09: explicitly versioned calendar-day validity', () => {
  it.each([
    ['2026-03-24T11:00:00.000Z', '2026-03-29T10:00:00.000Z', 119],
    ['2026-10-20T10:00:00.000Z', '2026-10-25T11:00:00.000Z', 121],
  ])('uses real elapsed time for %s', (start, expected, elapsedHours) => {
    const end = addCalendarDays(start, 5, 'Europe/Paris');
    expect(end).toBe(expected);
    expect((Date.parse(end) - Date.parse(start)) / 36e5).toBe(elapsedHours);
  });
  it('names the compatible expiry-boundary policy instead of guessing the intervention', () => {
    expect(addCalendarDays('2026-03-24T01:30:00.000Z', 5, 'Europe/Paris')).toBe('2026-03-29T01:30:00.000Z');
    expect(addCalendarDays('2026-10-20T00:30:00.000Z', 5, 'Europe/Paris')).toBe('2026-10-25T00:30:00.000Z');
  });
  it('rejects unsafe duration and output ranges', () => {
    for (const days of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) expect(() => addCalendarDays('2026-01-01T00:00:00Z', days, 'UTC')).toThrow();
    expect(() => addCalendarDays('9999-12-31T00:00:00Z', 5, 'UTC')).toThrow();
  });
});
