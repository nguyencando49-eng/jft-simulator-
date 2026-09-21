import { describe,expect,it } from 'vitest';
import { DeterministicJftContentQaJudge } from '@/lib/server/jft-content-qa-agent';
import { massQuestionCandidates } from '@/data/production/mass-question-candidates';
import { curriculumCatalog } from '@/data/production/curriculum-catalog';

describe('JFT_CONTENT_QA_V1 deterministic screen',()=>{
  const judge=new DeterministicJftContentQaJudge();
  it('returns the JSON contract and never mutates the question',()=>{
    const q=structuredClone(massQuestionCandidates.find(item=>item.section==='reading')!);
    const before=structuredClone(q);
    const unit=curriculumCatalog.find(item=>q.knowledgeUnitIds.includes(item.id));
    const result=judge.judge(q,{unit,audioAvailable:true,duplicateSimilarityScore:.2});
    expect(q).toEqual(before);
    expect(result.qaVersion).toBe('JFT_CONTENT_QA_V1');
    expect(result.questionId).toBe(q.id);
    expect(result.release.requiresHumanReview).toBe(true);
    expect(result.issues.some(issue=>issue.code==='ORIGINALITY_EVIDENCE_MISSING')).toBe(true);
    expect(result.issues.some(issue=>issue.code==='LEVEL_MISMATCH')).toBe(false);
  });
  it('hard-fails explicit answer leakage instead of silently fixing it',()=>{
    const source=massQuestionCandidates.find(item=>item.section==='script_vocabulary')!;
    const q={...source,prompt:`${source.prompt} 正解候補：${source.choices[source.answer]}`};
    const unit=curriculumCatalog.find(item=>q.knowledgeUnitIds.includes(item.id));
    const result=judge.judge(q,{unit,duplicateSimilarityScore:.2});
    expect(result.verdict).toBe('FAIL');
    expect(result.hardFail).toBe(true);
    expect(result.issues.some(issue=>issue.code==='ANSWER_LEAKAGE')).toBe(true);
  });
  it('treats surface-rule uncertainty as review evidence, not a semantic level verdict',()=>{
    const q=massQuestionCandidates.find(item=>item.section==='script_vocabulary')!;
    const unit=curriculumCatalog.find(item=>q.knowledgeUnitIds.includes(item.id));
    const result=judge.judge(q,{unit,sourceSimilarityScore:.1,duplicateSimilarityScore:.2});
    expect(result.classification.estimatedLevel).toBe(q.level);
    expect(result.classification.levelMatch).toBe('MATCH');
    expect(result.issues.some(issue=>issue.code==='INSUFFICIENT_EVIDENCE')).toBe(true);
    expect(result.hardFail).toBe(false);
  });
  it('reports missing provenance without inventing curriculum evidence',()=>{
    const q={...massQuestionCandidates[0],knowledgeUnitIds:[],sourceDocument:undefined};
    const result=judge.judge(q,{duplicateSimilarityScore:.2});
    expect(result.release.eligibleForQuestionBank).toBe(false);
    expect(result.issues.some(issue=>issue.code==='PROVENANCE_MISSING')).toBe(true);
  });
});
