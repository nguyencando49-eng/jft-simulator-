import { timingSafeEqual } from 'node:crypto';

export function hasPendingQuestionReviewToken(req:Request){
  const expected=process.env.PENDING_QUESTION_REVIEW_TOKEN;
  const authorization=req.headers.get('authorization');
  const supplied=req.headers.get('x-pending-question-review-token')??(authorization?.startsWith('Bearer ')?authorization.slice(7):null);
  if(!expected||!supplied)return false;
  const expectedBytes=Buffer.from(expected),suppliedBytes=Buffer.from(supplied);
  return expectedBytes.length===suppliedBytes.length&&timingSafeEqual(expectedBytes,suppliedBytes);
}
