create table if not exists public.factory_jobs (
  id uuid primary key,
  status text not null,
  requested_by uuid null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists factory_jobs_updated_at_idx on public.factory_jobs(updated_at desc);
create index if not exists factory_jobs_status_idx on public.factory_jobs(status);
comment on table public.factory_jobs is 'V5 AI Question Factory generation jobs and immutable generation metadata.';
