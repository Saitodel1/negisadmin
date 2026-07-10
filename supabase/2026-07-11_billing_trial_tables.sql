-- Negis Control billing and trial support.
-- Run once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  clinic_name text,
  plan text not null default 'Basic',
  amount numeric not null default 0,
  status text not null default 'active',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_clinic_id_idx
  on public.subscriptions (clinic_id);

create index if not exists subscriptions_status_idx
  on public.subscriptions (status);

create index if not exists subscriptions_ends_at_idx
  on public.subscriptions (ends_at);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  clinic_name text,
  plan text not null default 'Basic',
  amount numeric not null default 0,
  method text not null default 'invoice',
  status text not null default 'pending',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_clinic_id_idx
  on public.payments (clinic_id);

create index if not exists payments_status_idx
  on public.payments (status);

create index if not exists payments_created_at_idx
  on public.payments (created_at desc);

alter table public.clinics
  add column if not exists trial_ends_at timestamptz;

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'clinics'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format('alter table public.clinics drop constraint if exists %I', constraint_record.conname);
  end loop;
end $$;

alter table public.clinics
  add constraint clinics_status_allowed
  check (status in ('active', 'blocked', 'trial', 'expired', 'inactive', 'pending'));
