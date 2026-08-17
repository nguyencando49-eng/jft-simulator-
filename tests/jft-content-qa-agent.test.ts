import { describe,expect,it } from 'vitest';
import { DeterministicJftContentQaJudge } from '@/lib/server/jft-content-qa-agent';
import { massQuestionCandidates } from '@/data/production/mass-question-candidates';
import { curriculumCatalog } from '@/data/production/curriculum-catalog';

describe('JFT_CONTENT_QA_V1 independent judge',()=>{
  const judge=new DeterministicJftContentQaJudge();
  it('returns the JSON contract and never mutates the question',()=>{const q=structuredClone(massQuestionCandidates.find(item=>item.section==='reading')!);const before=structuredClone(q);const unit=curriculumCatalog.find(item=>q.knowledgeUnitIds.includes(item.id));const result=judge.judge(q,{unit,audioAvailable:true,duplicateSimilarityScore:.2});expect(q).toEqual(before);expect(result.qaVersion).toBe('JFT_CONTENT_QA_V1');expect(result.questionId).toBe(q.id);expect(result.release.requiresHumanReview).toBe(true);expect(result.issues.some(issue=>issue.code==='ORIGINALITY_EVIDENCE_MISSING')).toBe(true);});
  it('hard-fails answer leakage instead of silently fixing it',()=>{const q=massQuestionCandidates.find(item=>item.section==='script_vocabulary'&&item.choices.some(choice=>item.prompt.includes(choice)))!;const unit=curriculumCatalog.find(item=>q.knowledgeUnitIds.includes(item.id));const result=judge.judge(q,{unit,duplicateSimilarityScore:.2});expect(result.verdict).toBe('FAIL');expect(result.hardFail).toBe(true);expect(result.issues.some(issue=>issue.code==='ANSWER_LEAKAGE')).toBe(true);expect(result.independentAnswer.declaredCorrectOption).toBe(q.answer);});
  it('reports insufficient evidence when provenance is absent',()=>{const q={...massQuestionCandidates[0],knowledgeUnitIds:[],sourceDocument:undefined};const result=judge.judge(q,{duplicateSimilarityScore:.2});expect(result.release.eligibleForQuestionBank).toBe(false);expect(result.issues.some(issue=>issue.code==='INSUFFICIENT_EVIDENCE')).toBe(true);expect(result.issues.some(issue=>issue.code==='PROVENANCE_MISSING')).toBe(true);});
});
