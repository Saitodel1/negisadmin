import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import type { Server } from 'node:http';

process.env.VERCEL = '1';
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
process.env.SUPER_ADMIN_EMAIL = 'owner@test.local';
process.env.SUPER_ADMIN_PASSWORD = 'correct-password';
process.env.SESSION_SECRET = 'test-session-secret-with-enough-entropy';
process.env.LOGIN_MAX_FAILURES = '3';

let server: Server;
let baseUrl: string;

before(async () => {
  const { default: app } = await import('./index');
  server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test API did not bind to a TCP port');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('API rejects unknown origins before authentication', async () => {
  const response = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Origin: 'https://evil.example.com' }
  });

  assert.equal(response.status, 403);
});

test('API keeps allowed unauthenticated requests behind auth', async () => {
  const response = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Origin: 'https://admin.negis.online' }
  });

  assert.equal(response.status, 401);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://admin.negis.online');
});

test('CRM origin can verify impersonation only and cannot access protected Admin API', async () => {
  const verification = await fetch(`${baseUrl}/api/impersonation/verify`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Origin: 'https://crm.negis.online'
    },
    body: JSON.stringify({ token: 'invalid-test-token' })
  });

  assert.equal(verification.status, 401);
  assert.equal(verification.headers.get('access-control-allow-origin'), 'https://crm.negis.online');

  const protectedAdminApi = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Origin: 'https://crm.negis.online' }
  });
  assert.equal(protectedAdminApi.status, 403);
});

test('login endpoint blocks repeated invalid credentials', async () => {
  const statuses: number[] = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Origin: 'https://admin.negis.online',
        'x-forwarded-for': '198.51.100.15'
      },
      body: JSON.stringify({ email: 'blocked@test.local', password: 'wrong' })
    });
    statuses.push(response.status);
  }

  assert.deepEqual(statuses, [401, 401, 429]);
});

test('authenticated API returns 404 for an unknown organization and disables temporary passwords', async () => {
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Origin: 'https://admin.negis.online',
      'x-forwarded-for': '198.51.100.20'
    },
    body: JSON.stringify({ email: 'owner@test.local', password: 'correct-password' })
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie');
  assert.ok(cookie);

  const missingOrganization = await fetch(`${baseUrl}/api/clinics/missing`, {
    headers: { Cookie: cookie, Origin: 'https://admin.negis.online' }
  });
  assert.equal(missingOrganization.status, 404);

  const deprecatedReset = await fetch(`${baseUrl}/api/clinics/missing/reset-password`, {
    method: 'POST',
    headers: { Cookie: cookie, Origin: 'https://admin.negis.online' }
  });
  assert.equal(deprecatedReset.status, 410);
});
