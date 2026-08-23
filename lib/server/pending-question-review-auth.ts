import { timingSafeEqual } from 'node:crypto';

export function hasPendingQuestionReviewToken(req:Request){
  const expected=process.env.PENDING_QUESTION_REVIEW_TOKEN;
  const supplied=req.headers.get('x-pending-question-review-token');
  if(!expected||!supplied)return false;
  const expectedBytes=Buffer.from(expected),suppliedBytes=Buffer.from(supplied);
  return expectedBytes.length===suppliedBytes.length&&timingSafeEqual(expectedBytes,suppliedBytes);
}
