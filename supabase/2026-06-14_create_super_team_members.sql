create table if not exists public.super_team_members (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  role text not null,
  status text not null default 'invited',
  invited_by text,
  invited_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists super_team_members_role_idx
  on public.super_team_members (role);

create index if not exists super_team_members_status_idx
  on public.super_team_members (status);
