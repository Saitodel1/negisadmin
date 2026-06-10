-- Negis Control audit logs.
-- Run once in Supabase SQL Editor for the shared Negis database.

create extension if not exists pgcrypto;

create table if not exists public.super_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  target_clinic_id uuid null,
  target_user_id uuid null,
  details jsonb not null default '{}'::jsonb,
  ip_address text null,
  created_at timestamptz not null default now()
);

create index if not exists super_logs_created_at_idx
  on public.super_logs (created_at desc);

create index if not exists super_logs_target_clinic_id_idx
  on public.super_logs (target_clinic_id);

create index if not exists super_logs_action_idx
  on public.super_logs (action);

alter table public.super_logs enable row level security;

-- The admin API reads/writes through SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
-- Do not add public anon policies for this table.
