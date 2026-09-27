import { afterEach,describe,expect,it,vi } from 'vitest';
import { getRepository,repositoryMode } from '@/lib/server/repository';
import { GET as system } from '@/app/api/v1/system/route';

describe('production persistence boundary',()=>{
  afterEach(()=>vi.unstubAllEnvs());
  it('refuses to silently store real learner data in process memory',()=>{
    vi.stubEnv('NODE_ENV','production');vi.stubEnv('SUPABASE_URL','');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','');
    expect(repositoryMode()).toBe('not-configured');
    expect(()=>getRepository()).toThrow('REPOSITORY_NOT_CONFIGURED');
  });
  it('ignores a stale development flag in production for both auth and persistence',async()=>{
    vi.stubEnv('NODE_ENV','production');vi.stubEnv('AUTH_DISABLED','true');
    vi.stubEnv('SUPABASE_URL','https://auth.example');vi.stubEnv('SUPABASE_ANON_KEY','test-anon');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','test-service');
    expect(repositoryMode()).toBe('supabase');
    const body=await (await system()).json();
    expect(body.authentication).toBe('supabase');expect(body.repository).toBe('supabase');
  });
});
