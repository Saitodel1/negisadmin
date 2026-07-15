-- Run after 2026-07-14_workspace_features.sql.
-- This creates the shared integration backbone used by CRM and Negis Control.

insert into public.plans (code, name, description, sort_order) values
  ('trial', 'Пробный', 'Тестовый доступ к базовой CRM', 0),
  ('basic', 'Basic', 'CRM, лиды, задачи и базовые автоматизации', 10),
  ('pro', 'Pro', 'Расширенная аналитика, кастомные правила и интеграции', 20),
  ('business', 'Business', 'AI, расширенные сценарии и модули Negis', 30)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

-- Explicit plan matrix. An organization can still receive a manual exception.
with access_matrix(plan_code, feature_key, is_enabled, limits) as (
  values
    ('trial', 'crm.core', true, '{"users":2,"branches":1,"automation_rules":0,"monthly_ai_requests":0}'::jsonb),
    ('trial', 'crm.clients', true, '{}'::jsonb),
    ('trial', 'crm.tasks', true, '{}'::jsonb),
    ('basic', 'crm.core', true, '{"users":5,"branches":1,"automation_rules":3,"monthly_ai_requests":0}'::jsonb),
    ('basic', 'crm.clients', true, '{}'::jsonb),
    ('basic', 'crm.tasks', true, '{}'::jsonb),
    ('basic', 'crm.reports.basic', true, '{}'::jsonb),
    ('basic', 'automation.default_rules', true, '{}'::jsonb),
    ('pro', 'crm.core', true, '{"users":15,"branches":3,"automation_rules":20,"monthly_ai_requests":0}'::jsonb),
    ('pro', 'crm.clients', true, '{}'::jsonb),
    ('pro', 'crm.tasks', true, '{}'::jsonb),
    ('pro', 'crm.reports.basic', true, '{}'::jsonb),
    ('pro', 'crm.reports.advanced', true, '{}'::jsonb),
    ('pro', 'automation.default_rules', true, '{}'::jsonb),
    ('pro', 'automation.custom_rules', true, '{}'::jsonb),
    ('pro', 'integration.wazzup', true, '{}'::jsonb),
    ('pro', 'integration.telephony', true, '{}'::jsonb),
    ('pro', 'integration.telegram', true, '{}'::jsonb),
    ('business', 'crm.core', true, '{"users":100,"branches":20,"automation_rules":100,"monthly_ai_requests":1000}'::jsonb),
    ('business', 'crm.clients', true, '{}'::jsonb),
    ('business', 'crm.tasks', true, '{}'::jsonb),
    ('business', 'crm.reports.basic', true, '{}'::jsonb),
    ('business', 'crm.reports.advanced', true, '{}'::jsonb),
    ('business', 'automation.default_rules', true, '{}'::jsonb),
    ('business', 'automation.custom_rules', true, '{}'::jsonb),
    ('business', 'automation.ai', true, '{}'::jsonb),
    ('business', 'integration.wazzup', true, '{}'::jsonb),
    ('business', 'integration.telephony', true, '{}'::jsonb),
    ('business', 'integration.payments', true, '{}'::jsonb),
    ('business', 'integration.telegram', true, '{}'::jsonb),
    ('business', 'module.negis_app', true, '{}'::jsonb),
    ('business', 'module.negis_loyalty', true, '{}'::jsonb),
    ('business', 'module.negis_chatbot', true, '{}'::jsonb),
    ('business', 'module.negis_ai', true, '{}'::jsonb)
)
insert into public.plan_features (plan_id, feature_id, is_enabled, limits)
select p.id, f.id, m.is_enabled, m.limits
from access_matrix m
join public.plans p on p.code = m.plan_code
join public.features f on f.key = m.feature_key
on conflict (plan_id, feature_id) do update set is_enabled = excluded.is_enabled, limits = excluded.limits;

create table if not exists public.organization_integrations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  provider text not null,
  display_name text,
  external_account_id text,
  status text not null default 'pending' check (status in ('available', 'pending', 'connected', 'error', 'disabled', 'revoked')),
  scopes text[] not null default '{}',
  safe_settings jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_error text,
  connected_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organization_integrations_provider_account_idx
  on public.organization_integrations(clinic_id, provider, coalesce(external_account_id, 'default'));
create index if not exists organization_integrations_clinic_status_idx
  on public.organization_integrations(clinic_id, status);

-- Never expose this table through the browser or Negis Control API.
create table if not exists public.integration_credentials (
  integration_id uuid primary key references public.organization_integrations(id) on delete cascade,
  encrypted_payload text not null,
  key_version text not null default 'v1',
  expires_at timestamptz,
  refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.integration_credentials enable row level security;

create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.organization_integrations(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  event_type text not null,
  external_event_id text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed')),
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists integration_events_dedupe_idx
  on public.integration_events(integration_id, external_event_id)
  where external_event_id is not null;
create index if not exists integration_events_integration_created_idx
  on public.integration_events(integration_id, created_at desc);

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  url text not null,
  secret_hash text not null,
  subscribed_events text[] not null default '{}',
  is_active boolean not null default true,
  last_status_code integer,
  last_error text,
  last_delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists webhook_deliveries_clinic_idx on public.webhook_deliveries(clinic_id);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default '{}',
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists api_keys_clinic_idx on public.api_keys(clinic_id) where revoked_at is null;

create table if not exists public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.organization_integrations(id) on delete cascade,
  job_type text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  attempts integer not null default 0,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sync_jobs_queue_idx on public.sync_jobs(status, run_after) where status in ('queued', 'running');
