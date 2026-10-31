import {describe, expect, it} from 'vitest';
import {notificationQuietHoursActive} from './NotificationQuietHours';

describe('notificationQuietHoursActive', () => {
  it('is inactive when a boundary is missing or both boundaries are equal', () => {
    const noon = new Date('2026-10-31T17:00:00.000Z');
    expect(notificationQuietHoursActive(undefined, noon)).toBe(false);
    expect(notificationQuietHoursActive({quiet_start: '22:00', quiet_end: null}, noon)).toBe(false);
    expect(notificationQuietHoursActive({quiet_start: '08:00', quiet_end: '08:00'}, noon)).toBe(false);
  });

  it('includes the start and excludes the end of a same-day interval in Bogota time', () => {
    const hours = {quiet_start: '10:00', quiet_end: '15:00'};
    expect(notificationQuietHoursActive(hours, new Date('2026-10-31T15:00:00.000Z'))).toBe(true);
    expect(notificationQuietHoursActive(hours, new Date('2026-10-31T14:59:00.000Z'))).toBe(false);
    expect(notificationQuietHoursActive(hours, new Date('2026-10-31T20:00:00.000Z'))).toBe(false);
  });

  it('handles quiet periods that cross midnight', () => {
    const hours = {quiet_start: '22:00', quiet_end: '06:00'};
    expect(notificationQuietHoursActive(hours, new Date('2026-11-01T04:30:00.000Z'))).toBe(true);
    expect(notificationQuietHoursActive(hours, new Date('2026-11-01T11:00:00.000Z'))).toBe(false);
    expect(notificationQuietHoursActive(hours, new Date('2026-11-01T03:00:00.000Z'))).toBe(true);
  });
});
