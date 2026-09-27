import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupabaseRepository } from '@/lib/server/supabase-repository';

describe('Supabase session progress concurrency',()=>{
  afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});

  it('sends the observed current index to the CAS RPC and maps a stale write to null',async()=>{
    vi.stubEnv('SUPABASE_URL','https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','secret');
    const fetchMock=vi.fn(async(_input:string|URL|Request,init?:RequestInit)=>{
      const body=JSON.parse(String(init?.body));
      expect(body).toMatchObject({
        p_id:'session-1',
        p_expected_current_index:3,
        p_question_id:'q-4',
        p_choice:1,
        p_current_index:4,
      });
      return new Response(JSON.stringify([]),{status:200,headers:{'content-type':'application/json'}});
    });
    vi.stubGlobal('fetch',fetchMock);

    const saved=await new SupabaseRepository().saveSessionProgress('session-1',{
      questionId:'q-4',
      choice:1,
      currentIndex:4,
      expectedCurrentIndex:3,
    });

    expect(saved).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/rpc/save_session_progress');
  });
});
