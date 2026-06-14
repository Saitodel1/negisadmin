import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

dotenv.config();

const PORT = Number(process.env.PORT || 8787);
const SESSION_COOKIE = 'negis_control_session';
const SESSION_TTL_SECONDS = 60 * 60;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-change-me';
const CRM_APP_URL = 'https://crm.negis.online/';
const MAIN_NEGIS_APP_URL = normalizeCrmUrl(process.env.MAIN_NEGIS_APP_URL || CRM_APP_URL);
const TEAM_INVITE_FROM_EMAIL = process.env.TEAM_INVITE_FROM_EMAIL || 'negissupport@negis.online';

function normalizeCrmUrl(rawUrl: string) {
  const url = new URL(rawUrl || CRM_APP_URL);
  if (url.hostname === 'negis.online' || url.hostname === 'www.negis.online') {
    url.hostname = 'crm.negis.online';
  }
  return url.toString();
}

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

type SessionPayload = {
  email: string;
  role: 'super_admin';
};

type Clinic = {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  plan: string;
  status: string;
  agentsCount: number;
  leadsCount: number;
  bookingsCount: number;
  lastActivity: string;
  createdAt: string;
  revenue: number;
};

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  invitedAt: string;
  invitedBy: string;
};

type Plan = {
  name: string;
  price: number;
  limits: string;
};

const now = new Date();
const iso = (offsetDays = 0) => new Date(now.getTime() + offsetDays * 86400000).toISOString();

const sourceStats: Array<{ name: string; value: number }> = [];

const defaultPlans: Plan[] = [
  { name: 'Basic', price: 29000, limits: '3 агента, базовая аналитика' },
  { name: 'Pro', price: 59000, limits: '10 агентов, воронка, экспорт' },
  { name: 'Max', price: 99000, limits: 'Безлимит, realtime, приоритет' }
];

const dataDir = process.env.VERCEL ? path.join('/tmp', 'negis-control') : path.join(process.cwd(), 'server', '.data');
const plansFile = path.join(dataDir, 'plans.json');
const bundledPlansFile = path.join(process.cwd(), 'server', '.data', 'plans.json');

const registrationStats: Array<{ date: string; count: number }> = [];

function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key.includes('rotate-and-place')) return null;
  return createClient(url.trim(), key.trim(), {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function signSession(email: string) {
  return jwt.sign({ email, role: 'super_admin' } satisfies SessionPayload, SESSION_SECRET, {
    expiresIn: SESSION_TTL_SECONDS
  });
}

function readSession(req: Request): SessionPayload | null {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  try {
    return jwt.verify(token, SESSION_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = readSession(req);
  if (!session) {
    res.status(401).json({ error: 'Доступ запрещён' });
    return;
  }
  res.locals.session = session;
  next();
}

function getRequestIp(req: Request) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const firstForwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(',')[0];
  return (firstForwardedIp || req.ip || '').trim();
}

async function tableCount(client: SupabaseClient, table: string) {
  const { count, error } = await client.from(table).select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

async function safeTableCount(client: SupabaseClient, table: string) {
  try {
    return await tableCount(client, table);
  } catch {
    return 0;
  }
}

async function safeClinicCount(client: SupabaseClient, table: string, clinicId: string) {
  const possibleClinicColumns = ['clinic_id', 'clinicId', 'clinic', 'organization_id'];
  for (const column of possibleClinicColumns) {
    const { count, error } = await client.from(table).select('*', { count: 'exact', head: true }).eq(column, clinicId);
    if (!error) return count || 0;
  }
  return 0;
}

function pickText(row: Record<string, unknown>, keys: string[], fallback: string) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return fallback;
}

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%';
  return Array.from({ length: 14 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
}

async function findAuthUserIdByEmail(client: SupabaseClient, email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    const user = data.users.find((item) => item.email?.trim().toLowerCase() === normalizedEmail);
    if (user) return user.id;
    if (data.users.length < 1000) break;
  }

  return null;
}

async function loadAuthUsersById(client: SupabaseClient) {
  const users = new Map<string, { id: string; email: string }>();

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    data.users.forEach((user) => {
      if (user.email) users.set(user.id, { id: user.id, email: user.email });
    });
    if (data.users.length < 1000) break;
  }

  return users;
}

async function readPlans(): Promise<Plan[]> {
  try {
    const raw = await fs.readFile(plansFile, 'utf8');
    const plans = JSON.parse(raw) as Plan[];
    if (Array.isArray(plans) && plans.length) return plans;
  } catch {
    // First run or serverless cold start: try bundled seed file, then defaults.
  }
  try {
    const raw = await fs.readFile(bundledPlansFile, 'utf8');
    const plans = JSON.parse(raw) as Plan[];
    if (Array.isArray(plans) && plans.length) return plans;
  } catch {
    // Production should persist plan edits in Supabase; local file is only a fallback.
  }
  return defaultPlans;
}

async function writePlans(plans: Plan[]) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(plansFile, JSON.stringify(plans, null, 2), 'utf8');
}

async function tryUpdatePlanInSupabase(client: SupabaseClient | null, plan: Plan) {
  if (!client) return;
  const possibleTables = ['plans', 'subscription_plans', 'tariffs'];
  for (const table of possibleTables) {
    const { error } = await client
      .from(table)
      .upsert({ name: plan.name, price: plan.price, limits: plan.limits }, { onConflict: 'name' });
    if (!error) return;
  }
}

async function loadClinics(client: SupabaseClient | null): Promise<Clinic[]> {
  if (!client) return [];

  const { data, error } = await client
    .from('clinics')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !data) return [];

  const authUsersById = await loadAuthUsersById(client).catch(() => new Map<string, { id: string; email: string }>());

  return Promise.all(
    data.map(async (clinic: Record<string, unknown>) => {
      const id = String(clinic.id);
      const ownerId = String(clinic.owner_id || clinic.ownerId || clinic.user_id || clinic.userId || '');
      const ownerEmail = authUsersById.get(ownerId)?.email;
      const [agents, leads, bookings] = await Promise.all([
        safeClinicCount(client, 'agents', id),
        safeClinicCount(client, 'leads', id),
        safeClinicCount(client, 'bookings', id)
      ]);

      return {
        id,
        name: pickText(clinic, ['name', 'clinic_name', 'title', 'company_name'], 'Клиника без названия'),
        ownerName: pickText(clinic, ['owner_name', 'ownerName', 'admin_name', 'contact_name'], 'Владелец'),
        ownerEmail: pickText(clinic, ['owner_email', 'ownerEmail', 'email', 'admin_email'], ownerEmail || 'email не указан'),
        plan: pickText(clinic, ['plan', 'tariff', 'subscription_plan'], 'Basic'),
        status: pickText(clinic, ['status', 'state'], 'active'),
        agentsCount: agents,
        leadsCount: leads,
        bookingsCount: bookings,
        lastActivity: String(clinic.updated_at || clinic.created_at || new Date().toISOString()),
        createdAt: String(clinic.created_at || new Date().toISOString()),
        revenue: 0
      };
    })
  );
}

async function findClinicById(client: SupabaseClient | null, clinicId: string) {
  const clinics = await loadClinics(client);
  return clinics.find((item) => item.id === clinicId) || null;
}

async function writeSuperLog(
  client: SupabaseClient | null,
  action: string,
  details: Record<string, unknown>,
  targetClinicId?: string | null,
  targetUserId?: string | null,
  ipAddress?: string | null
) {
  if (!client) return;
  await client
    .from('super_logs')
    .insert({
      action,
      target_clinic_id: targetClinicId || null,
      target_user_id: targetUserId || null,
      details,
      ip_address: ipAddress || null
    })
    .then(() => undefined, () => undefined);
}

function mapTeamMember(row: Record<string, any>): TeamMember {
  const email = String(row.email || '').trim();
  return {
    id: String(row.id || email),
    name: String(row.name || email.split('@')[0] || 'Team member'),
    email,
    role: String(row.role || 'Support'),
    status: String(row.status || 'invited'),
    invitedAt: String(row.invited_at || row.created_at || new Date().toISOString()),
    invitedBy: String(row.invited_by || '')
  };
}

function ownerTeamMember(): TeamMember {
  const email = process.env.SUPER_ADMIN_EMAIL || TEAM_INVITE_FROM_EMAIL;
  return {
    id: 'owner',
    name: 'Negis Owner',
    email,
    role: 'Owner',
    status: 'active',
    invitedAt: new Date().toISOString(),
    invitedBy: 'system'
  };
}

async function loadTeamMembers(client: SupabaseClient | null): Promise<TeamMember[]> {
  const owner = ownerTeamMember();
  if (!client) return [owner];

  const { data, error } = await client.from('super_team_members').select('*').order('created_at', { ascending: true });
  if (error) {
    throw new Error('Таблица команды еще не создана в Supabase. Выполните SQL из файла supabase/2026-06-14_create_super_team_members.sql.');
  }

  const members = (data || []).map((row) => mapTeamMember(row as Record<string, any>));
  const hasOwner = members.some((member) => member.email.toLowerCase() === owner.email.toLowerCase());
  return hasOwner ? members : [owner, ...members];
}

function getSmtpTransport() {
  const host = process.env.SMTP_HOST || 'smtp.zoho.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER || TEAM_INVITE_FROM_EMAIL;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    throw new Error('SMTP не настроен. Добавьте в Vercel Secrets: SMTP_HOST=smtp.zoho.com, SMTP_PORT=465, SMTP_USER=negissupport@negis.online, SMTP_PASS=пароль_приложения_Zoho.');
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

async function sendTeamInviteEmail(email: string, role: string, invitedBy: string, origin: string) {
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || TEAM_INVITE_FROM_EMAIL;
  const fromName = process.env.SMTP_FROM_NAME || 'Negis Control';
  const acceptUrl = `${origin.replace(/\/$/, '')}/`;
  const transporter = getSmtpTransport();
  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: email,
    replyTo: TEAM_INVITE_FROM_EMAIL,
    subject: 'Приглашение в команду Negis Control',
    text: [
      'Здравствуйте!',
      '',
      `${invitedBy} пригласил вас в команду Negis Control с ролью: ${role}.`,
      `Откройте админку: ${acceptUrl}`,
      '',
      'Если вы не ожидали это письмо, просто проигнорируйте его.',
      '',
      'Negis Control'
    ].join('\n'),
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h2>Приглашение в Negis Control</h2>
        <p><b>${invitedBy}</b> пригласил вас в команду Negis Control.</p>
        <p>Роль: <b>${role}</b></p>
        <p><a href="${acceptUrl}" style="display:inline-block;background:#0D9488;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">Открыть админку</a></p>
        <p style="color:#64748b">Если вы не ожидали это письмо, просто проигнорируйте его.</p>
      </div>
    `
  });
}

async function updateClinicStatus(client: SupabaseClient, clinicId: string, status: string) {
  const { error } = await client.from('clinics').update({ status }).eq('id', clinicId);
  if (error) throw error;
}

async function createInvoice(client: SupabaseClient, clinic: Clinic, amount: number, plan: string, issuedBy?: string) {
  const dueAt = iso(7);
  const fullPayload = {
    clinic_id: clinic.id,
    clinic_name: clinic.name,
    plan,
    amount,
    method: 'invoice',
    status: 'pending',
    details: { issuedBy, dueAt }
  };
  const basicPayload = {
    clinic_id: clinic.id,
    plan,
    amount,
    method: 'invoice',
    status: 'pending'
  };

  const first = await client.from('payments').insert(fullPayload).select('*').single();
  if (!first.error) return first.data;

  const second = await client.from('payments').insert(basicPayload).select('*').single();
  if (second.error) throw second.error;
  return second.data;
}

async function deleteClinicCascade(client: SupabaseClient, clinicId: string) {
  const relatedTables = [
    'bookings',
    'leads',
    'services',
    'agents',
    'roles',
    'lead_statuses',
    'booking_statuses',
    'subscriptions',
    'payments',
    'shifts',
    'user_roles'
  ];

  for (const table of relatedTables) {
    await client
      .from(table)
      .delete()
      .eq('clinic_id', clinicId)
      .then(() => undefined, () => undefined);
  }

  const { error } = await client.from('clinics').delete().eq('id', clinicId);
  if (error) throw error;
}

async function getOverview() {
  const client = getSupabase();
  const clinics = await loadClinics(client);

  if (!client) {
    return {
      mode: 'live',
      metrics: {
        totalClinics: clinics.length,
        activeToday: 0,
        newClinics7d: 0,
        totalLeads: 0,
        bookingsToday: 0,
        revenueMonth: 0
      },
      clinics,
      sourceStats: [],
      registrationStats: []
    };
  }

  const [totalLeads, totalBookings] = await Promise.all([
    safeTableCount(client, 'leads'),
    safeTableCount(client, 'bookings')
  ]);

  return {
    mode: 'live',
    metrics: {
      totalClinics: clinics.length,
      activeToday: clinics.filter((clinic) => Date.now() - new Date(clinic.lastActivity).getTime() < 86400000).length,
      newClinics7d: clinics.filter((clinic) => Date.now() - new Date(clinic.createdAt).getTime() < 7 * 86400000).length,
      totalLeads,
      bookingsToday: totalBookings,
      revenueMonth: clinics.reduce((sum, clinic) => sum + clinic.revenue, 0)
    },
    clinics,
    sourceStats: [],
    registrationStats: []
  };
}

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const expectedEmail = process.env.SUPER_ADMIN_EMAIL || (process.env.NODE_ENV === 'production' ? undefined : 'admin@negis.local');
  const expectedPassword = process.env.SUPER_ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? undefined : 'admin123');

  if (!expectedEmail || !expectedPassword) {
    res.status(500).json({ error: 'SUPER_ADMIN_EMAIL и SUPER_ADMIN_PASSWORD не настроены' });
    return;
  }

  if (String(email).trim().toLowerCase() !== expectedEmail.trim().toLowerCase() || password !== expectedPassword) {
    res.status(401).json({ error: 'Доступ запрещён' });
    return;
  }

  res.cookie(SESSION_COOKIE, signSession(expectedEmail), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_SECONDS * 1000
  });

  await writeSuperLog(getSupabase(), 'super_admin_login', { email: expectedEmail }, null, null, getRequestIp(req));
  res.json({ email: expectedEmail, role: 'super_admin' });
});

app.post('/api/auth/logout', async (req, res) => {
  const session = readSession(req);
  if (session) {
    await writeSuperLog(getSupabase(), 'super_admin_logout', { email: session.email }, null, null, getRequestIp(req));
  }
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const session = readSession(req);
  if (!session) {
    res.status(401).json({ error: 'Доступ запрещён' });
    return;
  }
  res.json(session);
});

app.get('/api/overview', requireAuth, async (_req, res) => {
  res.json(await getOverview());
});

app.get('/api/clinics', requireAuth, async (_req, res) => {
  res.json({ clinics: await loadClinics(getSupabase()) });
});

app.get('/api/clinics/:id', requireAuth, async (req, res) => {
  const clinics = await loadClinics(getSupabase());
  const clinic = clinics.find((item) => item.id === req.params.id) || clinics[0];
  res.json({
    clinic,
    agents: [],
    funnel: [
      { name: 'Лидов пришло', value: clinic?.leadsCount || 0 },
      { name: 'Записалось', value: clinic?.bookingsCount || 0 },
      { name: 'Пришли', value: 0 },
      { name: 'Потери', value: 0 }
    ]
  });
});

app.get('/api/users', requireAuth, async (_req, res) => {
  const clinics = await loadClinics(getSupabase());
  res.json({
    users: clinics.map((clinic) => ({
      id: `owner-${clinic.id}`,
      clinicId: clinic.id,
      name: clinic.ownerName,
      email: clinic.ownerEmail,
      clinic: clinic.name,
      plan: clinic.plan,
      createdAt: clinic.createdAt,
      lastLogin: clinic.lastActivity,
      kyc: clinic.status === 'blocked' ? 'rejected' : 'verified'
    }))
  });
});

app.get('/api/subscriptions', requireAuth, async (_req, res) => {
  const client = getSupabase();
  const clinics = await loadClinics(client);
  const plans = await readPlans();
  let subscriptions: Array<Record<string, unknown>> = [];

  if (client) {
    const { data } = await client.from('subscriptions').select('*').order('created_at', { ascending: false });
    subscriptions = data || [];
  }

  res.json({
    subscriptions: subscriptions.map((subscription, index) => {
      const clinicId = String(subscription.clinic_id || subscription.clinicId || subscription.clinic || '');
      const clinic = clinics.find((item) => item.id === clinicId);
      const plan = String(subscription.plan || subscription.tariff || clinic?.plan || 'Basic');
      return {
        id: String(subscription.id || `sub-${index}`),
        clinicId,
        clinic: clinic?.name || String(subscription.clinic_name || subscription.clinic || '???????'),
        plan,
        startsAt: String(subscription.starts_at || subscription.start_date || subscription.created_at || ''),
        endsAt: String(subscription.ends_at || subscription.end_date || subscription.expires_at || ''),
        amount: Number(subscription.amount || subscription.price || plans.find((item) => item.name === plan)?.price || 0),
        status: String(subscription.status || 'active')
      };
    }),
    plans
  });
});

app.patch('/api/plans/:name', requireAuth, async (req, res) => {
  const name = String(req.params.name);
  const price = Number(req.body?.price);
  const limits = String(req.body?.limits || '').trim();

  if (!Number.isFinite(price) || price < 0 || !limits) {
    res.status(400).json({ error: 'Укажите корректную цену и лимиты' });
    return;
  }

  const plans = await readPlans();
  const index = plans.findIndex((plan) => plan.name.toLowerCase() === name.toLowerCase());
  if (index === -1) {
    res.status(404).json({ error: 'Тариф не найден' });
    return;
  }

  const updatedPlan = { ...plans[index], price, limits };
  plans[index] = updatedPlan;
  await writePlans(plans);
  const client = getSupabase();
  await tryUpdatePlanInSupabase(client, updatedPlan);
  await writeSuperLog(
    client,
    'plan_updated',
    { plan: updatedPlan.name, price, limits, updatedBy: res.locals.session?.email },
    null,
    null,
    getRequestIp(req)
  );

  res.json({ plan: updatedPlan, plans });
});

app.post('/api/clinics/:id/impersonate', requireAuth, async (req, res) => {
  const client = getSupabase();
  const clinics = await loadClinics(client);
  const clinic = clinics.find((item) => item.id === req.params.id);
  if (!clinic) {
    res.status(404).json({ error: '??????? ?? ???????' });
    return;
  }

  const token = jwt.sign(
    {
      type: 'negis_impersonation',
      clinicId: clinic.id,
      clinicName: clinic.name,
      ownerEmail: clinic.ownerEmail,
      issuedBy: res.locals.session?.email
    },
    SESSION_SECRET,
    { expiresIn: '30m' }
  );

  const url = new URL(MAIN_NEGIS_APP_URL);
  url.searchParams.set('impersonate_token', token);
  url.searchParams.set('clinic_id', clinic.id);
  url.searchParams.set('impersonate_at', String(Date.now()));
  await writeSuperLog(
    client,
    'clinic_impersonation_started',
    { clinicName: clinic.name, issuedBy: res.locals.session?.email },
    clinic.id,
    null,
    getRequestIp(req)
  );
  res.json({ url: url.toString(), token, clinic });
});

app.post('/api/clinics/:id/reset-password', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) {
    res.status(500).json({ error: 'Supabase service role не настроен' });
    return;
  }

  const clinics = await loadClinics(client);
  const clinic = clinics.find((item) => item.id === req.params.id);
  if (!clinic) {
    res.status(404).json({ error: 'Клиника не найдена' });
    return;
  }

  const login = clinic.ownerEmail.trim();
  if (!login || login === 'email не указан' || !login.includes('@')) {
    res.status(400).json({ error: 'У клиники не указан email администратора' });
    return;
  }

  const userId = await findAuthUserIdByEmail(client, login);
  if (!userId) {
    res.status(404).json({ error: 'Пользователь с таким email не найден в Supabase Auth' });
    return;
  }

  const temporaryPassword = generateTemporaryPassword();
  const { error } = await client.auth.admin.updateUserById(userId, { password: temporaryPassword });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await client.from('super_logs').insert({
    action: 'clinic_password_reset',
    target_clinic_id: clinic.id,
    target_user_id: userId,
    details: { login, resetBy: res.locals.session?.email },
    ip_address: getRequestIp(req)
  });

  res.json({ login, temporaryPassword, clinicId: clinic.id, clinicName: clinic.name });
});

app.post('/api/impersonation/verify', (req, res) => {
  const token = String(req.body?.token || '');
  if (!token) {
    res.status(400).json({ error: 'Токен не передан' });
    return;
  }

  try {
    const payload = jwt.verify(token, SESSION_SECRET) as {
      type?: string;
      clinicId?: string;
      clinicName?: string;
      ownerEmail?: string;
      issuedBy?: string;
    };

    if (payload.type !== 'negis_impersonation' || !payload.clinicId) {
      res.status(401).json({ error: 'Некорректный токен' });
      return;
    }

    res.json({
      clinicId: payload.clinicId,
      clinicName: payload.clinicName,
      ownerEmail: payload.ownerEmail,
      issuedBy: payload.issuedBy
    });
  } catch {
    res.status(401).json({ error: 'Токен истёк или недействителен' });
  }
});

app.patch('/api/clinics/:id/status', requireAuth, async (req, res) => {
  const status = String(req.body?.status || '').trim();
  if (!['active', 'blocked', 'trial', 'expired'].includes(status)) {
    res.status(400).json({ error: 'Некорректный статус клиники' });
    return;
  }

  const client = getSupabase();
  if (client) {
    await client.from('clinics').update({ status }).eq('id', req.params.id);
    await writeSuperLog(
      client,
      'clinic_status_updated',
      { status, updatedBy: res.locals.session?.email },
      String(req.params.id),
      null,
      getRequestIp(req)
    );
  }

  res.json({ id: req.params.id, status });
});

app.post('/api/clinics/:id/trial', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) {
    res.status(500).json({ error: 'Supabase service role не настроен' });
    return;
  }

  const clinic = await findClinicById(client, String(req.params.id));
  if (!clinic) {
    res.status(404).json({ error: 'Клиника не найдена' });
    return;
  }

  const days = Math.max(1, Math.min(90, Number(req.body?.days || 14)));
  const trialEndsAt = iso(days);

  try {
    await updateClinicStatus(client, clinic.id, 'trial');
    await client
      .from('subscriptions')
      .insert({
        clinic_id: clinic.id,
        clinic_name: clinic.name,
        plan: clinic.plan || 'Trial',
        amount: 0,
        status: 'trial',
        starts_at: new Date().toISOString(),
        ends_at: trialEndsAt
      })
      .then(() => undefined, () => undefined);
    await writeSuperLog(client, 'clinic_trial_opened', { days, trialEndsAt, openedBy: res.locals.session?.email }, clinic.id, null, getRequestIp(req));
    res.json({ id: clinic.id, status: 'trial', trialEndsAt });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Не удалось открыть пробный период' });
  }
});

app.post('/api/clinics/:id/invoice', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) {
    res.status(500).json({ error: 'Supabase service role не настроен' });
    return;
  }

  const clinic = await findClinicById(client, String(req.params.id));
  if (!clinic) {
    res.status(404).json({ error: 'Клиника не найдена' });
    return;
  }

  const amount = Number(req.body?.amount);
  const plan = String(req.body?.plan || clinic.plan || 'Basic').trim();
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: 'Укажите сумму счёта больше 0' });
    return;
  }

  try {
    const invoice = await createInvoice(client, clinic, Math.round(amount), plan, res.locals.session?.email);
    await writeSuperLog(client, 'clinic_invoice_created', { amount: Math.round(amount), plan, issuedBy: res.locals.session?.email }, clinic.id, null, getRequestIp(req));
    res.json({ invoice, clinicId: clinic.id, clinicName: clinic.name });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Не удалось выставить счёт' });
  }
});

app.delete('/api/clinics/:id', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) {
    res.status(500).json({ error: 'Supabase service role не настроен' });
    return;
  }

  const clinic = await findClinicById(client, String(req.params.id));
  if (!clinic) {
    res.status(404).json({ error: 'Клиника не найдена' });
    return;
  }

  const confirmation = String(req.body?.confirmation || '').trim();
  if (confirmation !== clinic.name) {
    res.status(400).json({ error: 'Для удаления введите точное название клиники' });
    return;
  }

  try {
    await deleteClinicCascade(client, clinic.id);
    await writeSuperLog(client, 'clinic_deleted', { clinicId: clinic.id, clinicName: clinic.name, deletedBy: res.locals.session?.email }, null, null, getRequestIp(req));
    res.json({ id: clinic.id, deleted: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Не удалось удалить клинику' });
  }
});

app.get('/api/finances', requireAuth, async (_req, res) => {
  const client = getSupabase();
  const clinics = await loadClinics(client);
  let payments: Array<Record<string, unknown>> = [];

  if (client) {
    const { data } = await client.from('payments').select('*').order('created_at', { ascending: false });
    payments = data || [];
  }

  const mappedPayments = payments.map((payment, index) => {
    const clinicId = String(payment.clinic_id || payment.clinicId || payment.clinic || '');
    const clinic = clinics.find((item) => item.id === clinicId);
    return {
      id: String(payment.id || `pay-${index}`),
      clinicId,
      clinic: clinic?.name || String(payment.clinic_name || payment.clinic || '???????'),
      plan: String(payment.plan || payment.tariff || ''),
      amount: Number(payment.amount || payment.price || 0),
      method: String(payment.method || payment.payment_method || ''),
      createdAt: String(payment.created_at || ''),
      status: String(payment.status || '')
    };
  });

  res.json({
    revenueMonth: mappedPayments.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + payment.amount, 0),
    revenuePrevious: 0,
    forecast: 0,
    byMonth: [],
    byPlan: [],
    payments: mappedPayments
  });
});

app.get('/api/logs', requireAuth, async (_req, res) => {
  const client = getSupabase();
  if (!client) {
    res.status(500).json({ error: 'Supabase service role не настроен. Проверьте SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в Vercel.' });
    return;
  }

  const { data, error } = await client.from('super_logs').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) {
    res.status(500).json({
      error: `Не удалось загрузить super_logs: ${error.message}. Проверьте, что таблица super_logs создана в Supabase.`
    });
    return;
  }

  res.json({
    logs: (data || []).map((log: Record<string, unknown>) => ({
      id: String(log.id),
      time: String(log.created_at || ''),
      clinic: String(log.target_clinic_id || ''),
      user: String(log.target_user_id || ''),
      action: String(log.action || ''),
      details: typeof log.details === 'string' ? log.details : JSON.stringify(log.details || {}),
      ip: String(log.ip_address || '')
    }))
  });
});

app.get('/api/team', requireAuth, async (_req, res) => {
  try {
    const members = await loadTeamMembers(getSupabase());
    res.json({ members });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Не удалось загрузить команду' });
  }
});

app.post('/api/team/invite', requireAuth, async (req, res) => {
  const client = getSupabase();
  if (!client) {
    res.status(500).json({ error: 'Supabase не настроен. Команду нельзя сохранять без базы.' });
    return;
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  const role = String(req.body?.role || '').trim();
  const name = String(req.body?.name || email.split('@')[0] || 'Team member').trim();
  const allowedRoles = new Set(['Owner', 'Admin', 'Support', 'Finance', 'Developer', 'Read-only']);

  if (!email || !email.includes('@')) {
    res.status(400).json({ error: 'Укажите корректный email' });
    return;
  }

  if (!allowedRoles.has(role)) {
    res.status(400).json({ error: 'Некорректная роль команды' });
    return;
  }

  const invitedBy = res.locals.session?.email || process.env.SUPER_ADMIN_EMAIL || TEAM_INVITE_FROM_EMAIL;
  const payload = {
    email,
    name,
    role,
    status: 'invited',
    invited_by: invitedBy,
    invited_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await client
    .from('super_team_members')
    .upsert(payload, { onConflict: 'email' })
    .select('*')
    .single();

  if (error) {
    res.status(500).json({ error: 'Не удалось сохранить участника команды: таблица super_team_members еще не создана в Supabase. Выполните SQL из файла supabase/2026-06-14_create_super_team_members.sql.' });
    return;
  }

  try {
    const protocol = String(req.headers['x-forwarded-proto'] || req.protocol).split(',')[0];
    const origin = `${protocol}://${req.get('host')}`;
    await sendTeamInviteEmail(email, role, invitedBy, origin);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Участник сохранен, но письмо не отправлено' });
    return;
  }

  await writeSuperLog(client, 'team_member_invited', { email, role, invitedBy }, null, null, getRequestIp(req));
  res.json({ member: mapTeamMember(data as Record<string, any>) });
});

app.get('/api/admin/app/dashboard', requireAuth, (_req, res) => {
  res.json({
    metrics: {
      totalClients: 0,
      active24h: 0,
      active7d: 0,
      appAppointments: 0,
      qrArrivals: 0,
      bonusesEarned: 0,
      bonusesSpent: 0,
      activePromotions: 0,
      completedTasks: 0,
      loyaltyBusinesses: 0
    },
    clientRegistrations: [],
    appointmentStats: [],
    bonusStats: [],
    promotionStats: []
  });
});

app.get('/api/admin/app/clients', requireAuth, (_req, res) => {
  res.json({ clients: [] });
});

app.get('/api/admin/app/clients/:id', requireAuth, (req, res) => {
  res.status(404).json({ error: `App client ${req.params.id} is not connected yet` });
});

app.patch('/api/admin/app/clients/:id', requireAuth, (_req, res) => {
  res.status(501).json({ error: 'App client updates require the Negis App API module' });
});

app.post('/api/admin/app/clients/:id/block', requireAuth, (_req, res) => {
  res.status(501).json({ error: 'App client blocking requires the Negis App API module' });
});

app.post('/api/admin/app/clients/:id/unblock', requireAuth, (_req, res) => {
  res.status(501).json({ error: 'App client unblocking requires the Negis App API module' });
});

app.post('/api/admin/app/clients/:id/bonus-adjustment', requireAuth, (_req, res) => {
  res.status(501).json({ error: 'Manual bonus adjustments require the bonus ledger module' });
});

app.get('/api/admin/app/appointments', requireAuth, (_req, res) => {
  res.json({ appointments: [] });
});

app.get('/api/admin/app/qr-checkins', requireAuth, (_req, res) => {
  res.json({ qrCheckins: [] });
});

app.get('/api/admin/app/bonus-transactions', requireAuth, (_req, res) => {
  res.json({ transactions: [] });
});

app.get('/api/admin/app/tasks', requireAuth, (_req, res) => {
  res.json({ tasks: [] });
});

app.post('/api/admin/app/tasks', requireAuth, (_req, res) => {
  res.status(501).json({ error: 'Task creation requires the Negis App API module' });
});

app.patch('/api/admin/app/tasks/:id', requireAuth, (_req, res) => {
  res.status(501).json({ error: 'Task updates require the Negis App API module' });
});

app.delete('/api/admin/app/tasks/:id', requireAuth, (_req, res) => {
  res.status(501).json({ error: 'Task deletion requires the Negis App API module' });
});

app.get('/api/admin/app/promotions', requireAuth, (_req, res) => {
  res.json({ promotions: [] });
});

app.get('/api/admin/app/promotions/:id', requireAuth, (req, res) => {
  res.status(404).json({ error: `Promotion ${req.params.id} is not connected yet` });
});

app.post('/api/admin/app/promotions/:id/approve', requireAuth, (_req, res) => {
  res.status(501).json({ error: 'Promotion approval requires the moderation module' });
});

app.post('/api/admin/app/promotions/:id/reject', requireAuth, (_req, res) => {
  res.status(501).json({ error: 'Promotion rejection requires the moderation module' });
});

app.post('/api/admin/app/promotions/:id/pause', requireAuth, (_req, res) => {
  res.status(501).json({ error: 'Promotion pause requires the moderation module' });
});

app.get('/api/admin/app/moderation', requireAuth, (_req, res) => {
  res.json({ items: [] });
});

app.get('/api/admin/app/businesses', requireAuth, (_req, res) => {
  res.json({ businesses: [] });
});

app.patch('/api/admin/app/businesses/:id/app-settings', requireAuth, (_req, res) => {
  res.status(501).json({ error: 'Business app settings require the Negis App API module' });
});

app.get('/api/admin/app/settings', requireAuth, (_req, res) => {
  res.json({
    maxBonusPercent: 50,
    registrationBonus: 0,
    firstVisitBonus: 0,
    reviewBonus: 0,
    referralBonus: 0,
    bonusTtlDays: 0,
    tasksEnabled: false,
    promotionsEnabled: false,
    pushEnabled: false
  });
});

app.patch('/api/admin/app/settings', requireAuth, (_req, res) => {
  res.status(501).json({ error: 'App settings persistence requires the Negis App API module' });
});

app.get('/api/settings', requireAuth, (_req, res) => {
  res.json({
    profile: { email: process.env.SUPER_ADMIN_EMAIL },
    platform: {
      name: 'Negis',
      supportEmail: 'support@negis.kz',
      trialDays: 14,
      defaultPlan: 'Basic',
      mainAppUrl: MAIN_NEGIS_APP_URL
    }
  });
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Negis Control API listening on http://localhost:${PORT}`);
  });
}

export default app;
