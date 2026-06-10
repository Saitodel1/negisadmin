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
  Clock3,
  Copy,
  Eye,
  FileDown,
  Gift,
  Gauge,
  Lock,
  LogOut,
  RefreshCw,
  ReceiptText,
  Search,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  Users
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

const navItems = [
  { label: 'Дашборд', path: '/dashboard', icon: Gauge },
  { label: 'Клиники', path: '/clinics', icon: Building2 },
  { label: 'Пользователи', path: '/users', icon: Users },
  { label: 'Подписки', path: '/subscriptions', icon: BadgeDollarSign },
  { label: 'Финансы', path: '/finances', icon: CircleDollarSign },
  { label: 'Логи', path: '/logs', icon: Activity },
  { label: 'Настройки', path: '/settings', icon: Settings }
];

const colors = ['#1A56DB', '#10B981', '#F59E0B', '#EF4444', '#64748B', '#8B5CF6'];

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

function formatMoney(value = 0) {
  return `${new Intl.NumberFormat('ru-RU').format(value)} ₸`;
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
  toast.success(`Открываем клинику без повторного входа: ${clinic.name}`);
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

  const login = useMutation({
    mutationFn: () => api<Session>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    onSuccess: (session) => {
      queryClient.setQueryData(['session'], session);
      toast.success('Добро пожаловать в Negis Control');
      navigate('/dashboard');
    },
    onError: (error) => toast.error(error.message)
  });

  return (
    <main className={`login-screen admin-entry ${showLogin ? 'is-login-open' : ''}`}>
      {!showLogin ? (
        <section className="admin-landing" aria-label="Negis Control">
          <div className="admin-orbit" aria-hidden="true">
            <span className="orbit-mark orbit-mark-top" />
            <span className="orbit-mark orbit-mark-right" />
            <span className="orbit-mark orbit-mark-bottom" />
            <span className="orbit-mark orbit-mark-left" />
          </div>
          <button className="admin-seal-button" type="button" onClick={() => setShowLogin(true)} aria-label="Открыть вход администратора">
            <span className="seal-string" aria-hidden="true" />
            <span className="seal-ring" aria-hidden="true">
              <span className="seal-inner">
                <span className="seal-word">NEGIS</span>
              </span>
            </span>
            <span className="security-ribbon">
              <span>Вход администратора</span>
            </span>
          </button>
        </section>
      ) : (
        <form
          className="login-card admin-login-card neu-lg"
          onSubmit={(event) => {
            event.preventDefault();
            login.mutate();
          }}
        >
          <button className="login-back-button" type="button" onClick={() => setShowLogin(false)}>
            <ArrowLeftToLine size={16} />
            Вернуться на главный экран
          </button>
          <div className="logo-stack">
            <h1>
              Negis <span>Control</span>
            </h1>
            <p>Панель управления платформой</p>
          </div>
          <div className="warning-strip">ТОЛЬКО ДЛЯ АДМИНИСТРАТОРА</div>
          <label>
            Email
            <input className="neu-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Пароль
            <input className="neu-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button className="neu-btn-primary full" disabled={login.isPending}>
            <Lock size={17} />
            {login.isPending ? 'Проверяем' : 'Войти'}
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
          <Route path="/users" element={<UsersPage />} />
          <Route path="/subscriptions" element={<SubscriptionsPage />} />
          <Route path="/finances" element={<FinancesPage />} />
          <Route path="/logs" element={<LogsPage />} />
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

  if (overview.isLoading) return <SkeletonGrid />;

  return (
    <section className="page-stack">
      {data?.mode === 'mock' && <div className="notice">Сейчас показан демо-режим. После заполнения `.env` API подключится к Supabase.</div>}
      <div className="metrics-grid">
        <MetricCard icon={<Building2 />} label="Всего клиник" value={data?.metrics.totalClinics || 0} hint="+ за всё время" />
        <MetricCard icon={<CheckCircle2 />} label="Активных сегодня" value={data?.metrics.activeToday || 0} hint="за 24 часа" />
        <MetricCard icon={<CalendarClock />} label="Новых за 7 дней" value={data?.metrics.newClinics7d || 0} hint="регистрации" />
        <MetricCard icon={<Users />} label="Всего лидов" value={data?.metrics.totalLeads || 0} hint="по всем клиникам" />
        <MetricCard icon={<Bell />} label="Записей сегодня" value={data?.metrics.bookingsToday || 0} hint="live counter" />
        <MetricCard icon={<CircleDollarSign />} label="Выручка платформы" value={formatMoney(data?.metrics.revenueMonth || 0)} hint="этот месяц" />
      </div>
      <div className="content-grid wide-left">
        <section className="neu panel">
          <PanelHeader title="Активность клиник сегодня" action="Сортировка по активности" />
          <ClinicTable clinics={data?.clinics || []} compact />
        </section>
        <section className="neu panel">
          <PanelHeader title="Лиды по источникам" />
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={data?.sourceStats || []} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={4}>
                {(data?.sourceStats || []).map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </section>
      </div>
      <section className="neu panel">
        <PanelHeader title="Регистрации по дням" />
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data?.registrationStats || []}>
            <CartesianGrid stroke="#d7dde8" strokeDasharray="4 4" />
            <XAxis dataKey="date" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line dataKey="count" stroke="#1A56DB" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </section>
    </section>
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
            <th>Клиника</th>
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
                  <Link className="icon-button neu-sm" to={`/clinics/${clinic.id}`} title="Просмотр">
                    <Eye size={16} />
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
                      <button className="mini-button delete-action" onClick={() => setDeleteClinic(clinic)} title="Удалить клинику">
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
  const create = useMutation({
    mutationFn: () =>
      api(`/api/clinics/${clinic.id}/invoice`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amount), plan })
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
            <span>Сумма</span>
            <input className="neu-input" type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="59000" />
          </label>
        </div>
        <div className="modal-actions">
          <button className="neu-btn" onClick={onClose}>Отмена</button>
          <button className="neu-btn-primary" disabled={create.isPending || !Number(amount)} onClick={() => create.mutate()}>
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
      toast.success('Клиника удалена');
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
          <h3>Удалить клинику</h3>
          <p>Это действие удалит клинику и связанные записи из админки.</p>
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
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по клинике или email" />
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
        <PanelHeader title="Все клиники" action={`${filtered.length} записей`} />
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
      toast.success('Статус клиники обновлён');
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
      <div className="content-grid">
        <section className="neu panel">
          <PanelHeader title="Информация клиники" />
          <InfoRows
            rows={[
              ['Название клиники', clinic.name],
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
          <MetricCard icon={<CircleDollarSign />} label="Выручка клиники" value={formatMoney(clinic.revenue)} hint="оценка" />
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
      columns={['Имя', 'Email', 'Клиника', 'Тариф', 'Регистрация', 'Последний вход', 'KYC']}
      render={(user) => [user.name, user.email, user.clinic, user.plan, formatDate(user.createdAt), relativeTime(user.lastLogin), statusLabel(user.kyc)]}
      actionLabel="Клиника"
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
        columns={['Клиника', 'Тариф', 'Начало', 'Окончание', 'Сумма', 'Статус']}
        render={(sub) => [sub.clinic, sub.plan, formatDate(sub.startsAt), formatDate(sub.endsAt), formatMoney(sub.amount), statusLabel(sub.status)]}
        actionLabel="Открыть клинику"
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
        payments: Array<{ id: string; clinicId: string; clinic: string; plan: string; amount: number; method: string; createdAt: string; status: string }>;
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
        columns={['Клиника', 'Тариф', 'Сумма', 'Метод', 'Дата', 'Статус']}
        render={(payment) => [payment.clinic, payment.plan, formatMoney(payment.amount), payment.method, formatDate(payment.createdAt), statusLabel(payment.status)]}
        actionLabel="Клиника"
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
      columns={['Время', 'Клиника', 'Пользователь', 'Действие', 'Детали', 'IP']}
      render={(log) => [formatTime(log.time), log.clinic, log.user, log.action, log.details, log.ip]}
    />
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
  return (
    <section className="page-stack settings-grid">
      <section className="neu panel">
        <PanelHeader title="Super Admin Profile" />
        <InfoRows rows={[['Email', settings.data?.profile.email || '—'], ['Роль', 'super_admin']]} />
      </section>
      <section className="neu panel">
        <PanelHeader title="Platform Settings" />
        <InfoRows
          rows={[
            ['Platform name', settings.data?.platform.name || 'Negis'],
            ['Support email', settings.data?.platform.supportEmail || '—'],
            ['Trial period', `${settings.data?.platform.trialDays || 14} дней`],
            ['Default plan', settings.data?.platform.defaultPlan || 'Basic'],
            ['Main app URL', settings.data?.platform.mainAppUrl || '—']
          ]}
        />
      </section>
      <section className="danger-zone neu">
        <AlertTriangle />
        <div>
          <h3>Danger Zone</h3>
          <p>Деструктивные действия будут требовать ввод «ПОДТВЕРЖДАЮ» и запись в super_logs.</p>
        </div>
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
            {visibleRows.map((row) => (
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
            ))}
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
