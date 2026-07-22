import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAllowedOrigins, isOriginAllowed, LoginAttemptGuard } from './security';

test('production CORS accepts only configured admin origins', () => {
  const origins = buildAllowedOrigins('https://preview.example.com/', true);

  assert.equal(isOriginAllowed('https://admin.negis.online', origins), true);
  assert.equal(isOriginAllowed('https://preview.example.com', origins), true);
  assert.equal(isOriginAllowed('https://evil.example.com', origins), false);
  assert.equal(isOriginAllowed(undefined, origins), true);
});

test('login guard blocks repeated failures and can be cleared', () => {
  const guard = new LoginAttemptGuard(3, 60_000, 120_000);
  const key = '127.0.0.1:admin@example.com';

  assert.equal(guard.registerFailure(key, 1_000).allowed, true);
  assert.equal(guard.registerFailure(key, 2_000).allowed, true);
  const blocked = guard.registerFailure(key, 3_000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 120);
  assert.equal(guard.check(key, 4_000).allowed, false);

  guard.clear(key);
  assert.equal(guard.check(key, 4_000).allowed, true);
});

test('login guard resets failures after the attempt window', () => {
  const guard = new LoginAttemptGuard(2, 10_000, 60_000);
  guard.registerFailure('user', 1_000);

  assert.equal(guard.registerFailure('user', 12_000).allowed, true);
});

