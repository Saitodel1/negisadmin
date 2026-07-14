-- Negis Control: plans, feature flags and organization-level overrides.
-- `clinic_id` remains for backwards compatibility with the existing CRM schema.

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.features (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  description text,
  category text not null,
  is_internal boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_features (
  plan_id uuid not null references public.plans(id) on delete cascade,
  feature_id uuid not null references public.features(id) on delete cascade,
  is_enabled boolean not null default true,
  limits jsonb not null default '{}'::jsonb,
  primary key (plan_id, feature_id)
);

create table if not exists public.workspace_subscriptions (
  clinic_id uuid primary key references public.clinics(id) on delete cascade,
  plan_id uuid references public.plans(id),
  status text not null default 'active' check (status in ('trial', 'active', 'suspended', 'blocked', 'expired')),
  starts_at timestamptz,
  ends_at timestamptz,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_feature_overrides (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  feature_id uuid not null references public.features(id) on delete cascade,
  is_enabled boolean not null,
  reason text,
  changed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, feature_id)
);

create table if not exists public.feature_access_audit (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete set null,
  feature_id uuid references public.features(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

insert into public.features (key, name, description, category, is_internal) values
  ('crm.core', 'CRM', 'Базовая CRM', 'CRM', false),
  ('crm.clients', 'Клиенты', 'Карточки клиентов и лиды', 'CRM', false),
  ('crm.tasks', 'Задачи', 'Задачи команды', 'CRM', false),
  ('crm.reports.basic', 'Базовые отчеты', 'Основная аналитика', 'CRM', false),
  ('crm.reports.advanced', 'Расширенная аналитика', 'Воронки и детальные отчеты', 'CRM', false),
  ('automation.default_rules', 'Базовые автоматизации', 'Системные правила', 'Автоматизации', false),
  ('automation.custom_rules', 'Конструктор автоматизаций', 'Пользовательские правила', 'Автоматизации', false),
  ('automation.ai', 'AI-автоматизации', 'AI-сценарии', 'Автоматизации', false),
  ('integration.wazzup', 'Wazzup', 'WhatsApp и мессенджеры', 'Интеграции', false),
  ('integration.telephony', 'Телефония', 'Звонки и записи разговоров', 'Интеграции', false),
  ('integration.payments', 'Платежи', 'Онлайн-оплата', 'Интеграции', false),
  ('integration.telegram', 'Telegram', 'Telegram-интеграция', 'Интеграции', false),
  ('module.negis_app', 'Negis App', 'Клиентское приложение Negis', 'Модули Negis', true),
  ('module.negis_loyalty', 'Negis Loyalty', 'Лояльность и бонусы', 'Модули Negis', true),
  ('module.negis_chatbot', 'Negis Chatbot', 'Чат-бот', 'Модули Negis', true),
  ('module.negis_ai', 'Negis AI', 'AI-функции Negis', 'Модули Negis', true)
on conflict (key) do update set name = excluded.name, description = excluded.description, category = excluded.category, is_internal = excluded.is_internal;

-- Plans already exist in this project. Link every active plan to the core CRM,
-- then configure paid features explicitly in Negis Admin.
insert into public.plan_features (plan_id, feature_id, is_enabled)
select p.id, f.id, true
from public.plans p cross join public.features f
where f.key in ('crm.core', 'crm.clients', 'crm.tasks', 'crm.reports.basic', 'automation.default_rules')
on conflict (plan_id, feature_id) do nothing;

create index if not exists workspace_feature_overrides_clinic_idx on public.workspace_feature_overrides(clinic_id);
create index if not exists feature_access_audit_clinic_created_idx on public.feature_access_audit(clinic_id, created_at desc);
