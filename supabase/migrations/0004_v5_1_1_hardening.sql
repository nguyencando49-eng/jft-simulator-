-- V5.1.1 hardening: enforce critical invariants on all new/updated rows.
do $$ begin
  if not exists (select 1 from pg_constraint where conname='questions_status_chk') then
    alter table public.questions add constraint questions_status_chk check (status in ('draft','review','approved','archived')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='questions_section_chk') then
    alter table public.questions add constraint questions_section_chk check (section in ('script_vocabulary','conversation_expression','listening','reading')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='questions_level_chk') then
    alter table public.questions add constraint questions_level_chk check (level in ('A1','A2.1','A2.2')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='questions_version_chk') then
    alter table public.questions add constraint questions_version_chk check (version >= 1) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='candidate_sessions_status_chk') then
    alter table public.candidate_sessions add constraint candidate_sessions_status_chk check (status in ('active','submitted','expired')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='candidate_sessions_index_chk') then
    alter table public.candidate_sessions add constraint candidate_sessions_index_chk check (current_index >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='candidate_sessions_time_chk') then
    alter table public.candidate_sessions add constraint candidate_sessions_time_chk check (expires_at > started_at) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='candidate_sessions_submit_chk') then
    alter table public.candidate_sessions add constraint candidate_sessions_submit_chk check ((status='submitted' and submitted_at is not null) or status<>'submitted') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='factory_jobs_status_chk') then
    alter table public.factory_jobs add constraint factory_jobs_status_chk check (status in ('queued','running','review','completed','failed')) not valid;
  end if;
end $$;

-- Atomic JSONB answer merge prevents concurrent autosaves from replacing each other's answers.
create or replace function public.save_session_progress(
  p_id uuid,
  p_question_id text default null,
  p_choice integer default null,
  p_current_index integer default null
) returns setof public.candidate_sessions
language sql
security invoker
set search_path = public
as $$
  update public.candidate_sessions
  set answers = case
        when p_question_id is null or p_choice is null then answers
        else jsonb_set(answers, array[p_question_id], to_jsonb(p_choice), true)
      end,
      current_index = coalesce(p_current_index, current_index)
  where id = p_id
    and status = 'active'
    and now() < expires_at
  returning *;
$$;
