import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

async function main() {
  if (process.env.ALLOW_LIVE_DELETION_TEST !== '1') {
    throw new Error('Live deletion test disabled. Set ALLOW_LIVE_DELETION_TEST=1 explicitly.');
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const adminEmail = process.env.SUPER_ADMIN_EMAIL?.trim();
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (!supabaseUrl || !serviceRoleKey || !adminEmail || !adminPassword) {
    throw new Error('Supabase and Super Admin environment variables are required.');
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const suffix = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const clinicId = crypto.randomUUID();
  const leadStatusId = crypto.randomUUID();
  const clinicName = `Codex deletion test ${suffix}`;
  const ownerEmail = `codex-delete-${suffix}@example.com`;
  const configuredApiUrl = process.env.ADMIN_API_URL?.trim().replace(/\/$/, '');
  let ownerUserId = '';
  let server: import('node:http').Server | null = null;

  try {
    const { data: createdUser, error: createUserError } = await client.auth.admin.createUser({
      email: ownerEmail,
      password: `Tmp-${crypto.randomBytes(12).toString('base64url')}!`,
      email_confirm: true
    });
    if (createUserError || !createdUser.user) throw createUserError || new Error('Test auth user was not created');
    ownerUserId = createdUser.user.id;

    const { error: clinicError } = await client.from('clinics').insert({
      id: clinicId,
      name: clinicName,
      slug: `codex-delete-${suffix}`,
      owner_id: ownerUserId,
      country: 'KG',
      currency: 'KGS',
      status: 'active'
    });
    if (clinicError) throw clinicError;

    const { error: leadStatusError } = await client.from('lead_statuses').insert({
      id: leadStatusId,
      clinic_id: clinicId,
      name: 'Deletion Test Status',
      color: '#64748B',
      is_default: true
    });
    if (leadStatusError) throw leadStatusError;

    const { error: leadError } = await client.from('leads').insert({
      clinic_id: clinicId,
      full_name: 'Deletion Test Lead',
      phone: '+996000000000',
      source: 'deletion-test',
      status_id: leadStatusId
    });
    if (leadError) throw leadError;

    let baseUrl = configuredApiUrl;
    if (!baseUrl) {
      process.env.VERCEL = '1';
      process.env.NODE_ENV = 'test';
      const { default: app } = await import('../server/index');
      server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
      });
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Test Admin API did not bind to a TCP port');
      baseUrl = `http://127.0.0.1:${address.port}`;
    }

    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Origin: 'https://admin.negis.online' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword })
    });
    if (!login.ok) throw new Error(`Test Admin login failed: HTTP ${login.status}`);
    const cookie = login.headers.get('set-cookie');
    if (!cookie) throw new Error('Test Admin login did not return a session cookie');

    const deletion = await fetch(`${baseUrl}/api/clinics/${clinicId}`, {
      method: 'DELETE',
      headers: {
        'content-type': 'application/json',
        Cookie: cookie,
        Origin: 'https://admin.negis.online'
      },
      body: JSON.stringify({ confirmation: clinicName })
    });
    const deletionResult = await deletion.json() as Record<string, unknown>;
    if (!deletion.ok) throw new Error(`Deletion endpoint failed: ${JSON.stringify(deletionResult)}`);

    const [{ count: clinicsLeft }, { count: leadsLeft }, authLookup] = await Promise.all([
      client.from('clinics').select('*', { count: 'exact', head: true }).eq('id', clinicId),
      client.from('leads').select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId),
      client.auth.admin.getUserById(ownerUserId)
    ]);
    const authUserStillExists = Boolean(authLookup.data.user);
    if (clinicsLeft || leadsLeft || authUserStillExists) {
      throw new Error(`Deletion verification failed: clinics=${clinicsLeft}, leads=${leadsLeft}, auth=${authUserStillExists}`);
    }

    console.log(JSON.stringify({
      ok: true,
      clinicDeleted: true,
      childDataDeleted: true,
      ownerAuthDeleted: deletionResult.ownerAuthDeleted === true,
      emailReusable: true,
      target: configuredApiUrl ? 'production' : 'local',
      deletedTables: deletionResult.deletedTables,
      deletedRows: deletionResult.deletedRows
    }));
  } finally {
    if (server) await new Promise<void>((resolve) => server?.close(() => resolve()));
    await client.from('leads').delete().eq('clinic_id', clinicId);
    await client.from('lead_statuses').delete().eq('clinic_id', clinicId);
    await client.from('clinics').delete().eq('id', clinicId);
    if (ownerUserId) await client.auth.admin.deleteUser(ownerUserId, false);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
