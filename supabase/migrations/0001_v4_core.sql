create extension if not exists pgcrypto;
create table if not exists public.questions (
  id text primary key, status text not null, section text not null, level text not null,
  version integer not null default 1, payload jsonb not null, updated_at timestamptz not null default now()
);
create index if not exists questions_filter_idx on public.questions(status,section,level);
create table if not exists public.exam_drafts (
  id text primary key, status text not null default 'draft', payload jsonb not null, updated_at timestamptz not null default now()
);
create table if not exists public.exam_versions (
  id text primary key, exam_id text not null, version integer not null, payload jsonb not null,
  published_at timestamptz not null default now(), unique(exam_id,version)
);
create table if not exists public.candidate_sessions (
  id uuid primary key default gen_random_uuid(), exam_version_id text not null references public.exam_versions(id),
  candidate_id uuid null, status text not null default 'active', started_at timestamptz not null default now(),
  expires_at timestamptz not null, submitted_at timestamptz null, current_index integer not null default 0,
  answers jsonb not null default '{}'::jsonb
);
create index if not exists candidate_sessions_candidate_idx on public.candidate_sessions(candidate_id,started_at desc);

alter table public.questions enable row level security;
alter table public.exam_drafts enable row level security;
alter table public.exam_versions enable row level security;
alter table public.candidate_sessions enable row level security;
-- V4 server routes use SERVICE_ROLE_KEY and therefore bypass RLS. Browser clients must never receive it.
