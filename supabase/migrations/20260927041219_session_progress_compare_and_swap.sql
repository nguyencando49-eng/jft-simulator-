-- Atomic compare-and-swap progress update for multi-tab/concurrent navigation.
-- The existing 4-argument overload is retained temporarily so the currently
-- deployed application remains compatible during rollout.

create or replace function public.save_session_progress(
  p_id uuid,
  p_expected_current_index integer,
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
    and current_index = p_expected_current_index
  returning *;
$$;

revoke execute on function public.save_session_progress(uuid, integer, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.save_session_progress(uuid, integer, text, integer, integer)
  to service_role;
