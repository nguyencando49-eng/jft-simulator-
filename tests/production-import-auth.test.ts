import { afterEach,describe,expect,it } from 'vitest';
import { hasProductionImportToken,PRODUCTION_IMPORT_TOKEN_HEADER } from '@/lib/server/production-import-auth';

const original=process.env.PRODUCTION_IMPORT_TOKEN;
afterEach(()=>{if(original===undefined)delete process.env.PRODUCTION_IMPORT_TOKEN;else process.env.PRODUCTION_IMPORT_TOKEN=original});

describe('one-time production import authorization',()=>{
  it('is disabled when the server token is absent',()=>{
    delete process.env.PRODUCTION_IMPORT_TOKEN;
    expect(hasProductionImportToken(new Request('http://local.test',{headers:{[PRODUCTION_IMPORT_TOKEN_HEADER]:'anything'}}))).toBe(false);
  });
  it('accepts only an exact timing-safe token match',()=>{
    process.env.PRODUCTION_IMPORT_TOKEN='temporary-secret';
    expect(hasProductionImportToken(new Request('http://local.test',{headers:{[PRODUCTION_IMPORT_TOKEN_HEADER]:'wrong'}}))).toBe(false);
    expect(hasProductionImportToken(new Request('http://local.test',{headers:{[PRODUCTION_IMPORT_TOKEN_HEADER]:'temporary-secret'}}))).toBe(true);
  });
});
