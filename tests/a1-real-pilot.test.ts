import { describe,expect,it } from 'vitest';
import { a1Lesson03Candidates } from '@/data/pilots/a1-lesson-03-candidates';
import { runQuestionQa } from '@/lib/server/qa';
import { textSimilarity } from '@/lib/server/duplicate-detection';

describe('A1 lesson 3 real-curriculum pilot',()=>{
  it('contains exactly 20 balanced candidates',()=>{expect(a1Lesson03Candidates).toHaveLength(20);for(const section of ['script_vocabulary','conversation_expression','listening','reading'])expect(a1Lesson03Candidates.filter(q=>q.section===section)).toHaveLength(5);});
  it('passes structural QA before the listening audio gate and retains provenance metadata',()=>{for(const q of a1Lesson03Candidates){const report=runQuestionQa({...q,type:q.type==='audio_choice'?'choice':q.type,version:1,status:'review',source:'ai',createdAt:'x',updatedAt:'x'});expect(report.passed,q.id).toBe(true);expect(q.knowledgeUnitIds.length).toBeGreaterThan(0);expect(q.level).toBe('A1');}});
  it('has no exact or near-duplicate prompts inside the pilot',()=>{for(let i=0;i<a1Lesson03Candidates.length;i++)for(let j=i+1;j<a1Lesson03Candidates.length;j++)expect(textSimilarity(a1Lesson03Candidates[i].prompt,a1Lesson03Candidates[j].prompt),`${a1Lesson03Candidates[i].id}/${a1Lesson03Candidates[j].id}`).toBeLessThan(.82);});
  it('keeps listening candidates pending until fixed audio exists',()=>{const listening=a1Lesson03Candidates.filter(q=>q.section==='listening');expect(listening.every(q=>q.audioScript&&!q.audioSrc)).toBe(true);for(const q of listening){const report=runQuestionQa({...q,version:1,status:'review',source:'ai',createdAt:'x',updatedAt:'x'});expect(report.passed,q.id).toBe(false);expect(report.issues.some(issue=>issue.code==='audio_required')).toBe(true);}});
});
