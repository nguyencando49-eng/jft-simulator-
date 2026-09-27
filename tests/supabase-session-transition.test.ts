import { afterEach,describe,expect,it,vi } from 'vitest';
import { SupabaseRepository } from '@/lib/server/supabase-repository';

describe('Supabase session transitions',()=>{
  afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
  it('does not replace concurrently saved answers or reopen a submitted attempt',async()=>{
    vi.stubEnv('SUPABASE_URL','https://db.example');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','test-key');
    const fetcher=vi.fn(async(_input:unknown,init?:RequestInit)=>init?.method==='PATCH'
      ?new Response(null,{status:204})
      :Response.json([{id:'s',exam_version_id:'e-v1',candidate_id:'learner',status:'submitted',started_at:'2026-01-01',expires_at:'2026-01-02',submitted_at:'2026-01-01',current_index:1,answers:{q1:1}}]));
    vi.stubGlobal('fetch',fetcher);
    const saved=await new SupabaseRepository().saveSession({id:'s',examVersionId:'e-v1',candidateId:'learner',status:'expired',startedAt:'2026-01-01',expiresAt:'2026-01-02',currentIndex:0,answers:{}});
    expect(String(fetcher.mock.calls[0][0])).toContain('status=neq.submitted');
    const patch=JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(patch).not.toHaveProperty('answers');expect(patch).not.toHaveProperty('current_index');
    expect(saved.status).toBe('submitted');expect(saved.answers).toEqual({q1:1});
  });
});
