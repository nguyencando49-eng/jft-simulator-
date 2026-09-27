import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { POST as recover } from '@/app/api/v1/auth/recover/route';
import { POST as reset } from '@/app/api/v1/auth/reset/route';
import { safeLoginDestination } from '@/lib/auth-redirect';

const request=(body:unknown)=>new Request('https://jft.example/api/v1/auth/recover',{method:'POST',body:JSON.stringify(body)});

describe('account recovery failure handling',()=>{
  beforeEach(()=>{
    vi.stubEnv('NODE_ENV','production');
    vi.stubEnv('SUPABASE_URL','https://auth.example');
    vi.stubEnv('SUPABASE_ANON_KEY','test-anon');
  });
  afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});

  it.each([429,500,403])('does not report success after provider status %s or leak its body',async status=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('private provider detail',{status})));
    const response=await recover(request({email:'learner@example.com'}));
    expect(response.status).toBe(status===429?429:502);
    expect(await response.text()).not.toContain('private provider detail');
  });
  it('handles network failure and validates payloads before contacting the provider',async()=>{
    const fetcher=vi.fn().mockRejectedValue(new Error('unavailable'));
    vi.stubGlobal('fetch',fetcher);
    for(const body of [null,{}, {email:123},{email:'invalid'}])expect((await recover(request(body))).status).toBe(422);
    expect(fetcher).not.toHaveBeenCalled();
    expect((await recover(request({email:'learner@example.com'}))).status).toBe(502);
  });
  it('uses the current site recovery callback and a bounded provider timeout',async()=>{
    const fetcher=vi.fn().mockResolvedValue(new Response('{}',{status:200}));
    vi.stubGlobal('fetch',fetcher);
    expect((await recover(request({email:' learner@example.com '}))).status).toBe(200);
    const [url,init]=fetcher.mock.calls[0];
    expect(new URL(url).searchParams.get('redirect_to')).toBe('https://jft.example/reset-password');
    expect(JSON.parse(init.body)).toEqual({email:'learner@example.com'});
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
  it('returns controlled reset errors for malformed input and non-JSON provider failures',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('upstream unavailable',{status:503})));
    expect((await reset(request({password:123}))).status).toBe(422);
    expect((await reset(request({password:'password123',accessToken:{}}))).status).toBe(401);
    expect((await reset(request({password:'password123',accessToken:'test-token'}))).status).toBe(502);
    expect((await reset(new Request('https://jft.example/reset',{method:'POST',body:'{'}))).status).toBe(400);
  });
});

describe('login destination',()=>{
  it('preserves the selected exam and session',()=>{
    expect(safeLoginDestination('/exam?examVersionId=JFT-PRACTICE-A1-001-v2')).toBe('/exam?examVersionId=JFT-PRACTICE-A1-001-v2');
    expect(safeLoginDestination('/exam?sessionId=s1')).toBe('/exam?sessionId=s1');
  });
  it.each(['https://elsewhere.example','//elsewhere.example','/\\elsewhere.example','/\n/elsewhere.example'])('rejects external destinations: %s',destination=>{
    expect(safeLoginDestination(destination)).toBe('/');
  });
});
