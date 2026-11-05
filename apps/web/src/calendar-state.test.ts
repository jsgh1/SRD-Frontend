import {describe, expect, it} from 'vitest';
import {calendarState} from './calendar-state';

const start = Date.parse('2026-10-31T15:00:00.000Z');
const event = (overrides: Partial<Parameters<typeof calendarState>[0]> = {}) => ({
  starts_at: new Date(start).toISOString(),
  ends_at: new Date(start + 60 * 60_000).toISOString(),
  cancelled_at: null,
  state: 'scheduled' as const,
  ...overrides,
});

describe('calendarState', () => {
  it('keeps cancelled events cancelled', () => {
    expect(calendarState(event({cancelled_at: '2026-10-30T00:00:00.000Z'}), start)).toBe('cancelled');
    expect(calendarState(event({state: 'cancelled'}), start)).toBe('cancelled');
  });

  it('preserves the server state when dates are invalid', () => {
    expect(calendarState(event({starts_at: 'invalid'}), start)).toBe('scheduled');
  });

  it('marks the event finished at its end boundary', () => {
    expect(calendarState(event(), start + 60 * 60_000)).toBe('finished');
  });

  it('marks an event in progress from its start until its end', () => {
    expect(calendarState(event(), start)).toBe('in_progress');
    expect(calendarState(event(), start + 30 * 60_000)).toBe('in_progress');
  });

  it('marks events starting within 24 hours as upcoming', () => {
    expect(calendarState(event({starts_at: new Date(start + 23 * 60 * 60_000).toISOString()}), start)).toBe('upcoming');
    expect(calendarState(event({starts_at: new Date(start + 24 * 60 * 60_000).toISOString()}), start)).toBe('upcoming');
  });

  it('keeps events further away scheduled', () => {
    expect(calendarState(event({starts_at: new Date(start + 25 * 60 * 60_000).toISOString()}), start)).toBe('scheduled');
  });
});
