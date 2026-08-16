create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text null,
  role text not null default 'candidate' check (role in ('admin','candidate')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists profiles_role_idx on public.profiles(role,last_seen_at desc);
alter table public.profiles enable row level security;
-- Server routes use SERVICE_ROLE_KEY. Candidate-facing APIs filter by authenticated user id server-side.
