import { timingSafeEqual } from 'node:crypto';

export const PRODUCTION_IMPORT_TOKEN_HEADER='x-jft-production-import-token';

export function hasProductionImportToken(request:Request){
  const expected=process.env.PRODUCTION_IMPORT_TOKEN;
  const supplied=request.headers.get(PRODUCTION_IMPORT_TOKEN_HEADER);
  if(!expected||!supplied)return false;
  const expectedBytes=Buffer.from(expected);
  const suppliedBytes=Buffer.from(supplied);
  return expectedBytes.length===suppliedBytes.length&&timingSafeEqual(expectedBytes,suppliedBytes);
}
