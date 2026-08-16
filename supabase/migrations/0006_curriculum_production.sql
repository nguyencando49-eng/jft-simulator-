-- Simulator production entities. Targets/thresholds stored here are product decisions, not official JFT facts.
alter table public.source_documents add column if not exists updated_at timestamptz not null default now();
alter table public.knowledge_units add column if not exists updated_at timestamptz not null default now();

create table if not exists public.exam_blueprints (
  id uuid primary key, version text not null, level text not null check(level in ('A1','A2.1','A2.2')),
  status text not null check(status in ('draft','active','retired')), payload jsonb not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(version,level)
);
create index if not exists exam_blueprints_level_status_idx on public.exam_blueprints(level,status);

create table if not exists public.exam_sets (
  id uuid primary key, level text not null check(level in ('A1','A2.1','A2.2')), blueprint_id uuid not null references public.exam_blueprints(id),
  seed text not null, status text not null check(status in ('draft','qa_passed','human_review','published')),
  payload jsonb not null, created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists exam_sets_level_status_idx on public.exam_sets(level,status,created_at desc);

create table if not exists public.coverage_reports (
  id uuid primary key, level text not null check(level in ('A1','A2.1','A2.2')), report_type text not null,
  exam_set_id uuid references public.exam_sets(id) on delete cascade, payload jsonb not null, created_at timestamptz not null default now()
);
create index if not exists coverage_reports_level_idx on public.coverage_reports(level,created_at desc);

alter table public.exam_blueprints enable row level security;
alter table public.exam_sets enable row level security;
alter table public.coverage_reports enable row level security;
-- No browser policies: versioned admin routes use service-role access after requireAuth(admin).
