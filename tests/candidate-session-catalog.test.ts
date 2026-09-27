import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { POST } from '@/app/api/v1/sessions/route';

const repo=vi.hoisted(()=>({listExamVersions:vi.fn(),listSessions:vi.fn(),createSession:vi.fn()}));
vi.mock('@/lib/server/repository',()=>({getRepository:()=>repo}));
vi.mock('@/lib/server/auth',()=>({requireAuth:async()=>({userId:'learner',role:'candidate'})}));

describe('candidate session publication boundary',()=>{
  beforeEach(()=>{
    vi.stubEnv('NODE_ENV','production');vi.stubEnv('E2E_TEST_MODE','false');
    repo.listExamVersions.mockResolvedValue([
      {id:'legacy-v1',examId:'A1-PREVIEW-FINAL-E2E-123',durationMinutes:60,questions:[],rules:[]},
      {id:'production-v2',examId:'JFT-PRACTICE-A1-001',durationMinutes:60,questions:[],rules:[]},
    ]);
    repo.listSessions.mockResolvedValue([]);repo.createSession.mockClear();
  });
  afterEach(()=>vi.unstubAllEnvs());
  it('rejects a hidden preview ID even when a learner posts it directly',async()=>{
    const response=await POST(new Request('https://jft.example/api/v1/sessions',{method:'POST',body:JSON.stringify({examVersionId:'legacy-v1'})}));
    expect(response.status).toBe(404);expect(repo.createSession).not.toHaveBeenCalled();
  });
  it('continues to create sessions for published production forms',async()=>{
    const response=await POST(new Request('https://jft.example/api/v1/sessions',{method:'POST',body:JSON.stringify({examVersionId:'production-v2'})}));
    expect(response.status).toBe(201);expect(repo.createSession).toHaveBeenCalledOnce();
  });
});
