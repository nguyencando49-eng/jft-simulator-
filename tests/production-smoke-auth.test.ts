import { afterEach,describe,expect,it } from 'vitest';
import { hasProductionSmokeToken, PRODUCTION_SMOKE_TOKEN_HEADER } from '@/lib/server/production-smoke-auth';

const original=process.env.PRODUCTION_SMOKE_TOKEN;
afterEach(()=>{if(original===undefined)delete process.env.PRODUCTION_SMOKE_TOKEN;else process.env.PRODUCTION_SMOKE_TOKEN=original});

describe('one-time production smoke authorization',()=>{
  it('is disabled when the server secret is absent',()=>{
    delete process.env.PRODUCTION_SMOKE_TOKEN;
    expect(hasProductionSmokeToken(new Request('http://local.test',{headers:{[PRODUCTION_SMOKE_TOKEN_HEADER]:'anything'}}))).toBe(false);
  });
  it('uses an exact timing-safe secret match',()=>{
    process.env.PRODUCTION_SMOKE_TOKEN='temporary-smoke-secret';
    expect(hasProductionSmokeToken(new Request('http://local.test',{headers:{[PRODUCTION_SMOKE_TOKEN_HEADER]:'wrong'}}))).toBe(false);
    expect(hasProductionSmokeToken(new Request('http://local.test',{headers:{[PRODUCTION_SMOKE_TOKEN_HEADER]:'temporary-smoke-secret'}}))).toBe(true);
  });
});
