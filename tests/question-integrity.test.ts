import { describe,expect,it } from 'vitest';
import { hasQuestionIdCollision } from '@/lib/server/question-integrity';
describe('question approval integrity',()=>{it('detects ids that would overwrite Question Bank records',()=>{expect(hasQuestionIdCollision([{id:'Q1'}],'Q1')).toBe(true);expect(hasQuestionIdCollision([{id:'Q1'}],'Q2')).toBe(false);});});
