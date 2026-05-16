import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

dotenv.config();

const PORT = Number(process.env.PORT || 8787);
const SESSION_COOKIE = 'negis_control_session';
const SESSION_TTL_SECONDS = 60 * 60;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-change-me';
const MAIN_NEGIS_APP_URL = process.env.MAIN_NEGIS_APP_URL || 'https://negis-crm.replit.app/';

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

  return Promise.all(
    data.map(async (clinic: Record<string, unknown>) => {
      const id = String(clinic.id);
      const [agents, leads, bookings] = await Promise.all([
        safeClinicCount(client, 'agents', id),
        safeClinicCount(client, 'leads', id),
        safeClinicCount(client, 'bookings', id)
      ]);

      return {
        id,
        name: pickText(clinic, ['name', 'clinic_name', 'title', 'company_name'], 'Клиника без названия'),
        ownerName: pickText(clinic, ['owner_name', 'ownerName', 'admin_name', 'contact_name'], 'Владелец'),
        ownerEmail: pickText(clinic, ['owner_email', 'ownerEmail', 'email', 'admin_email'], 'email не указан'),
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

app.post('/api/auth/login', (req, res) => {
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

  res.json({ email: expectedEmail, role: 'super_admin' });
});

app.post('/api/auth/logout', (_req, res) => {
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
  await tryUpdatePlanInSupabase(getSupabase(), updatedPlan);

  res.json({ plan: updatedPlan, plans });
});

app.post('/api/clinics/:id/impersonate', requireAuth, async (req, res) => {
  const clinics = await loadClinics(getSupabase());
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
    { expiresIn: '5m' }
  );

  const url = new URL(MAIN_NEGIS_APP_URL);
  url.searchParams.set('impersonate_token', token);
  url.searchParams.set('clinic_id', clinic.id);
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
    details: { login, resetBy: res.locals.session?.email }
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
  }

  res.json({ id: req.params.id, status });
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
    res.json({ logs: [] });
    return;
  }

  const { data } = await client.from('super_logs').select('*').order('created_at', { ascending: false }).limit(200);
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
