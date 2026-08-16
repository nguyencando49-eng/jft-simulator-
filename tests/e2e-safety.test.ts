import { afterEach, describe, expect, it } from 'vitest';
import { e2eSessionDurationMs } from '@/lib/server/e2e';

const originalMode=process.env.E2E_TEST_MODE;
const originalNodeEnv=process.env.NODE_ENV;
const mutableEnv=process.env as Record<string,string|undefined>;
afterEach(()=>{
  if(originalMode===undefined) delete mutableEnv.E2E_TEST_MODE; else mutableEnv.E2E_TEST_MODE=originalMode;
  if(originalNodeEnv===undefined) delete mutableEnv.NODE_ENV; else mutableEnv.NODE_ENV=originalNodeEnv;
});
function requestWith(seconds:string){return new Request('http://local.test',{headers:{cookie:`jft-e2e-duration-seconds=${seconds}`}})}

describe('E2E duration override safety',()=>{
  it('is ignored unless E2E_TEST_MODE is explicitly enabled',()=>{
    mutableEnv.E2E_TEST_MODE='false';
    expect(e2eSessionDurationMs(requestWith('3'),60_000)).toBe(60_000);
  });
  it('accepts bounded test durations outside production',()=>{
    mutableEnv.E2E_TEST_MODE='true';
    mutableEnv.NODE_ENV='test';
    expect(e2eSessionDurationMs(requestWith('3'),60_000)).toBe(3_000);
    expect(e2eSessionDurationMs(requestWith('1'),60_000)).toBe(60_000);
    expect(e2eSessionDurationMs(requestWith('999'),60_000)).toBe(60_000);
  });
  it('is always ignored in production',()=>{
    mutableEnv.E2E_TEST_MODE='true';
    mutableEnv.NODE_ENV='production';
    expect(e2eSessionDurationMs(requestWith('3'),60_000)).toBe(60_000);
  });
});
