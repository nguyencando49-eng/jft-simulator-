-- Production security/performance hardening.
-- Architecture: application data access is server-side through service_role.
-- Browser roles must not access public tables/functions directly.

revoke all privileges on table
  public.questions,
  public.exam_drafts,
  public.exam_versions,
  public.candidate_sessions,
  public.profiles,
  public.factory_jobs,
  public.source_documents,
  public.source_chunks,
  public.knowledge_units,
  public.question_plans,
  public.question_provenance,
  public.exam_blueprints,
  public.exam_sets,
  public.coverage_reports
from anon, authenticated;

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.save_session_progress(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.save_session_progress(uuid, text, integer, integer) to service_role;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

alter table public.questions validate constraint questions_status_chk;
alter table public.questions validate constraint questions_section_chk;
alter table public.questions validate constraint questions_level_chk;
alter table public.questions validate constraint questions_version_chk;

alter table public.candidate_sessions validate constraint candidate_sessions_status_chk;
alter table public.candidate_sessions validate constraint candidate_sessions_index_chk;
alter table public.candidate_sessions validate constraint candidate_sessions_time_chk;
alter table public.candidate_sessions validate constraint candidate_sessions_submit_chk;

alter table public.factory_jobs validate constraint factory_jobs_status_chk;

create index if not exists candidate_sessions_exam_version_idx
  on public.candidate_sessions(exam_version_id);
create index if not exists coverage_reports_exam_set_idx
  on public.coverage_reports(exam_set_id);
create index if not exists exam_sets_blueprint_idx
  on public.exam_sets(blueprint_id);
create index if not exists exam_sets_created_by_idx
  on public.exam_sets(created_by);
create index if not exists question_provenance_factory_job_idx
  on public.question_provenance(factory_job_id);
create index if not exists question_provenance_source_document_idx
  on public.question_provenance(source_document_id);
create index if not exists source_documents_created_by_idx
  on public.source_documents(created_by);
