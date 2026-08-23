import { afterEach,describe,expect,it,vi } from 'vitest';
import { SupabaseRepository } from '@/lib/server/supabase-repository';

describe('Supabase repository pagination',()=>{
  afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()});
  it('reads beyond the PostgREST 1,000-row response cap',async()=>{
    vi.stubEnv('SUPABASE_URL','https://example.supabase.co');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','secret');
    const first=Array.from({length:1000},(_,index)=>({payload:{id:`Q-${index}`}})),second=[{payload:{id:'Q-1000'}}];
    const fetchMock=vi.fn(async(input:string|URL|Request)=>new Response(JSON.stringify(String(input).includes('offset=1000')?second:first),{status:200,headers:{'content-type':'application/json'}}));vi.stubGlobal('fetch',fetchMock);
    const questions=await new SupabaseRepository().listQuestions();
    expect(questions).toHaveLength(1001);expect(questions.at(-1)?.id).toBe('Q-1000');expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('limit=1000&offset=1000');
  });
});
