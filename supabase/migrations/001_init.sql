-- Jalankan seluruh SQL ini di Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active','closed')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  full_name text not null,
  identity_number text not null,
  created_at timestamptz not null default now(),
  unique(session_id, identity_number)
);

alter table public.admins enable row level security;
alter table public.sessions enable row level security;
alter table public.attendance enable row level security;

create policy "admins can read own admin record" on public.admins
for select to authenticated using (user_id = auth.uid());

create policy "admins can read sessions" on public.sessions
for select to authenticated using (exists(select 1 from public.admins a where a.user_id=auth.uid()));
create policy "admins can create sessions" on public.sessions
for insert to authenticated with check (created_by=auth.uid() and exists(select 1 from public.admins a where a.user_id=auth.uid()));
create policy "admins can update sessions" on public.sessions
for update to authenticated using (exists(select 1 from public.admins a where a.user_id=auth.uid()))
with check (exists(select 1 from public.admins a where a.user_id=auth.uid()));

create policy "admins can read attendance" on public.attendance
for select to authenticated using (exists(select 1 from public.admins a where a.user_id=auth.uid()));

-- Tidak ada policy insert untuk anon/authenticated. Pencatatan hanya melalui Edge Function.
grant select on public.admins, public.sessions, public.attendance to authenticated;
grant insert, select, update on public.sessions to authenticated;
grant select on public.attendance to authenticated;