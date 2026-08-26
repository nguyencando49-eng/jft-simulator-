import { createHash, timingSafeEqual } from 'node:crypto';

function digest(value: string) {
  return createHash('sha256').update(value).digest();
}

export function hasControlledA1ReplacementToken(request: Request) {
  const expected = process.env.CONTROLLED_A1_REPLACEMENT_TOKEN;
  const supplied = request.headers.get('x-controlled-a1-replacement-token');
  if (!expected || !supplied) return false;
  return timingSafeEqual(digest(expected), digest(supplied));
}
