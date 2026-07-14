import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Activity,
  AlertTriangle,
  ArrowLeftToLine,
  ArrowRightToLine,
  BadgeDollarSign,
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Copy,
  Eye,
  FileDown,
  Gift,
  Gauge,
  Lock,
  LogOut,
  ListChecks,
  Megaphone,
  QrCode,
  RefreshCw,
  ReceiptText,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Store,
  Trash2,
  Users,
  WalletCards
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

type Session = { email: string; role: 'super_admin' };
type Clinic = {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  country: string;
  plan: string;
  status: string;
  agentsCount: number;
  leadsCount: number;
  bookingsCount: number;
  lastActivity: string;
  createdAt: string;
  revenue: number;
};

type Overview = {
  mode: 'live' | 'mock';
  metrics: {
    totalClinics: number;
    activeToday: number;
    newClinics7d: number;
    totalLeads: number;
    bookingsToday: number;
    revenueMonth: number;
  };
  clinics: Clinic[];
  sourceStats: Array<{ name: string; value: number }>;
  registrationStats: Array<{ date: string; count: number }>;
};

type Plan = {
  name: string;
  price: number;
  limits: string;
};

type ClinicAccess = {
  login: string;
  temporaryPassword: string;
  clinicId: string;
  clinicName: string;
};

type PaymentRow = {
  id: string;
  clinicId: string;
  clinic: string;
  plan: string;
  amount: number;
  currency: string;
  displayAmount: number;
  displayCurrency: string;
  exchangeRate: number;
  method: string;
  createdAt: string;
  status: string;
};

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  permissions: Record<string, 'none' | 'view' | 'edit'>;
  invitedAt: string;
  invitedBy: string;
  emailStatus: string;
  emailError: string;
  emailSentAt: string;
};

type AppDashboard = {
  metrics: {
    totalClients: number;
    active24h: number;
    active7d: number;
    appAppointments: number;
    qrArrivals: number;
    bonusesEarned: number;
    bonusesSpent: number;
    activePromotions: number;
    completedTasks: number;
    loyaltyBusinesses: number;
  };
  clientRegistrations: Array<{ date: string; count: number }>;
  appointmentStats: Array<{ date: string; count: number }>;
  bonusStats: Array<{ date: string; earned: number; spent: number }>;
  promotionStats: Array<{ name: string; value: number }>;
};

type AppClient = {
  id: string;
  name: string;
  phone: string;
  city: string;
  registeredAt: string;
  bonusBalance: number;
  appointmentsCount: number;
  lastVisit: string;
  status: string;
};

type AppAppointment = {
  id: string;
  client: string;
  business: string;
  branch: string;
  service: string;
  specialist: string;
  date: string;
  time: string;
  status: string;
  source: string;
  qrStatus: string;
};

type QrCheckin = {
  id: string;
  appointment: string;
  client: string;
  business: string;
  scannedBy: string;
  scannedAt: string;
  qrStatus: string;
  device: string;
  result: string;
};

type BonusTransaction = {
  id: string;
  client: string;
  business: string;
  type: string;
  amount: number;
  reason: string;
  appointment: string;
  createdAt: string;
  actor: string;
};

type AppTask = {
  id: string;
  title: string;
  type: string;
  reward: number;
  expiresAt: string;
  limit: number;
  business: string;
  status: string;
};

type AppPromotion = {
  id: string;
  business: string;
  title: string;
  category: string;
  city: string;
  startsAt: string;
  endsAt: string;
  status: string;
  moderationStatus: string;
};

type ModerationItem = {
  id: string;
  type: string;
  business: string;
  title: string;
  createdAt: string;
  status: string;
  risk: string;
};

type AppBusiness = {
  id: string;
  name: string;
  category: string;
  city: string;
  visibleInApp: string;
  loyaltyEnabled: string;
  bonusSpendEnabled: string;
  maxBonusPercent: number;
  promotionsCount: number;
};

type AppSettings = {
  maxBonusPercent: number;
  registrationBonus: number;
  firstVisitBonus: number;
  reviewBonus: number;
  referralBonus: number;
  bonusTtlDays: number;
  tasksEnabled: boolean;
  promotionsEnabled: boolean;
  pushEnabled: boolean;
};

const navItems = [
  { label: '\u0413\u043b\u0430\u0432\u043d\u0430\u044f', path: '/dashboard', icon: Gauge },
  { label: '\u041e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u0438', path: '/clinics', icon: Building2 },
  { label: '\u0411\u0438\u043b\u043b\u0438\u043d\u0433', path: '/billing', icon: BadgeDollarSign },
  { label: '\u0410\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0430', path: '/analytics', icon: Activity },
  { label: '\u041c\u043e\u043d\u0438\u0442\u043e\u0440\u0438\u043d\u0433', path: '/monitoring', icon: ShieldAlert },
  { label: '\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430', path: '/support', icon: Bell },
  { label: '\u0418\u043d\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u0438', path: '/integrations', icon: SlidersHorizontal },
  { label: 'Negis App', path: '/app-dashboard', icon: Smartphone },
  { label: '\u041a\u043e\u043c\u0430\u043d\u0434\u0430', path: '/team', icon: Users },
  { label: '\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438', path: '/settings', icon: Settings }
];

const colors = ['#1A56DB', '#10B981', '#F59E0B', '#EF4444', '#64748B', '#8B5CF6'];

const teamPermissionSections = [
  ['dashboard', 'Главная'],
  ['clinics', 'Организации'],
  ['billing', 'Биллинг'],
  ['analytics', 'Аналитика'],
  ['monitoring', 'Мониторинг'],
  ['support', 'Поддержка'],
  ['integrations', 'Интеграции'],
  ['app', 'Negis App'],
  ['team', 'Команда'],
  ['settings', 'Настройки']
] as const;

const teamRoles = ['Admin', 'Support', 'Finance', 'Developer', 'Read-only'];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Ошибка запроса');
  return payload as T;
}

function currencySymbol(currency = 'KGS') {
  if (currency === 'KZT') return '₸';
  if (currency === 'KGS') return 'сом';
  return currency;
}

function formatMoney(value = 0, currency = 'KGS') {
  return `${new Intl.NumberFormat('ru-RU').format(value)} ${currencySymbol(currency)}`;
}

function formatPaymentAmount(payment: PaymentRow) {
  const base = formatMoney(payment.amount, payment.currency || 'KGS');
  if (payment.displayCurrency && payment.displayCurrency !== payment.currency && payment.displayAmount) {
    return `${base} / ${formatMoney(payment.displayAmount, payment.displayCurrency)}`;
  }
  return base;
}

function isKazakhstanCountry(country?: string) {
  return ['kz', 'kaz', 'kazakhstan', 'қазақстан', 'казахстан'].includes(String(country || '').trim().toLowerCase());
}

function formatDate(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU').format(new Date(value));
}

function formatTime(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function relativeTime(value?: string) {
  if (!value) return '—';
  const diffMinutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes} минут назад`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `${hours} часов назад`;
  if (hours < 48) return 'вчера';
  return `${Math.round(hours / 24)} дней назад`;
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    active: 'Активна',
    blocked: 'Заблокирована',
    trial: 'Пробный период',
    expired: 'Просрочена',
    cancelled: 'Отменена',
    paid: 'Оплачено',
    verified: 'Подтверждён',
    rejected: 'Отклонён'
  };
  return map[status] || status;
}

function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  if (!rows.length) {
    toast.info('Нет данных для экспорта');
    return;
  }
  const headers = Object.keys(rows[0]);
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  toast.success('CSV выгружен');
}

async function impersonateClinic(clinic: Clinic) {
  localStorage.setItem('negis_impersonate_clinic_id', clinic.id);
  localStorage.setItem('negis_impersonate_clinic_name', clinic.name);
  const result = await api<{ url: string }>(`/api/clinics/${clinic.id}/impersonate`, { method: 'POST' });
  window.open(result.url, '_blank', 'noopener,noreferrer');
  toast.success(`Открываем организацию без повторного входа: ${clinic.name}`);
}

async function copyToClipboard(value: string, message = 'Скопировано') {
  await navigator.clipboard.writeText(value);
  toast.success(message);
}

function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: () => api<Session>('/api/auth/me')
  });
}

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const session = useSession();
  if (session.isLoading) return <BootScreen />;
  if (session.isError) return <Navigate to="/" replace />;
  return children;
}

function BootScreen() {
  return (
    <main className="boot-screen">
      <div className="neu-lg boot-mark">
        <ShieldAlert size={38} />
      </div>
      <p>Проверяем доступ</p>
    </main>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [entryLoading, setEntryLoading] = useState(false);
  const labels = {
    welcome: '\u0414\u043e\u0431\u0440\u043e \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c \u0432 Negis Control',
    sections: '\u0420\u0430\u0437\u0434\u0435\u043b\u044b Negis Control',
    platform: '\u041e \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u0435',
    features: '\u0412\u043e\u0437\u043c\u043e\u0436\u043d\u043e\u0441\u0442\u0438',
    security: '\u0411\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u044c',
    contacts: '\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b',
    openLogin: '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0432\u0445\u043e\u0434 \u0430\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440\u0430',
    loginAction: '\u0412\u043e\u0439\u0442\u0438 \u0432 \u0430\u0434\u043c\u0438\u043d\u043a\u0443',
    systemStatus: '\u0421\u0442\u0430\u0442\u0443\u0441 \u0441\u0438\u0441\u0442\u0435\u043c\u044b',
    back: '\u0412\u0435\u0440\u043d\u0443\u0442\u044c\u0441\u044f \u043a \u044f\u0434\u0440\u0443',
    subtitle: '\u0417\u0430\u043a\u0440\u044b\u0442\u0430\u044f \u043f\u0430\u043d\u0435\u043b\u044c \u0443\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u043e\u0439',
    adminOnly: '\u0422\u041e\u041b\u042c\u041a\u041e \u0414\u041b\u042f \u0410\u0414\u041c\u0418\u041d\u0418\u0421\u0422\u0420\u0410\u0422\u041e\u0420\u0410',
    password: '\u041f\u0430\u0440\u043e\u043b\u044c',
    checking: '\u041f\u0440\u043e\u0432\u0435\u0440\u044f\u0435\u043c',
    enter: '\u0412\u043e\u0439\u0442\u0438'
  };

  const login = useMutation({
    mutationFn: () => api<Session>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    onSuccess: (session) => {
      queryClient.setQueryData(['session'], session);
      toast.success(labels.welcome);
      navigate('/dashboard');
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <main
      className={`login-screen admin-entry ${showLogin ? 'is-login-open' : ''}`}
    >
      {!showLogin ? (
        <section className="admin-landing" aria-label="Negis Control">
          <button
            className={`admin-core-button ${entryLoading ? 'is-loading' : ''}`}
            type="button"
            onClick={() => {
              setEntryLoading(true);
              window.setTimeout(() => {
                setShowLogin(true);
                setEntryLoading(false);
              }, 520);
            }}
            aria-label={labels.openLogin}
          >
            <span className="core-ring" aria-hidden="true" />
            <span className="core-brand">
              <strong>NEGIS</strong>
              <i aria-hidden="true" />
              <span className="core-tape">CONTROL PLATFORM</span>
            </span>
            <span className="core-action">{labels.loginAction}</span>
          </button>
          <div className="entry-status" aria-label={labels.systemStatus}>
            <span>V1.0.0</span>
            <i aria-hidden="true" />
            <span>ONLINE</span>
          </div>
        </section>
      ) : (
        <form
          className="login-card admin-login-card"
          onSubmit={(event) => {
            event.preventDefault();
            login.mutate();
          }}
        >
          <button className="login-back-button" type="button" onClick={() => setShowLogin(false)}>
            <ArrowLeftToLine size={16} />
            {labels.back}
          </button>
          <div className="logo-stack">
            <h1>
              Negis <span>Control</span>
            </h1>
            <p>{labels.subtitle}</p>
          </div>
          <div className="warning-strip">{labels.adminOnly}</div>
          <label>
            Email
            <input className="neu-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            {labels.password}
            <input className="neu-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button className={`neu-btn-primary full login-submit ${login.isPending ? 'is-loading' : ''}`} disabled={login.isPending}>
            <Lock size={17} />
            {login.isPending ? labels.checking : labels.enter}
          </button>
        </form>
      )}
    </main>
  );
}

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [clock, setClock] = useState(new Date());
  const title = navItems.find((item) => location.pathname.startsWith(item.path))?.label || 'Negis Control';

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const logout = useMutation({
    mutationFn: () => api('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.clear();
      navigate('/');
    }
  });

  return (
    <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">N</div>
          {!collapsed && (
            <strong>
              Negis <span>Control</span>
            </strong>
          )}
        </div>
        <nav className="nav-list">
          {navItems.map((item) => {
            const active = location.pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <Link className={`nav-item neu-sm ${active ? 'active' : ''}`} to={item.path} key={item.path} title={item.label}>
                <Icon size={19} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-warning">
          <AlertTriangle size={16} />
          {!collapsed && <span>SUPER ADMIN</span>}
        </div>
        <button className="collapse-button neu-sm" onClick={() => setCollapsed((value) => !value)} title="Свернуть меню">
          {collapsed ? <ArrowRightToLine size={18} /> : <ArrowLeftToLine size={18} />}
        </button>
        <button className="logout-button" onClick={() => logout.mutate()} title="Выйти">
          <LogOut size={18} />
          {!collapsed && <span>Выйти</span>}
        </button>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">Negis Control v1.0</p>
            <h2>{title}</h2>
          </div>
          <div className="topbar-actions">
            <div className="online-pill">
              <span />
              ONLINE
            </div>
            <div className="clock">
              <Clock3 size={16} />
              {formatTime(clock.toISOString())}
            </div>
            <button className="icon-button neu-sm" onClick={() => queryClient.invalidateQueries()}>
              <RefreshCw size={17} />
            </button>
          </div>
        </header>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/clinics" element={<ClinicsPage />} />
          <Route path="/clinics/:id" element={<ClinicDetailPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/monitoring" element={<MonitoringPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/users" element={<Navigate to="/team" replace />} />
          <Route path="/subscriptions" element={<Navigate to="/billing" replace />} />
          <Route path="/finances" element={<Navigate to="/billing" replace />} />
          <Route path="/logs" element={<Navigate to="/monitoring" replace />} />
          <Route path="/app-dashboard" element={<AppDashboardPage />} />
          <Route path="/app-clients" element={<AppClientsPage />} />
          <Route path="/app-appointments" element={<AppAppointmentsPage />} />
          <Route path="/app-qr" element={<AppQrPage />} />
          <Route path="/app-bonuses" element={<AppBonusesPage />} />
          <Route path="/app-tasks" element={<AppTasksPage />} />
          <Route path="/app-promotions" element={<AppPromotionsPage />} />
          <Route path="/app-moderation" element={<AppModerationPage />} />
          <Route path="/app-partners" element={<AppPartnersPage />} />
          <Route path="/app-settings" element={<AppSettingsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

function MetricCard({ icon, label, value, hint }: { icon: JSX.Element; label: string; value: string | number; hint: string }) {
  return (
    <article className="metric-card neu">
      <div className="metric-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{hint}</span>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge ${status}`}>{statusLabel(status)}</span>;
}

function DashboardPage() {
  const overview = useQuery({ queryKey: ['overview'], queryFn: () => api<Overview>('/api/overview') });
  const data = overview.data;
  const clinics = data?.clinics || [];
  const blocked = clinics.filter((clinic) => clinic.status === 'blocked').length;
  const trial = clinics.filter((clinic) => clinic.status === 'trial').length;
  const noActivity = clinics.filter((clinic) => {
    if (!clinic.lastActivity) return true;
    return Date.now() - new Date(clinic.lastActivity).getTime() > 7 * 86400000;
  }).length;

  if (overview.isLoading) return <SkeletonGrid />;

  return (
    <section className="page-stack">
      {data?.mode === 'mock' && <div className="notice">Live API не подключен. После заполнения `.env` админка переключится на Supabase.</div>}
      <section className="control-hero neu-lg">
        <div>
          <span className="section-kicker">SAAS CONTROL CENTER</span>
          <h1>Операционный центр Negis</h1>
          <p>Организации, деньги, риски, поддержка и техническое здоровье платформы в одном рабочем экране.</p>
        </div>
        <div className="hero-monogram">N</div>
      </section>
      <div className="metrics-grid">
        <MetricCard icon={<Building2 />} label="Организации" value={data?.metrics.totalClinics || 0} hint="под управлением" />
        <MetricCard icon={<CheckCircle2 />} label="Активны сегодня" value={data?.metrics.activeToday || 0} hint="за 24 часа" />
        <MetricCard icon={<CalendarClock />} label="Новые за 7 дней" value={data?.metrics.newClinics7d || 0} hint="рост базы" />
        <MetricCard icon={<Users />} label="Лиды в CRM" value={data?.metrics.totalLeads || 0} hint="по всем организациям" />
        <MetricCard icon={<Bell />} label="Записи сегодня" value={data?.metrics.bookingsToday || 0} hint="операционная активность" />
        <MetricCard icon={<CircleDollarSign />} label="MRR платформы" value={formatMoney(data?.metrics.revenueMonth || 0)} hint="текущий месяц" />
      </div>
      <div className="content-grid wide-left">
        <section className="neu panel">
          <PanelHeader title="Организации под вниманием" action="health score" />
          <ClinicTable clinics={data?.clinics || []} compact />
        </section>
        <section className="neu panel">
          <PanelHeader title="Фокус на сегодня" action="автоприоритет" />
          <div className="task-stack">
            <ActionTile tone="gold" title="Пробный период" value={trial} text="Проверить настройку CRM и готовность к оплате." />
            <ActionTile tone="red" title="Заблокированы" value={blocked} text="Разобрать оплату, риски или причину ограничения доступа." />
            <ActionTile tone="blue" title="Нет активности" value={noActivity} text="Связаться с организациями без действий больше 7 дней." />
          </div>
        </section>
      </div>
      <div className="content-grid wide-left">
        <section className="neu panel">
          <PanelHeader title="Регистрации организаций" />
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data?.registrationStats || []}>
              <CartesianGrid stroke="#d7dde8" strokeDasharray="4 4" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line dataKey="count" stroke="#0f62fe" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </section>
        <section className="neu panel">
          <PanelHeader title="Источники лидов" />
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={data?.sourceStats || []} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={4}>
                {(data?.sourceStats || []).map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </section>
      </div>
    </section>
  );
}

function ActionTile({ title, value, text, tone }: { title: string; value: string | number; text: string; tone: 'blue' | 'gold' | 'red' }) {
  return (
    <article className={`action-tile ${tone}`}>
      <strong>{value}</strong>
      <div>
        <h4>{title}</h4>
        <p>{text}</p>
      </div>
    </article>
  );
}

function PanelHeader({ title, action }: { title: string; action?: string }) {
  return (
    <div className="panel-header">
      <h3>{title}</h3>
      {action && <span>{action}</span>}
    </div>
  );
}

function ClinicTable({ clinics, compact = false }: { clinics: Clinic[]; compact?: boolean }) {
  const queryClient = useQueryClient();
  const [invoiceClinic, setInvoiceClinic] = useState<Clinic | null>(null);
  const [deleteClinic, setDeleteClinic] = useState<Clinic | null>(null);
  const openTrial = useMutation({
    mutationFn: (clinic: Clinic) => api(`/api/clinics/${clinic.id}/trial`, { method: 'POST', body: JSON.stringify({ days: 14 }) }),
    onSuccess: () => {
      toast.success('Пробный период открыт');
      queryClient.invalidateQueries({ queryKey: ['clinics'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <>
      <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Организация</th>
            <th>Владелец</th>
            {!compact && <th>Тариф</th>}
            <th>Статус</th>
            <th>Лидов</th>
            <th>Записей</th>
            {!compact && <th>Последняя активность</th>}
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {clinics.map((clinic) => (
            <tr key={clinic.id}>
              <td>
                <div className="identity-cell">
                  <span>{clinic.name.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <strong>{clinic.name}</strong>
                    <small>{formatDate(clinic.createdAt)}</small>
                  </div>
                </div>
              </td>
              <td>
                <strong>{clinic.ownerName}</strong>
                <small>{clinic.ownerEmail}</small>
              </td>
              {!compact && <td>{clinic.plan}</td>}
              <td>
                <StatusBadge status={clinic.status} />
              </td>
              <td>{clinic.leadsCount}</td>
              <td>{clinic.bookingsCount}</td>
              {!compact && <td>{relativeTime(clinic.lastActivity)}</td>}
              <td>
                <div className="row-actions">
                  <Link className="mini-button secondary-action" to={`/clinics/${clinic.id}`} title="Обзор организации">
                    <Eye size={16} />
                    Обзор
                  </Link>
                  <button className="mini-button" onClick={() => impersonateClinic(clinic).catch((error) => toast.error(error.message))}>
                    Войти
                  </button>
                  {!compact && (
                    <>
                      <button className="mini-button secondary-action" onClick={() => setInvoiceClinic(clinic)} title="Выставить счет">
                        <ReceiptText size={16} />
                        Счет
                      </button>
                      <button className="mini-button secondary-action" disabled={openTrial.isPending} onClick={() => openTrial.mutate(clinic)} title="Открыть пробный период">
                        <Gift size={16} />
                        Пробный
                      </button>
                      <button className="mini-button delete-action" onClick={() => setDeleteClinic(clinic)} title="Удалить организацию">
                        <Trash2 size={16} />
                        Удалить
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {invoiceClinic && <InvoiceModal clinic={invoiceClinic} onClose={() => setInvoiceClinic(null)} />}
      {deleteClinic && <DeleteClinicModal clinic={deleteClinic} onClose={() => setDeleteClinic(null)} />}
    </>
  );
}

function InvoiceModal({ clinic, onClose }: { clinic: Clinic; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [plan, setPlan] = useState(clinic.plan || 'Basic');
  const shouldShowKzt = isKazakhstanCountry(clinic.country);
  const exchange = useQuery({
    queryKey: ['exchange', 'kgs-kzt'],
    queryFn: () => api<{ quote: { rate: number; updatedAt: string; source: string } }>('/api/exchange/kgs-kzt'),
    enabled: shouldShowKzt
  });
  const amountKgs = Number(amount);
  const amountKzt = shouldShowKzt && exchange.data?.quote.rate ? Math.round(amountKgs * exchange.data.quote.rate) : 0;
  const create = useMutation({
    mutationFn: () =>
      api(`/api/clinics/${clinic.id}/invoice`, {
        method: 'POST',
        body: JSON.stringify({ amount: amountKgs, plan })
      }),
    onSuccess: () => {
      toast.success('Счет выставлен');
      queryClient.invalidateQueries({ queryKey: ['finances'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      onClose();
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card neu">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Закрыть">×</button>
        <div>
          <h3>Выставить счет</h3>
          <p>{clinic.name}</p>
        </div>
        <div className="modal-form">
          <label>
            <span>Тариф</span>
            <input className="neu-input" value={plan} onChange={(event) => setPlan(event.target.value)} />
          </label>
          <label>
            <span>Сумма, KGS / сом</span>
            <input className="neu-input" type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="59000" />
          </label>
          {shouldShowKzt && (
            <p className="modal-copy">
              Для Казахстана клиент увидит: {exchange.isLoading ? 'загружаем курс' : formatMoney(amountKzt, 'KZT')}
              {exchange.data?.quote.rate ? ` · курс 1 сом = ${exchange.data.quote.rate.toFixed(4)} ₸` : ''}
              {exchange.isError ? ' · курс недоступен' : ''}
            </p>
          )}
        </div>
        <div className="modal-actions">
          <button className="neu-btn" onClick={onClose}>Отмена</button>
          <button className="neu-btn-primary" disabled={create.isPending || !amountKgs || (shouldShowKzt && exchange.isError)} onClick={() => create.mutate()}>
            {create.isPending ? 'Выставляем' : 'Выставить счет'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteClinicModal({ clinic, onClose }: { clinic: Clinic; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [confirmation, setConfirmation] = useState('');
  const remove = useMutation({
    mutationFn: () =>
      api(`/api/clinics/${clinic.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmation })
      }),
    onSuccess: () => {
      toast.success('Организация удалена');
      queryClient.invalidateQueries({ queryKey: ['clinics'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['finances'] });
      onClose();
    },
    onError: (error) => toast.error(error.message)
  });
  const canDelete = confirmation.trim() === clinic.name;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card neu">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Закрыть">×</button>
        <div>
          <h3>Удалить организацию</h3>
          <p>Это действие удалит организацию и связанные записи из админки.</p>
        </div>
        <div className="danger-note">
          Введите точное название: <strong>{clinic.name}</strong>
        </div>
        <input className="neu-input" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={clinic.name} />
        <div className="modal-actions">
          <button className="neu-btn" onClick={onClose}>Отмена</button>
          <button className="neu-btn-danger" disabled={remove.isPending || !canDelete} onClick={() => remove.mutate()}>
            {remove.isPending ? 'Удаляем' : 'Удалить'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClinicsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const clinics = useQuery({ queryKey: ['clinics'], queryFn: () => api<{ clinics: Clinic[] }>('/api/clinics') });
  const filtered = useMemo(() => {
    return (clinics.data?.clinics || []).filter((clinic) => {
      const matchesSearch = `${clinic.name} ${clinic.ownerEmail}`.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = status === 'all' || clinic.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [clinics.data, search, status]);

  return (
    <section className="page-stack">
      <div className="toolbar neu">
        <div className="search-field">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по организации или email" />
        </div>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">Все статусы</option>
          <option value="active">Активна</option>
          <option value="blocked">Заблокирована</option>
          <option value="trial">Пробный период</option>
        </select>
        <button
          className="neu-btn"
          onClick={() =>
            downloadCsv(
              `negis_clinics_${new Date().toISOString().slice(0, 10)}.csv`,
              filtered.map((clinic) => ({
                clinic: clinic.name,
                owner: clinic.ownerName,
                email: clinic.ownerEmail,
                plan: clinic.plan,
                status: statusLabel(clinic.status),
                leads: clinic.leadsCount,
                bookings: clinic.bookingsCount,
                createdAt: formatDate(clinic.createdAt)
              }))
            )
          }
        >
          <FileDown size={17} />
          Экспорт CSV
        </button>
      </div>
      <section className="neu panel">
        <PanelHeader title="Все организации" action={`${filtered.length} записей`} />
        <ClinicTable clinics={filtered} />
      </section>
    </section>
  );
}

function ClinicDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [access, setAccess] = useState<ClinicAccess | null>(null);
  const detail = useQuery({
    queryKey: ['clinic', id],
    queryFn: () =>
      api<{
        clinic: Clinic;
        agents: Array<{ name: string; role: string; bookings: number; revenue: number }>;
        funnel: Array<{ name: string; value: number }>;
      }>(`/api/clinics/${id}`)
  });
  const clinic = detail.data?.clinic;
  const updateStatus = useMutation({
    mutationFn: (status: string) => api(`/api/clinics/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      toast.success('Статус организации обновлён');
      queryClient.invalidateQueries({ queryKey: ['clinic', id] });
      queryClient.invalidateQueries({ queryKey: ['clinics'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: (error) => toast.error(error.message)
  });
  const resetPassword = useMutation({
    mutationFn: () => api<ClinicAccess>(`/api/clinics/${id}/reset-password`, { method: 'POST' }),
    onSuccess: (result) => {
      setAccess(result);
      toast.success('Временный пароль создан');
    },
    onError: (error) => toast.error(error.message)
  });

  if (detail.isLoading || !clinic) return <SkeletonGrid />;

  return (
    <section className="page-stack">
      <div className="detail-hero neu">
        <div>
          <h1>{clinic.name}</h1>
          <p>
            {clinic.ownerName} · {clinic.ownerEmail}
          </p>
        </div>
        <StatusBadge status={clinic.status} />
        <div className="hero-actions">
          <button
            className={clinic.status === 'blocked' ? 'neu-btn-primary' : 'neu-btn-danger'}
            onClick={() => updateStatus.mutate(clinic.status === 'blocked' ? 'active' : 'blocked')}
          >
            {clinic.status === 'blocked' ? 'Разблокировать' : 'Заблокировать'}
          </button>
          <button className="neu-btn" onClick={() => impersonateClinic(clinic).catch((error) => toast.error(error.message))}>
            Войти
          </button>
        </div>
      </div>
      <OrganizationAccessPanel clinic={clinic} />
      <section className="clinic-overview-grid">
        <article className="overview-card neu">
          <span>01</span>
          <h3>Обзор организации</h3>
          <p>Сводка по владельцу, тарифу, активности и рискам.</p>
          <b>{clinic.plan}</b>
        </article>
        <article className="overview-card neu">
          <span>02</span>
          <h3>Сотрудники и роли</h3>
          <p>{detail.data?.agents.length || 0} сотрудников. Должности: {(detail.data?.agents || []).map((agent) => agent.role).filter(Boolean).slice(0, 4).join(', ') || 'не указаны'}.</p>
          <b>{detail.data?.agents.length || 0}</b>
        </article>
        <article className="overview-card neu">
          <span>03</span>
          <h3>Воронка</h3>
          <p>Лиды, записи, приходы и оценка конверсии по этапам.</p>
          <b>{clinic.leadsCount} / {clinic.bookingsCount}</b>
        </article>
        <article className="overview-card neu">
          <span>04</span>
          <h3>Деньги</h3>
          <p>Оценка выручки и потенциал организации для перехода на старший тариф.</p>
          <b>{formatMoney(clinic.revenue)}</b>
        </article>
      </section>
      <div className="content-grid">
        <section className="neu panel">
          <PanelHeader title="Информация об организации" />
          <InfoRows
            rows={[
              ['Название организации', clinic.name],
              ['Email владельца', clinic.ownerEmail],
              ['Тариф текущий', clinic.plan],
              ['Дата регистрации', formatDate(clinic.createdAt)],
              ['Последняя активность', relativeTime(clinic.lastActivity)]
            ]}
          />
          <div className="access-panel">
            <div>
              <span>Логин администратора</span>
              <strong>{clinic.ownerEmail}</strong>
            </div>
            <div>
              <span>Пароль</span>
              <strong>{access?.temporaryPassword || 'Не хранится. Можно создать временный.'}</strong>
            </div>
            <div className="access-actions">
              <button
                className="neu-btn-primary"
                disabled={resetPassword.isPending}
                onClick={() => resetPassword.mutate()}
              >
                {resetPassword.isPending ? 'Создаём пароль' : 'Создать временный пароль'}
              </button>
              <button className="icon-button" disabled={!access?.temporaryPassword} onClick={() => access && copyToClipboard(access.temporaryPassword, 'Пароль скопирован')} title="Скопировать пароль">
                <Copy size={17} />
              </button>
            </div>
          </div>
        </section>
        <section className="stats-column">
          <MetricCard icon={<Users />} label="Лидов всего" value={clinic.leadsCount} hint="за всё время" />
          <MetricCard icon={<CalendarClock />} label="Записей всего" value={clinic.bookingsCount} hint="за всё время" />
          <MetricCard icon={<CheckCircle2 />} label="Пришло клиентов" value={Math.round(clinic.bookingsCount * 0.68)} hint="конверсия" />
          <MetricCard icon={<CircleDollarSign />} label="Выручка организации" value={formatMoney(clinic.revenue)} hint="оценка" />
        </section>
      </div>
      <div className="content-grid">
        <section className="neu panel">
          <PanelHeader title="Агенты" action={`${detail.data?.agents.length || 0}`} />
          <div className="mini-list">
            {detail.data?.agents.map((agent) => (
              <div className="mini-row" key={agent.name}>
                <span>{agent.name.slice(0, 2).toUpperCase()}</span>
                <strong>{agent.name}</strong>
                <small>{agent.role}</small>
                <b>{agent.bookings} записей</b>
              </div>
            ))}
          </div>
        </section>
        <section className="neu panel">
          <PanelHeader title="Воронка конверсии" />
          <div className="funnel-list">
            {detail.data?.funnel.map((item) => (
              <div key={item.name}>
                <span>{item.name}</span>
                <strong>{item.value}</strong>
                <div style={{ width: `${Math.max(8, Math.min(100, item.value / 8))}%` }} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

type OrganizationFeature = {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  isInternal: boolean;
  planEnabled: boolean;
  override: boolean | null;
  enabled: boolean;
};

type OrganizationAccess = {
  plans: Array<{ id: string; code: string; name: string; description: string }>;
  subscription: { planId: string | null; planName: string; status: string; startsAt: string; endsAt: string; trialEndsAt: string };
  features: OrganizationFeature[];
  audit: Array<{ id: string; action: string; oldValue: unknown; newValue: unknown; createdAt: string }>;
};

function OrganizationAccessPanel({ clinic }: { clinic: Clinic }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'plan' | 'features' | 'integrations' | 'automation' | 'activity'>('plan');
  const access = useQuery({
    queryKey: ['organization-access', clinic.id],
    queryFn: () => api<OrganizationAccess>(`/api/clinics/${clinic.id}/access`)
  });
  const [planId, setPlanId] = useState('');
  const [status, setStatus] = useState('active');
  const [endsAt, setEndsAt] = useState('');

  useEffect(() => {
    if (!access.data) return;
    setPlanId(access.data.subscription.planId || '');
    setStatus(access.data.subscription.status || 'active');
    setEndsAt(access.data.subscription.endsAt ? access.data.subscription.endsAt.slice(0, 10) : '');
  }, [access.data]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['organization-access', clinic.id] });
  const updateSubscription = useMutation({
    mutationFn: () => api(`/api/clinics/${clinic.id}/subscription`, {
      method: 'PATCH',
      body: JSON.stringify({ planId, status, startsAt: access.data?.subscription.startsAt || new Date().toISOString(), endsAt: endsAt || null, trialEndsAt: status === 'trial' ? endsAt || null : null })
    }),
    onSuccess: () => { toast.success('Тариф организации обновлен'); refresh(); queryClient.invalidateQueries({ queryKey: ['clinics'] }); },
    onError: (error) => toast.error(error.message)
  });
  const setOverride = useMutation({
    mutationFn: ({ feature, isEnabled }: { feature: OrganizationFeature; isEnabled: boolean }) => api(`/api/clinics/${clinic.id}/features/${feature.key}`, { method: 'PUT', body: JSON.stringify({ isEnabled }) }),
    onSuccess: () => { toast.success('Доступ обновлен'); refresh(); },
    onError: (error) => toast.error(error.message)
  });
  const resetOverride = useMutation({
    mutationFn: (feature: OrganizationFeature) => api(`/api/clinics/${clinic.id}/features/${feature.key}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Возвращено к условиям тарифа'); refresh(); },
    onError: (error) => toast.error(error.message)
  });

  if (access.isLoading) return <section className="neu panel"><p>Загружаем настройки доступа...</p></section>;
  if (access.isError || !access.data) return <section className="neu panel"><PanelHeader title="Тариф и доступы" /><p>Сначала выполните SQL `2026-07-14_workspace_features.sql`. Без него управлять доступами нечем.</p></section>;

  const renderFeatures = (features: OrganizationFeature[]) => (
    <div className="feature-access-table">
      <div className="feature-access-head"><span>Возможность</span><span>По тарифу</span><span>Индивидуально</span><span>Итог</span><span /></div>
      {features.map((feature) => (
        <div className="feature-access-row" key={feature.id}>
          <div><strong>{feature.name}</strong><small>{feature.description || feature.key}</small></div>
          <span>{feature.planEnabled ? 'Да' : 'Нет'}</span>
          <span>{feature.override === null ? 'По тарифу' : feature.override ? 'Включено' : 'Отключено'}</span>
          <b className={feature.enabled ? 'access-enabled' : 'access-disabled'}>{feature.enabled ? 'Доступно' : 'Недоступно'}</b>
          <div className="feature-actions">
            {feature.override !== null && <button className="mini-button" onClick={() => resetOverride.mutate(feature)}>Сбросить</button>}
            <button className={feature.enabled ? 'mini-button delete-action' : 'mini-button secondary-action'} onClick={() => setOverride.mutate({ feature, isEnabled: !feature.enabled })}>
              {feature.enabled ? 'Отключить' : 'Включить'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const integrations = access.data.features.filter((item) => item.category === 'Интеграции');
  const automations = access.data.features.filter((item) => item.category === 'Автоматизации');
  return (
    <section className="neu panel organization-access-panel">
      <PanelHeader title="Тариф, возможности и доступы" action={access.data.subscription.planName} />
      <div className="organization-tabs" role="tablist">
        {([
          ['plan', 'Тариф и лимиты'], ['features', 'Возможности'], ['integrations', 'Подключения'], ['automation', 'Автоматизации'], ['activity', 'Активность']
        ] as const).map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}
      </div>
      {tab === 'plan' && <div className="subscription-editor">
        <label><span>Тариф</span><select className="neu-input" value={planId} onChange={(event) => setPlanId(event.target.value)}><option value="">Выберите тариф</option>{access.data.plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>
        <label><span>Статус</span><select className="neu-input" value={status} onChange={(event) => setStatus(event.target.value)}><option value="trial">Пробный</option><option value="active">Активен</option><option value="suspended">Приостановлен</option><option value="blocked">Заблокирован</option><option value="expired">Истек</option></select></label>
        <label><span>Окончание доступа</span><input className="neu-input" type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label>
        <button className="neu-btn-primary" disabled={!planId || updateSubscription.isPending} onClick={() => updateSubscription.mutate()}>{updateSubscription.isPending ? 'Сохраняем' : 'Сохранить'}</button>
      </div>}
      {tab === 'features' && renderFeatures(access.data.features)}
      {tab === 'integrations' && <><p className="access-note">Здесь только разрешение. Клиент сам завершает OAuth, QR или API-подключение в своей CRM; токены админка не показывает.</p>{renderFeatures(integrations)}</>}
      {tab === 'automation' && renderFeatures(automations)}
      {tab === 'activity' && <div className="feature-audit-list">{access.data.audit.length ? access.data.audit.map((item) => <div key={item.id}><strong>{item.action}</strong><span>{formatDate(item.createdAt)}</span></div>) : <p>Изменений доступов пока нет.</p>}</div>}
    </section>
  );
}

function InfoRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="info-rows">
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function UsersPage() {
  const navigate = useNavigate();
  const users = useQuery({
    queryKey: ['users'],
    queryFn: () =>
      api<{
        users: Array<{ id: string; clinicId: string; name: string; email: string; clinic: string; plan: string; createdAt: string; lastLogin: string; kyc: string }>;
      }>('/api/users')
  });
  return (
    <DataPage
      title="Пользователи"
      rows={users.data?.users || []}
      columns={['Имя', 'Email', 'Организация', 'Тариф', 'Регистрация', 'Последний вход', 'KYC']}
      render={(user) => [user.name, user.email, user.clinic, user.plan, formatDate(user.createdAt), relativeTime(user.lastLogin), statusLabel(user.kyc)]}
      actionLabel="Организация"
      onOpen={(user) => navigate(`/clinics/${user.clinicId}`)}
    />
  );
}

function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const subscriptions = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () =>
      api<{
        subscriptions: Array<{ id: string; clinicId: string; clinic: string; plan: string; startsAt: string; endsAt: string; amount: number; status: string }>;
        plans: Plan[];
      }>('/api/subscriptions')
  });
  const savePlan = useMutation({
    mutationFn: (plan: Plan) =>
      api<{ plan: Plan }>(`/api/plans/${encodeURIComponent(plan.name)}`, {
        method: 'PATCH',
        body: JSON.stringify({ price: plan.price, limits: plan.limits })
      }),
    onSuccess: () => {
      toast.success('Тариф обновлён');
      setEditingPlan(null);
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['finances'] });
    },
    onError: (error) => toast.error(error.message)
  });
  const subscriptionRows = subscriptions.data?.subscriptions || [];
  const activeSubscriptions = subscriptionRows.filter((sub) => sub.status === 'active');
  const expiringSoon = subscriptionRows.filter((sub) => {
    if (!sub.endsAt) return false;
    const daysLeft = (new Date(sub.endsAt).getTime() - Date.now()) / 86400000;
    return daysLeft >= 0 && daysLeft <= 7;
  }).length;
  const monthlyRevenue = activeSubscriptions.reduce((sum, sub) => sum + sub.amount, 0);

  return (
    <section className="page-stack">
      <div className="metrics-grid four">
        <MetricCard icon={<CheckCircle2 />} label="Активных подписок" value={activeSubscriptions.length} hint="сейчас" />
        <MetricCard icon={<CalendarClock />} label="Истекают в 7 дней" value={expiringSoon} hint="контроль" />
        <MetricCard icon={<CircleDollarSign />} label="Выручка этот месяц" value={formatMoney(monthlyRevenue)} hint="оплачено" />
        <MetricCard icon={<BadgeDollarSign />} label="Прогноз" value={formatMoney(monthlyRevenue)} hint="следующий месяц" />
      </div>
      <DataPage
        title="Подписки"
        rows={subscriptionRows}
        columns={['Организация', 'Тариф', 'Начало', 'Окончание', 'Сумма', 'Статус']}
        render={(sub) => [sub.clinic, sub.plan, formatDate(sub.startsAt), formatDate(sub.endsAt), formatMoney(sub.amount), statusLabel(sub.status)]}
        actionLabel="Открыть организацию"
        onOpen={(sub) => navigate(`/clinics/${sub.clinicId}`)}
        embedded
      />
      <section className="plans-grid">
        {subscriptions.data?.plans.map((plan) => (
          <article className="neu plan-card" key={plan.name}>
            <h3>{plan.name}</h3>
            <strong>{formatMoney(plan.price)}</strong>
            <p>{plan.limits}</p>
            <button className="neu-btn" onClick={() => setEditingPlan(plan)}>
              Редактировать
            </button>
          </article>
        ))}
      </section>
      {editingPlan && (
        <PlanEditModal
          plan={editingPlan}
          isSaving={savePlan.isPending}
          onClose={() => setEditingPlan(null)}
          onSave={(plan) => savePlan.mutate(plan)}
        />
      )}
    </section>
  );
}

function PlanEditModal({
  plan,
  isSaving,
  onClose,
  onSave
}: {
  plan: Plan;
  isSaving: boolean;
  onClose: () => void;
  onSave: (plan: Plan) => void;
}) {
  const [price, setPrice] = useState(String(plan.price));
  const [limits, setLimits] = useState(plan.limits);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="modal-card neu-lg"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ ...plan, price: Number(price), limits });
        }}
      >
        <div className="panel-header">
          <h3>Редактировать тариф {plan.name}</h3>
          <button className="icon-button neu-sm" type="button" onClick={onClose} title="Закрыть">
            ×
          </button>
        </div>
        <label>
          Стоимость в месяц, ₸
          <input className="neu-input" type="number" min="0" step="1000" value={price} onChange={(event) => setPrice(event.target.value)} />
        </label>
        <label>
          Лимиты и модули
          <textarea className="neu-input textarea" value={limits} onChange={(event) => setLimits(event.target.value)} />
        </label>
        <div className="modal-actions">
          <button className="neu-btn" type="button" onClick={onClose}>
            Отмена
          </button>
          <button className="neu-btn-primary" disabled={isSaving || !limits.trim() || Number(price) < 0}>
            {isSaving ? 'Сохраняем' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  );
}

function FinancesPage() {
  const navigate = useNavigate();
  const finances = useQuery({
    queryKey: ['finances'],
    queryFn: () =>
      api<{
        revenueMonth: number;
        revenuePrevious: number;
        forecast: number;
        byMonth: Array<{ month: string; revenue: number }>;
        byPlan: Array<{ name: string; value: number }>;
        payments: PaymentRow[];
      }>('/api/finances')
  });
  return (
    <section className="page-stack">
      <div className="finance-overview neu-lg">
        <MetricCard icon={<CircleDollarSign />} label="Выручка за этот месяц" value={formatMoney(finances.data?.revenueMonth || 0)} hint="текущий период" />
        <MetricCard icon={<Activity />} label="Прошлый месяц" value={formatMoney(finances.data?.revenuePrevious || 0)} hint="+18%" />
        <MetricCard icon={<BadgeDollarSign />} label="Прогноз" value={formatMoney(finances.data?.forecast || 0)} hint="следующий месяц" />
      </div>
      <div className="content-grid wide-left">
        <section className="neu panel">
          <PanelHeader title="Revenue by month" />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={finances.data?.byMonth || []}>
              <CartesianGrid stroke="#d7dde8" strokeDasharray="4 4" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="revenue" fill="#1A56DB" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="neu panel">
          <PanelHeader title="Revenue by plan" />
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={finances.data?.byPlan || []} dataKey="value" nameKey="name" outerRadius={96}>
                {(finances.data?.byPlan || []).map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </section>
      </div>
      <DataPage
        title="История платежей"
        rows={finances.data?.payments || []}
        columns={['Организация', 'Тариф', 'Сумма', 'Метод', 'Дата', 'Статус']}
        render={(payment) => [payment.clinic, payment.plan, formatPaymentAmount(payment), payment.method, formatDate(payment.createdAt), statusLabel(payment.status)]}
        actionLabel="Организация"
        onOpen={(payment) => navigate(`/clinics/${payment.clinicId}`)}
        embedded
      />
    </section>
  );
}

function LogsPage() {
  const logs = useQuery({
    queryKey: ['logs'],
    queryFn: () => api<{ logs: Array<{ id: string; time: string; clinic: string; user: string; action: string; details: string; ip: string }> }>('/api/logs')
  });

  if (logs.isError) {
    return (
      <section className="page-stack">
        <section className="neu panel">
          <PanelHeader title="Логи" />
          <div className="empty-state">
            <h3>Не удалось загрузить логи</h3>
            <p>{logs.error instanceof Error ? logs.error.message : 'Проверьте таблицу super_logs и переменные Supabase в Vercel.'}</p>
          </div>
        </section>
      </section>
    );
  }

  return (
    <DataPage
      title="Логи"
      rows={logs.data?.logs || []}
      columns={['Время', 'Организация', 'Пользователь', 'Действие', 'Детали', 'IP']}
      render={(log) => [formatTime(log.time), log.clinic, log.user, log.action, log.details, log.ip]}
    />
  );
}

const appLabels = {
  notice: '\u0420\u0430\u0437\u0434\u0435\u043b\u044b \u043a\u043b\u0438\u0435\u043d\u0442\u0441\u043a\u043e\u0433\u043e \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u044f \u043f\u043e\u0434\u0433\u043e\u0442\u043e\u0432\u043b\u0435\u043d\u044b \u043f\u043e\u0434 \u0440\u0435\u0430\u043b\u044c\u043d\u044b\u0435 API. \u0414\u0435\u043c\u043e-\u0434\u0430\u043d\u043d\u044b\u0435 \u043d\u0435 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u044e\u0442\u0441\u044f: \u043f\u043e\u043a\u0430 backend app-\u043c\u043e\u0434\u0443\u043b\u044c \u043d\u0435 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d, \u0442\u0430\u0431\u043b\u0438\u0446\u044b \u0431\u0443\u0434\u0443\u0442 \u043f\u0443\u0441\u0442\u044b\u043c\u0438.',
  appClients: '\u041a\u043b\u0438\u0435\u043d\u0442\u043e\u0432 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u044f',
  total: '\u0432\u0441\u0435\u0433\u043e',
  active24h: '\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u0437\u0430 24 \u0447\u0430\u0441\u0430',
  appAppointments: '\u0417\u0430\u043f\u0438\u0441\u0435\u0439 \u0447\u0435\u0440\u0435\u0437 App',
  sourceApp: '\u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a Negis App',
  qrArrivals: 'QR-\u043f\u0440\u0438\u0445\u043e\u0434\u043e\u0432',
  confirmed: '\u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u043e',
  bonusesEarned: '\u0411\u043e\u043d\u0443\u0441\u043e\u0432 \u043d\u0430\u0447\u0438\u0441\u043b\u0435\u043d\u043e',
  period: '\u0437\u0430 \u043f\u0435\u0440\u0438\u043e\u0434',
  activePromotions: '\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u0430\u043a\u0446\u0438\u0439',
  afterModeration: '\u043f\u043e\u0441\u043b\u0435 \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u0438',
  registrationsByDay: '\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438 \u043a\u043b\u0438\u0435\u043d\u0442\u043e\u0432 \u043f\u043e \u0434\u043d\u044f\u043c',
  bonusEconomy: '\u0411\u043e\u043d\u0443\u0441\u043d\u0430\u044f \u044d\u043a\u043e\u043d\u043e\u043c\u0438\u043a\u0430',
  spentBonuses: '\u0421\u043f\u0438\u0441\u0430\u043d\u043e \u0431\u043e\u043d\u0443\u0441\u043e\u0432',
  completedTasks: '\u0412\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e \u0437\u0430\u0434\u0430\u043d\u0438\u0439',
  loyaltyBusinesses: '\u0411\u0438\u0437\u043d\u0435\u0441\u043e\u0432 \u0432 \u043b\u043e\u044f\u043b\u044c\u043d\u043e\u0441\u0442\u0438',
  active7d: '\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u0437\u0430 7 \u0434\u043d\u0435\u0439',
  clientsTitle: '\u041a\u043b\u0438\u0435\u043d\u0442\u044b \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u044f',
  appointmentsTitle: '\u041e\u043d\u043b\u0430\u0439\u043d-\u0437\u0430\u043f\u0438\u0441\u0438 \u0438\u0437 Negis App',
  qrTitle: 'QR-\u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u044f \u043f\u0440\u0438\u0445\u043e\u0434\u0430',
  tasksTitle: '\u0417\u0430\u0434\u0430\u043d\u0438\u044f \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u044f',
  promotionsTitle: '\u0410\u043a\u0446\u0438\u0438 \u0438 \u0440\u0435\u043a\u043b\u0430\u043c\u0430',
  moderationTitle: '\u041c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u044f',
  partnersTitle: '\u041f\u0430\u0440\u0442\u043d\u0435\u0440\u044b \u0438 \u0431\u0438\u0437\u043d\u0435\u0441\u044b \u0432 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0438',
  globalBonusRules: '\u0413\u043b\u043e\u0431\u0430\u043b\u044c\u043d\u044b\u0435 \u043f\u0440\u0430\u0432\u0438\u043b\u0430 \u0431\u043e\u043d\u0443\u0441\u043e\u0432',
  appModules: '\u041c\u043e\u0434\u0443\u043b\u0438 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u044f',
  financialLimits: '\u0424\u0438\u043d\u0430\u043d\u0441\u043e\u0432\u044b\u0435 \u043b\u0438\u043c\u0438\u0442\u044b',
  financialLimitsHint: '\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f \u043f\u0440\u0430\u0432\u0438\u043b \u0431\u043e\u043d\u0443\u0441\u043e\u0432 \u0434\u043e\u043b\u0436\u043d\u044b \u043b\u043e\u0433\u0438\u0440\u043e\u0432\u0430\u0442\u044c\u0441\u044f \u0438 \u043f\u0440\u0438\u043c\u0435\u043d\u044f\u0442\u044c\u0441\u044f \u0442\u043e\u043b\u044c\u043a\u043e \u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u0449\u0438\u0449\u0435\u043d\u043d\u044b\u0439 Admin API.',
  enabled: '\u0432\u043a\u043b\u044e\u0447\u0435\u043d\u044b',
  disabled: '\u0432\u044b\u043a\u043b\u044e\u0447\u0435\u043d\u044b'
};

const clientColumns = ['\u0418\u043c\u044f', '\u0422\u0435\u043b\u0435\u0444\u043e\u043d', '\u0413\u043e\u0440\u043e\u0434', '\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044f', '\u0411\u043e\u043d\u0443\u0441\u044b', '\u0417\u0430\u043f\u0438\u0441\u0435\u0439', '\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 \u0432\u0438\u0437\u0438\u0442', '\u0421\u0442\u0430\u0442\u0443\u0441'];
const appointmentColumns = ['\u041a\u043b\u0438\u0435\u043d\u0442', '\u0411\u0438\u0437\u043d\u0435\u0441', '\u0424\u0438\u043b\u0438\u0430\u043b', '\u0423\u0441\u043b\u0443\u0433\u0430', '\u0421\u043f\u0435\u0446\u0438\u0430\u043b\u0438\u0441\u0442', '\u0414\u0430\u0442\u0430', '\u0412\u0440\u0435\u043c\u044f', '\u0421\u0442\u0430\u0442\u0443\u0441', '\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a', 'QR'];
const qrColumns = ['\u0417\u0430\u043f\u0438\u0441\u044c', '\u041a\u043b\u0438\u0435\u043d\u0442', '\u0411\u0438\u0437\u043d\u0435\u0441', '\u0421\u043a\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043b', '\u0412\u0440\u0435\u043c\u044f', 'QR \u0441\u0442\u0430\u0442\u0443\u0441', '\u0423\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u043e/IP', '\u0420\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442'];
const bonusColumns = ['\u041a\u043b\u0438\u0435\u043d\u0442', '\u0411\u0438\u0437\u043d\u0435\u0441', '\u0422\u0438\u043f', '\u0421\u0443\u043c\u043c\u0430', '\u041f\u0440\u0438\u0447\u0438\u043d\u0430', '\u0417\u0430\u043f\u0438\u0441\u044c', '\u0414\u0430\u0442\u0430', '\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440/\u0441\u0438\u0441\u0442\u0435\u043c\u0430'];
const taskColumns = ['\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435', '\u0422\u0438\u043f', '\u041d\u0430\u0433\u0440\u0430\u0434\u0430', '\u0421\u0440\u043e\u043a', '\u041b\u0438\u043c\u0438\u0442', '\u0411\u0438\u0437\u043d\u0435\u0441', '\u0421\u0442\u0430\u0442\u0443\u0441'];
const promoColumns = ['\u0411\u0438\u0437\u043d\u0435\u0441', '\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435', '\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f', '\u0413\u043e\u0440\u043e\u0434', '\u0421\u0442\u0430\u0440\u0442', '\u041e\u043a\u043e\u043d\u0447\u0430\u043d\u0438\u0435', '\u0421\u0442\u0430\u0442\u0443\u0441', '\u041c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u044f'];
const moderationColumns = ['\u0422\u0438\u043f', '\u0411\u0438\u0437\u043d\u0435\u0441', '\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435', '\u0421\u043e\u0437\u0434\u0430\u043d\u043e', '\u0421\u0442\u0430\u0442\u0443\u0441', '\u0420\u0438\u0441\u043a'];
const partnerColumns = ['\u0411\u0438\u0437\u043d\u0435\u0441', '\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f', '\u0413\u043e\u0440\u043e\u0434', '\u0412 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0438', '\u041b\u043e\u044f\u043b\u044c\u043d\u043e\u0441\u0442\u044c', '\u041f\u0440\u0438\u043d\u0438\u043c\u0430\u0435\u0442 \u0431\u043e\u043d\u0443\u0441\u044b', '\u041c\u0430\u043a\u0441. % \u0431\u043e\u043d\u0443\u0441\u0430\u043c\u0438', '\u0410\u043a\u0446\u0438\u0439'];

function AppDashboardPage() {
  const dashboard = useQuery({ queryKey: ['admin-app-dashboard'], queryFn: () => api<AppDashboard>('/api/admin/app/dashboard') });
  const data = dashboard.data;

  if (dashboard.isLoading) return <SkeletonGrid />;

  return (
    <section className="page-stack">
      <AppSectionNotice />
      <div className="metrics-grid">
        <MetricCard icon={<Users />} label={appLabels.appClients} value={data?.metrics.totalClients || 0} hint={appLabels.total} />
        <MetricCard icon={<Activity />} label={appLabels.active24h} value={data?.metrics.active24h || 0} hint="mobile app" />
        <MetricCard icon={<CalendarClock />} label={appLabels.appAppointments} value={data?.metrics.appAppointments || 0} hint={appLabels.sourceApp} />
        <MetricCard icon={<QrCode />} label={appLabels.qrArrivals} value={data?.metrics.qrArrivals || 0} hint={appLabels.confirmed} />
        <MetricCard icon={<WalletCards />} label={appLabels.bonusesEarned} value={data?.metrics.bonusesEarned || 0} hint={appLabels.period} />
        <MetricCard icon={<Megaphone />} label={appLabels.activePromotions} value={data?.metrics.activePromotions || 0} hint={appLabels.afterModeration} />
      </div>
      <div className="content-grid wide-left">
        <section className="neu panel">
          <PanelHeader title={appLabels.registrationsByDay} />
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data?.clientRegistrations || []}>
              <CartesianGrid stroke="#d7dde8" strokeDasharray="4 4" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line dataKey="count" stroke="#1A56DB" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </section>
        <section className="neu panel">
          <PanelHeader title={appLabels.bonusEconomy} />
          <InfoRows
            rows={[
              [appLabels.spentBonuses, String(data?.metrics.bonusesSpent || 0)],
              [appLabels.completedTasks, String(data?.metrics.completedTasks || 0)],
              [appLabels.loyaltyBusinesses, String(data?.metrics.loyaltyBusinesses || 0)],
              [appLabels.active7d, String(data?.metrics.active7d || 0)]
            ]}
          />
        </section>
      </div>
    </section>
  );
}

function AppSectionNotice() {
  return <div className="notice app-notice">{appLabels.notice}</div>;
}

function AppClientsPage() {
  const clients = useQuery({ queryKey: ['admin-app-clients'], queryFn: () => api<{ clients: AppClient[] }>('/api/admin/app/clients') });
  return <DataPage title={appLabels.clientsTitle} rows={clients.data?.clients || []} columns={clientColumns} render={(client) => [client.name, client.phone, client.city, formatDate(client.registeredAt), client.bonusBalance, client.appointmentsCount, formatDate(client.lastVisit), statusLabel(client.status)]} />;
}

function AppAppointmentsPage() {
  const appointments = useQuery({ queryKey: ['admin-app-appointments'], queryFn: () => api<{ appointments: AppAppointment[] }>('/api/admin/app/appointments') });
  return <DataPage title={appLabels.appointmentsTitle} rows={appointments.data?.appointments || []} columns={appointmentColumns} render={(item) => [item.client, item.business, item.branch, item.service, item.specialist, formatDate(item.date), item.time, statusLabel(item.status), item.source, item.qrStatus]} />;
}

function AppQrPage() {
  const qr = useQuery({ queryKey: ['admin-app-qr'], queryFn: () => api<{ qrCheckins: QrCheckin[] }>('/api/admin/app/qr-checkins') });
  return <DataPage title={appLabels.qrTitle} rows={qr.data?.qrCheckins || []} columns={qrColumns} render={(item) => [item.appointment, item.client, item.business, item.scannedBy, formatTime(item.scannedAt), item.qrStatus, item.device, item.result]} />;
}

function AppBonusesPage() {
  const bonuses = useQuery({ queryKey: ['admin-app-bonuses'], queryFn: () => api<{ transactions: BonusTransaction[] }>('/api/admin/app/bonus-transactions') });
  return <DataPage title={appLabels.bonusEconomy} rows={bonuses.data?.transactions || []} columns={bonusColumns} render={(item) => [item.client, item.business, item.type, item.amount, item.reason, item.appointment, formatDate(item.createdAt), item.actor]} />;
}

function AppTasksPage() {
  const tasks = useQuery({ queryKey: ['admin-app-tasks'], queryFn: () => api<{ tasks: AppTask[] }>('/api/admin/app/tasks') });
  return <DataPage title={appLabels.tasksTitle} rows={tasks.data?.tasks || []} columns={taskColumns} render={(task) => [task.title, task.type, task.reward, formatDate(task.expiresAt), task.limit, task.business, statusLabel(task.status)]} />;
}

function AppPromotionsPage() {
  const promotions = useQuery({ queryKey: ['admin-app-promotions'], queryFn: () => api<{ promotions: AppPromotion[] }>('/api/admin/app/promotions') });
  return <DataPage title={appLabels.promotionsTitle} rows={promotions.data?.promotions || []} columns={promoColumns} render={(promo) => [promo.business, promo.title, promo.category, promo.city, formatDate(promo.startsAt), formatDate(promo.endsAt), statusLabel(promo.status), promo.moderationStatus]} />;
}

function AppModerationPage() {
  const moderation = useQuery({ queryKey: ['admin-app-moderation'], queryFn: () => api<{ items: ModerationItem[] }>('/api/admin/app/moderation') });
  return <DataPage title={appLabels.moderationTitle} rows={moderation.data?.items || []} columns={moderationColumns} render={(item) => [item.type, item.business, item.title, formatDate(item.createdAt), statusLabel(item.status), item.risk]} />;
}

function AppPartnersPage() {
  const partners = useQuery({ queryKey: ['admin-app-partners'], queryFn: () => api<{ businesses: AppBusiness[] }>('/api/admin/app/businesses') });
  return <DataPage title={appLabels.partnersTitle} rows={partners.data?.businesses || []} columns={partnerColumns} render={(business) => [business.name, business.category, business.city, business.visibleInApp, business.loyaltyEnabled, business.bonusSpendEnabled, business.maxBonusPercent, business.promotionsCount]} />;
}

function AppSettingsPage() {
  const settings = useQuery({ queryKey: ['admin-app-settings'], queryFn: () => api<AppSettings>('/api/admin/app/settings') });
  const data = settings.data;

  return (
    <section className="page-stack settings-grid">
      <AppSectionNotice />
      <section className="neu panel">
        <PanelHeader title={appLabels.globalBonusRules} />
        <InfoRows
          rows={[
            ['\u041c\u0430\u043a\u0441\u0438\u043c\u0443\u043c \u043e\u043f\u043b\u0430\u0442\u044b \u0431\u043e\u043d\u0443\u0441\u0430\u043c\u0438', `${data?.maxBonusPercent ?? 50}%`],
            ['\u0411\u043e\u043d\u0443\u0441\u044b \u0437\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044e', String(data?.registrationBonus ?? 0)],
            ['\u0411\u043e\u043d\u0443\u0441\u044b \u0437\u0430 \u043f\u0435\u0440\u0432\u044b\u0439 \u0432\u0438\u0437\u0438\u0442', String(data?.firstVisitBonus ?? 0)],
            ['\u0411\u043e\u043d\u0443\u0441\u044b \u0437\u0430 \u043e\u0442\u0437\u044b\u0432', String(data?.reviewBonus ?? 0)],
            ['\u0411\u043e\u043d\u0443\u0441\u044b \u0437\u0430 \u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u0435 \u0434\u0440\u0443\u0433\u0430', String(data?.referralBonus ?? 0)],
            ['\u0421\u0440\u043e\u043a \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f \u0431\u043e\u043d\u0443\u0441\u043e\u0432', `${data?.bonusTtlDays ?? 0} \u0434\u043d\u0435\u0439`]
          ]}
        />
      </section>
      <section className="neu panel">
        <PanelHeader title={appLabels.appModules} />
        <InfoRows rows={[[appLabels.tasksTitle, data?.tasksEnabled ? appLabels.enabled : appLabels.disabled], [appLabels.promotionsTitle, data?.promotionsEnabled ? appLabels.enabled : appLabels.disabled], ['Push-\u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f', data?.pushEnabled ? appLabels.enabled : appLabels.disabled]]} />
      </section>
      <section className="danger-zone neu">
        <AlertTriangle />
        <div>
          <h3>{appLabels.financialLimits}</h3>
          <p>{appLabels.financialLimitsHint}</p>
        </div>
      </section>
    </section>
  );
}

function BillingPage() {
  const navigate = useNavigate();
  const subscriptions = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () =>
      api<{
        subscriptions: Array<{ id: string; clinicId: string; clinic: string; plan: string; startsAt: string; endsAt: string; amount: number; status: string }>;
        plans: Plan[];
      }>('/api/subscriptions')
  });
  const finances = useQuery({
    queryKey: ['finances'],
    queryFn: () =>
      api<{
        revenueMonth: number;
        revenuePrevious: number;
        forecast: number;
        byMonth: Array<{ month: string; revenue: number }>;
        byPlan: Array<{ name: string; value: number }>;
        payments: PaymentRow[];
      }>('/api/finances')
  });
  const subscriptionRows = subscriptions.data?.subscriptions || [];
  const activeSubscriptions = subscriptionRows.filter((sub) => sub.status === 'active');
  const expiringSoon = subscriptionRows.filter((sub) => {
    if (!sub.endsAt) return false;
    const daysLeft = (new Date(sub.endsAt).getTime() - Date.now()) / 86400000;
    return daysLeft >= 0 && daysLeft <= 7;
  }).length;

  return (
    <section className="page-stack">
      <ModuleHero kicker="BILLING OS" title="Биллинг и тарифы" text="Счета, подписки, пробные периоды, лимиты пакетов и прогноз выручки." accent="B" />
      <div className="metrics-grid four">
        <MetricCard icon={<CheckCircle2 />} label="Активные подписки" value={activeSubscriptions.length} hint="оплаченный доступ" />
        <MetricCard icon={<CalendarClock />} label="Истекают скоро" value={expiringSoon} hint="следующие 7 дней" />
        <MetricCard icon={<CircleDollarSign />} label="MRR" value={formatMoney(finances.data?.revenueMonth || 0)} hint="текущий месяц" />
        <MetricCard icon={<BadgeDollarSign />} label="Прогноз" value={formatMoney(finances.data?.forecast || 0)} hint="следующий месяц" />
      </div>
      <div className="content-grid wide-left">
        <section className="neu panel">
          <PanelHeader title="Выручка по месяцам" />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={finances.data?.byMonth || []}>
              <CartesianGrid stroke="#d7dde8" strokeDasharray="4 4" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="revenue" fill="#0f62fe" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="neu panel">
          <PanelHeader title="Пакеты SaaS" action="Start / Pro / Max" />
          <div className="tariff-stack">
            {(subscriptions.data?.plans || []).map((plan) => (
              <div className="tariff-row" key={plan.name}>
                <span>{plan.name.slice(0, 1)}</span>
                <div>
                  <strong>{plan.name}</strong>
                  <p>{plan.limits}</p>
                </div>
                <b>{formatMoney(plan.price)}</b>
              </div>
            ))}
          </div>
        </section>
      </div>
      <DataPage
        title="Подписки организаций"
        rows={subscriptionRows}
        columns={['Организация', 'Тариф', 'Начало', 'Окончание', 'Сумма', 'Статус']}
        render={(sub) => [sub.clinic, sub.plan, formatDate(sub.startsAt), formatDate(sub.endsAt), formatMoney(sub.amount), statusLabel(sub.status)]}
        actionLabel="Открыть организацию"
        onOpen={(sub) => navigate(`/clinics/${sub.clinicId}`)}
        embedded
      />
      <DataPage
        title="История платежей"
        rows={finances.data?.payments || []}
        columns={['Организация', 'Тариф', 'Сумма', 'Метод', 'Дата', 'Статус']}
        render={(payment) => [payment.clinic, payment.plan, formatPaymentAmount(payment), payment.method, formatDate(payment.createdAt), statusLabel(payment.status)]}
        actionLabel="Организация"
        onOpen={(payment) => navigate(`/clinics/${payment.clinicId}`)}
        embedded
      />
    </section>
  );
}

function AnalyticsPage() {
  const overview = useQuery({ queryKey: ['overview'], queryFn: () => api<Overview>('/api/overview') });
  const finances = useQuery({ queryKey: ['finances'], queryFn: () => api<{ revenueMonth: number; forecast: number; byMonth: Array<{ month: string; revenue: number }>; byPlan: Array<{ name: string; value: number }> }>('/api/finances') });
  const data = overview.data;
  const avgLeads = data?.metrics.totalClinics ? Math.round(data.metrics.totalLeads / data.metrics.totalClinics) : 0;

  return (
    <section className="page-stack">
      <ModuleHero kicker="ANALYTICS" title="SaaS-аналитика" text="Рост, активность организаций, MRR, источники лидов и продуктовые сигналы для решений." accent="A" />
      <div className="metrics-grid four">
        <MetricCard icon={<CircleDollarSign />} label="MRR" value={formatMoney(finances.data?.revenueMonth || 0)} hint="месячная выручка" />
        <MetricCard icon={<Activity />} label="Средне лидов" value={avgLeads} hint="на организацию" />
        <MetricCard icon={<Building2 />} label="Организации" value={data?.metrics.totalClinics || 0} hint="в базе" />
        <MetricCard icon={<CalendarClock />} label="Новые 7д" value={data?.metrics.newClinics7d || 0} hint="темп роста" />
      </div>
      <div className="content-grid wide-left">
        <section className="neu panel">
          <PanelHeader title="Рост выручки" />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={finances.data?.byMonth || []}>
              <CartesianGrid stroke="#d7dde8" strokeDasharray="4 4" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="revenue" fill="#6d5dfc" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="neu panel">
          <PanelHeader title="Выручка по тарифам" />
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={finances.data?.byPlan || []} dataKey="value" nameKey="name" innerRadius={52} outerRadius={92} paddingAngle={4}>
                {(finances.data?.byPlan || []).map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </section>
      </div>
    </section>
  );
}

function MonitoringPage() {
  const logs = useQuery({ queryKey: ['logs'], queryFn: () => api<{ logs: Array<{ id: string; time: string; clinic: string; user: string; action: string; details: string; ip: string }> }>('/api/logs') });
  const logRows = logs.data?.logs || [];
  const critical = logRows.filter((log) => /delete|blocked|error|fail|remove/i.test(`${log.action} ${log.details}`)).length;

  return (
    <section className="page-stack">
      <ModuleHero kicker="OPS MONITOR" title="Мониторинг и аудит" text="Техническое здоровье, ошибки, входы, критические действия и история изменений." accent="M" />
      <div className="metrics-grid four">
        <MetricCard icon={<ShieldCheck />} label="Статус" value="ONLINE" hint="админка отвечает" />
        <MetricCard icon={<ShieldAlert />} label="Критичные события" value={critical} hint="по логам" />
        <MetricCard icon={<Activity />} label="Записей лога" value={logRows.length} hint="super_logs" />
        <MetricCard icon={<Clock3 />} label="Последняя запись" value={logRows[0] ? formatTime(logRows[0].time) : '—'} hint="аудит" />
      </div>
      <DataPage
        title="Аудит действий"
        rows={logRows}
      columns={['Время', 'Организация', 'Пользователь', 'Действие', 'Детали', 'IP']}
        render={(log) => [formatTime(log.time), log.clinic, log.user, log.action, log.details, log.ip]}
        embedded
      />
    </section>
  );
}

function SupportPage() {
  return (
    <SaaSModulePage
      kicker="SUPPORT DESK"
      title="Поддержка организаций"
      accent="S"
      text="Единая очередь заявок: подключение, перенос базы, рекламные аккаунты, ошибки CRM и коммуникация."
      cards={[
        ['Новые заявки', '0', 'ожидает support API'],
        ['В работе', '0', 'назначение ответственных'],
        ['SLA', '0', 'контроль реакции'],
        ['Эскалации', '0', 'критичные организации']
      ]}
      blocks={[
        ['Очередь обращений', 'Заявки организаций, статусы, ответственные, комментарии и история общения.'],
        ['Быстрые действия', 'Открыть организацию, войти в CRM, создать задачу, отправить письмо владельцу.'],
        ['База решений', 'Инструкции для импорта лидов, Facebook/TikTok, WhatsApp и восстановления доступа.']
      ]}
    />
  );
}

function IntegrationsPage() {
  const [connect, setConnect] = useState<{ name: string; type: string } | null>(null);
  const integrations = [
    { name: 'Facebook Ads', type: 'ads', status: 'готово к подключению', hint: 'лиды, пиксель, события' },
    { name: 'TikTok Ads', type: 'ads', status: 'готово к подключению', hint: 'лиды и события' },
    { name: 'WhatsApp', type: 'messenger', status: 'ожидает ключи', hint: 'уведомления и диалоги' },
    { name: 'Email / Zoho', type: 'email', status: 'можно настроить', hint: 'сброс пароля и счета' },
    { name: 'External API', type: 'api', status: 'доступно', hint: 'webhooks и API-ключи' },
    { name: 'Google Sheets', type: 'export', status: 'доступно', hint: 'импорт и экспорт лидов' }
  ];

  return (
    <section className="page-stack">
      <ModuleHero kicker="INTEGRATION HUB" title="Интеграции" text="Рабочий центр подключений: реклама, мессенджеры, email, внешние API, webhooks и домены." accent="I" />
      <section className="integration-grid">
        {integrations.map((item) => (
          <article className="integration-card neu" key={item.name}>
            <span>{item.name.slice(0, 2).toUpperCase()}</span>
            <div>
              <h3>{item.name}</h3>
              <p>{item.hint}</p>
              <small>{item.status}</small>
            </div>
            <button className="neu-btn-primary" onClick={() => setConnect({ name: item.name, type: item.type })}>Подключить</button>
          </article>
        ))}
      </section>
      <section className="module-grid">
        <article className="module-card neu">
          <span>01</span>
          <h3>Наш Admin API</h3>
          <p>Здесь будут API-ключи Negis Control, подписи запросов, лимиты и журнал входящих событий.</p>
          <button className="neu-btn" onClick={() => setConnect({ name: 'Negis Admin API', type: 'api' })}>Создать ключ</button>
        </article>
        <article className="module-card neu">
          <span>02</span>
          <h3>Webhooks</h3>
          <p>Добавление внешнего URL, секрет подписи, повторная отправка ошибок и тестовый ping.</p>
          <button className="neu-btn" onClick={() => setConnect({ name: 'Webhook endpoint', type: 'webhook' })}>Добавить webhook</button>
        </article>
        <article className="module-card neu">
          <span>03</span>
          <h3>Домены и пиксели</h3>
          <p>crm.negis.online, admin.negis.online, пиксели Meta/TikTok и проверка домена.</p>
          <button className="neu-btn" onClick={() => setConnect({ name: 'Domains and Pixels', type: 'domain' })}>Настроить</button>
        </article>
      </section>
      {connect && <IntegrationModal integration={connect} onClose={() => setConnect(null)} />}
    </section>
  );
}

function IntegrationModal({ integration, onClose }: { integration: { name: string; type: string }; onClose: () => void }) {
  const [apiKey, setApiKey] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [secret, setSecret] = useState('');
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card neu-lg">
        <div className="panel-header">
          <h3>{integration.name}</h3>
          <button className="icon-button neu-sm" onClick={onClose} type="button">×</button>
        </div>
        <p className="modal-copy">Активная заглушка подключения. Сейчас данные не отправляются во внешний сервис, но форма готова под backend endpoint.</p>
        <div className="modal-form">
          <label><span>API Key / Token</span><input className="neu-input" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk_live_..." /></label>
          <label><span>Webhook URL</span><input className="neu-input" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="https://example.com/webhook" /></label>
          <label><span>Secret</span><input className="neu-input" value={secret} onChange={(event) => setSecret(event.target.value)} placeholder="signature secret" /></label>
        </div>
        <div className="modal-actions">
          <button className="neu-btn" onClick={() => toast.info('Тестовый запрос подготовлен. Подключите backend endpoint для реальной отправки.')}>Тестировать</button>
          <button className="neu-btn-primary" onClick={() => { toast.success('Интеграция сохранена как черновик'); onClose(); }}>Сохранить черновик</button>
        </div>
      </div>
    </div>
  );
}

function TeamPage() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [permissionsMember, setPermissionsMember] = useState<TeamMember | null>(null);
  const queryClient = useQueryClient();
  const team = useQuery({
    queryKey: ['team'],
    queryFn: () => api<{ members: TeamMember[] }>('/api/team')
  });
  const invite = useMutation({
    mutationFn: (payload: { email: string; role: string; name?: string }) =>
      api<{ member: TeamMember }>('/api/team/invite', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      toast.success('Приглашение отправлено на почту');
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setInviteOpen(false);
    },
    onError: (error) => toast.error(error.message)
  });
  const updatePermissions = useMutation({
    mutationFn: (payload: { id: string; role: string; permissions: TeamMember['permissions'] }) =>
      api<{ member: TeamMember }>(`/api/team/${payload.id}/permissions`, {
        method: 'PATCH',
        body: JSON.stringify({ role: payload.role, permissions: payload.permissions })
      }),
    onSuccess: () => {
      toast.success('Права сотрудника сохранены');
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setPermissionsMember(null);
    },
    onError: (error) => toast.error(error.message)
  });
  const deleteMember = useMutation({
    mutationFn: (member: TeamMember) => api<{ ok: boolean }>(`/api/team/${member.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Сотрудник удален из команды');
      queryClient.invalidateQueries({ queryKey: ['team'] });
    },
    onError: (error) => toast.error(error.message)
  });
  const members = team.data?.members || [];
  const ownerCount = members.filter((member) => member.role === 'Owner').length;

  return (
    <section className="page-stack">
      <ModuleHero
        kicker="ACCESS CONTROL"
        title="Команда Negis"
        text="Это реальные доступы вашей команды. Приглашение сохраняется в Supabase, письмо отправляется с negissupport@negis.online, а права задаются по разделам."
        accent="T"
      />
      <div className="metrics-grid four">
        <MetricCard icon={<Users />} label="Члены команды" value={members.length} hint="реальные данные" />
        <MetricCard icon={<ShieldCheck />} label="Owner" value={ownerCount || 1} hint="главный доступ" />
        <MetricCard icon={<Lock />} label="Модель прав" value="RBAC" hint="просмотр и редактирование" />
        <MetricCard icon={<Activity />} label="Аудит" value="ON" hint="приглашения и права" />
      </div>
      <section className="neu panel">
        <PanelHeader title="Внутренняя команда" action="права доступа" />
        {team.isLoading ? (
          <div className="empty-state"><h3>Загружаем команду</h3><p>Получаем реальные данные из Supabase.</p></div>
        ) : team.isError ? (
          <div className="empty-state"><h3>Команда не загружена</h3><p>{team.error instanceof Error ? team.error.message : 'Проверьте Supabase таблицу super_team_members.'}</p></div>
        ) : (
          <div className="team-grid">
            {members.map((member) => (
              <article className="team-card" key={member.id}>
                <span>{member.name.slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>{member.name}</strong>
                  <p>{member.email}</p>
                  <small>{member.role} · {member.status} · письмо: {emailStatusLabel(member)}</small>
                  {member.emailError ? <small className="team-error">{member.emailError}</small> : null}
                </div>
                <div className="team-actions">
                  <button className="mini-button" disabled={member.id === 'owner'} onClick={() => setPermissionsMember(member)} type="button">Права</button>
                  <button
                    className="mini-button danger"
                    disabled={member.id === 'owner' || deleteMember.isPending}
                    onClick={() => {
                      if (window.confirm(`Удалить сотрудника ${member.email} из команды Negis?`)) {
                        deleteMember.mutate(member);
                      }
                    }}
                    type="button"
                  >
                    Удалить
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        <button className="neu-btn-primary" onClick={() => setInviteOpen(true)}>Пригласить сотрудника Negis</button>
      </section>
      {inviteOpen && (
        <TeamInviteModal
          isSending={invite.isPending}
          onClose={() => setInviteOpen(false)}
          onInvite={(payload) => invite.mutate(payload)}
        />
      )}
      {permissionsMember && (
        <TeamPermissionsModal
          member={permissionsMember}
          isSaving={updatePermissions.isPending}
          onClose={() => setPermissionsMember(null)}
          onSave={(payload) => updatePermissions.mutate(payload)}
        />
      )}
    </section>
  );
}

function emailStatusLabel(member: TeamMember) {
  if (member.emailStatus === 'sent') return 'отправлено';
  if (member.emailStatus === 'failed') return 'ошибка SMTP';
  if (member.emailStatus === 'pending') return 'отправляется';
  if (member.emailStatus === 'owner') return 'owner';
  return 'не отправлено';
}

function TeamInviteModal({
  isSending,
  onClose,
  onInvite
}: {
  isSending: boolean;
  onClose: () => void;
  onInvite: (payload: { email: string; role: string; name?: string }) => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Support');

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card neu-lg">
        <div className="panel-header">
          <h3>Пригласить сотрудника</h3>
          <button className="icon-button neu-sm" onClick={onClose} type="button">×</button>
        </div>
        <p className="modal-copy">На почту придет письмо: «Добро пожаловать в Negis System» с указанной должностью.</p>
        <div className="modal-form">
          <label><span>Имя</span><input className="neu-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Имя сотрудника" /></label>
          <label><span>Email</span><input className="neu-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="manager@negis.online" /></label>
          <label><span>Роль / должность</span><select value={role} onChange={(event) => setRole(event.target.value)}>{teamRoles.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
        <div className="modal-actions">
          <button className="neu-btn" onClick={onClose} type="button">Отмена</button>
          <button className="neu-btn-primary" disabled={isSending || !email.includes('@')} onClick={() => onInvite({ email, role, name })} type="button">
            {isSending ? 'Отправляем' : 'Отправить приглашение'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamPermissionsModal({
  member,
  isSaving,
  onClose,
  onSave
}: {
  member: TeamMember;
  isSaving: boolean;
  onClose: () => void;
  onSave: (payload: { id: string; role: string; permissions: TeamMember['permissions'] }) => void;
}) {
  const [role, setRole] = useState(member.role);
  const [permissions, setPermissions] = useState<TeamMember['permissions']>(member.permissions || {});
  const setLevel = (section: string, level: 'none' | 'view' | 'edit') => setPermissions((current) => ({ ...current, [section]: level }));

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card neu-lg permissions-modal">
        <div className="panel-header">
          <h3>Права сотрудника</h3>
          <button className="icon-button neu-sm" onClick={onClose} type="button">×</button>
        </div>
        <p className="modal-copy">{member.name} · {member.email}</p>
        <div className="modal-form">
          <label><span>Роль / должность</span><select value={role} onChange={(event) => setRole(event.target.value)}>{teamRoles.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
        <div className="permissions-grid">
          {teamPermissionSections.map(([section, label]) => (
            <div className="permission-row" key={section}>
              <strong>{label}</strong>
              <div className="permission-options">
                <button className={permissions[section] === 'none' ? 'active' : ''} onClick={() => setLevel(section, 'none')} type="button">Нет</button>
                <button className={permissions[section] === 'view' ? 'active' : ''} onClick={() => setLevel(section, 'view')} type="button">Просмотр</button>
                <button className={permissions[section] === 'edit' ? 'active' : ''} onClick={() => setLevel(section, 'edit')} type="button">Редактирование</button>
              </div>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="neu-btn" onClick={onClose} type="button">Отмена</button>
          <button className="neu-btn-primary" disabled={isSaving} onClick={() => onSave({ id: member.id, role, permissions })} type="button">
            {isSaving ? 'Сохраняем' : 'Сохранить права'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SaaSModulePage({ kicker, title, text, accent, cards, blocks }: { kicker: string; title: string; text: string; accent: string; cards: Array<[string, string, string]>; blocks: Array<[string, string]> }) {
  return (
    <section className="page-stack">
      <ModuleHero kicker={kicker} title={title} text={text} accent={accent} />
      <div className="metrics-grid four">
        {cards.map(([label, value, hint]) => (
          <MetricCard key={label} icon={<CheckCircle2 />} label={label} value={value} hint={hint} />
        ))}
      </div>
      <section className="module-grid">
        {blocks.map(([blockTitle, blockText], index) => (
          <article className="module-card neu" key={blockTitle}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <h3>{blockTitle}</h3>
            <p>{blockText}</p>
          </article>
        ))}
      </section>
    </section>
  );
}

function ModuleHero({ kicker, title, text, accent }: { kicker: string; title: string; text: string; accent: string }) {
  return (
    <section className="module-hero neu-lg">
      <div>
        <span className="section-kicker">{kicker}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      <div className="hero-monogram">{accent}</div>
    </section>
  );
}

function SettingsPage() {
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () =>
      api<{
        profile: { email: string };
        platform: { name: string; supportEmail: string; trialDays: number; defaultPlan: string; mainAppUrl: string };
      }>('/api/settings')
  });
  const [supportEmail, setSupportEmail] = useState('');
  const [trialDays, setTrialDays] = useState('');
  const [defaultPlan, setDefaultPlan] = useState('');
  const [mainAppUrl, setMainAppUrl] = useState('');

  useEffect(() => {
    if (!settings.data) return;
    setSupportEmail(settings.data.platform.supportEmail || '');
    setTrialDays(String(settings.data.platform.trialDays || 14));
    setDefaultPlan(settings.data.platform.defaultPlan || 'Basic');
    setMainAppUrl(settings.data.platform.mainAppUrl || '');
  }, [settings.data]);

  const saveSettings = () => {
    toast.success('Настройки подготовлены к сохранению. Подключите PATCH /api/settings для записи в базу.');
  };

  return (
    <section className="page-stack settings-grid">
      <ModuleHero kicker="PLATFORM SETTINGS" title="Настройки платформы" text="Глобальные параметры Negis Control: домены, email, trial, тариф по умолчанию и безопасные действия." accent="S" />
      <section className="neu panel">
        <PanelHeader title="Профиль Super Admin" />
        <InfoRows rows={[['Email', settings.data?.profile.email || '—'], ['Роль', 'super_admin']]} />
      </section>
      <section className="neu panel">
        <PanelHeader title="Редактируемые настройки" action="активная форма" />
        <div className="settings-form">
          <label><span>Support email</span><input className="neu-input" value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} /></label>
          <label><span>Trial, дней</span><input className="neu-input" type="number" value={trialDays} onChange={(event) => setTrialDays(event.target.value)} /></label>
          <label><span>Тариф по умолчанию</span><input className="neu-input" value={defaultPlan} onChange={(event) => setDefaultPlan(event.target.value)} /></label>
          <label><span>Main CRM URL</span><input className="neu-input" value={mainAppUrl} onChange={(event) => setMainAppUrl(event.target.value)} /></label>
        </div>
        <div className="modal-actions">
          <button className="neu-btn" onClick={() => settings.refetch()}>Сбросить</button>
          <button className="neu-btn-primary" onClick={saveSettings}>Сохранить настройки</button>
        </div>
      </section>
      <section className="module-grid">
        <article className="module-card neu"><span>01</span><h3>Безопасность</h3><p>Сессии, доступ команды, аудит опасных действий и ограничения по ролям.</p><button className="neu-btn" onClick={() => toast.info('Раздел безопасности будет подключен к Admin API')}>Открыть</button></article>
        <article className="module-card neu"><span>02</span><h3>Уведомления</h3><p>Email-отправитель, шаблоны счетов, восстановление пароля и системные письма.</p><button className="neu-btn" onClick={() => toast.info('Редактор уведомлений будет подключен к backend')}>Редактировать</button></article>
        <article className="module-card neu"><span>03</span><h3>Danger Zone</h3><p>Удаление организаций, массовые операции и финансовые правила требуют подтверждения и логирования.</p><button className="neu-btn-danger" onClick={() => toast.warning('Danger Zone требует отдельного подтверждения')}>Настроить</button></article>
      </section>
    </section>
  );
}

function DataPage<T extends { id: string }>({
  title,
  rows,
  columns,
  render,
  actionLabel = 'Открыть',
  onOpen,
  embedded = false
}: {
  title: string;
  rows: T[];
  columns: string[];
  render: (row: T) => Array<string | number>;
  actionLabel?: string;
  onOpen?: (row: T) => void;
  embedded?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState<T | null>(null);
  const visibleRows = useMemo(
    () => rows.filter((row) => render(row).join(' ').toLowerCase().includes(search.toLowerCase())),
    [rows, render, search]
  );
  const content = (
    <section className="neu panel">
      <PanelHeader title={title} action={`${visibleRows.length} записей`} />
      <div className="toolbar compact">
        <div className="search-field">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск" />
        </div>
        <button className="neu-btn" onClick={() => toast.info('Фильтр применён к текущему списку')}>
          <SlidersHorizontal size={17} />
          Фильтр
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1}>
                  <div className="table-empty">
                    Нет данных. Раздел готов к подключению реального API.
                  </div>
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr key={row.id}>
                  {render(row).map((cell, index) => (
                    <td key={index}>{cell}</td>
                  ))}
                  <td>
                    <button
                      className="mini-button"
                      onClick={() => {
                        if (onOpen) {
                          onOpen(row);
                          return;
                        }
                        setSelectedRow(row);
                      }}
                    >
                      {actionLabel}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {selectedRow && (
        <RowDetailsModal
          title={title}
          columns={columns}
          values={render(selectedRow)}
          onClose={() => setSelectedRow(null)}
        />
      )}
    </section>
  );
  return embedded ? content : <section className="page-stack">{content}</section>;
}

function RowDetailsModal({
  title,
  columns,
  values,
  onClose
}: {
  title: string;
  columns: string[];
  values: Array<string | number>;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal-card neu-lg" onMouseDown={(event) => event.stopPropagation()}>
        <div className="panel-header">
          <h3>{title}</h3>
          <button className="icon-button neu-sm" type="button" onClick={onClose} title="Закрыть">
            ×
          </button>
        </div>
        <InfoRows rows={columns.map((column, index) => [column, String(values[index] ?? '—')])} />
        <div className="modal-actions">
          <button className="neu-btn-primary" type="button" onClick={onClose}>
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <section className="page-stack">
      <div className="metrics-grid">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="skeleton neu" key={index} />
        ))}
      </div>
      <div className="skeleton large neu" />
    </section>
  );
}

function NotFound() {
  return (
    <section className="not-found neu">
      <ShieldAlert size={48} />
      <h1>404</h1>
      <p>Страница не найдена</p>
      <Link className="neu-btn-primary" to="/dashboard">
        На дашборд <ChevronRight size={17} />
      </Link>
    </section>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Shell />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
