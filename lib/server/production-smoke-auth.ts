import { timingSafeEqual } from 'node:crypto';

export const PRODUCTION_SMOKE_TOKEN_HEADER='x-jft-production-smoke-token';
export const PRODUCTION_SMOKE_USER_ID='00000000-0000-4000-8000-000000000001';

export function hasProductionSmokeToken(request:Request){
  const expected=process.env.PRODUCTION_SMOKE_TOKEN;
  const supplied=request.headers.get(PRODUCTION_SMOKE_TOKEN_HEADER);
  if(!expected||!supplied)return false;
  const expectedBytes=Buffer.from(expected),suppliedBytes=Buffer.from(supplied);
  return expectedBytes.length===suppliedBytes.length&&timingSafeEqual(expectedBytes,suppliedBytes);
}
