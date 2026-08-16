import type { QuestionRecord } from '@/lib/admin-types';
export function hasQuestionIdCollision(existing: Pick<QuestionRecord,'id'>[], questionId:string){
  return existing.some(q=>q.id===questionId);
}
