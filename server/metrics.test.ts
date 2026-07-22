import assert from 'node:assert/strict';
import test from 'node:test';
import { getTimeZoneDayRange } from './metrics';

test('day range uses the configured business timezone', () => {
  const range = getTimeZoneDayRange(new Date('2026-07-22T10:00:00.000Z'), 'Asia/Almaty');

  assert.equal(range.localDate, '2026-07-22');
  assert.equal(range.start.toISOString(), '2026-07-21T19:00:00.000Z');
  assert.equal(range.end.toISOString(), '2026-07-22T19:00:00.000Z');
});

