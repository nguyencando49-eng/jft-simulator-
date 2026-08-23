-- Factory payloads contain internal answer and QA evidence. Server-side repository
-- access uses the service role; browser/anon access must not bypass application auth.
alter table public.factory_jobs enable row level security;
