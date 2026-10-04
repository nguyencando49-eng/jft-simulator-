import { describe,expect,it,vi } from 'vitest';
import { seedQuestions } from '@/data/admin/seed';
import type { ExamDraft,ExamVersion,QuestionRecord } from '@/lib/admin-types';
import type { Repository } from '@/lib/server/domain';
import { buildProductionExamReleasePack,publishProductionRelease,PRODUCTION_RELEASE_VERSION } from '@/lib/server/production-release';
import { PRODUCTION_EXAM_LEVELS,PRODUCTION_EXAMS_PER_LEVEL } from '@/data/production/exam-catalog';

function repository(){
  let questions:QuestionRecord[]=[];
  const drafts:ExamDraft[]=[];
  const versions:ExamVersion[]=[];
  const repo={
    async listQuestions(){return structuredClone(questions)},
    async upsertQuestions(next:QuestionRecord[]){
      for(const question of next){
        const index=questions.findIndex(item=>item.id===question.id);
        if(index>=0)questions[index]=structuredClone(question);else questions.push(structuredClone(question));
      }
      return structuredClone(next);
    },
    async listExamVersions(examId?:string){return structuredClone(examId?versions.filter(version=>version.examId===examId):versions)},
    async saveExamDraft(draft:ExamDraft){
      const index=drafts.findIndex(item=>item.id===draft.id);
      if(index>=0)drafts[index]=structuredClone(draft);else drafts.push(structuredClone(draft));
      return structuredClone(draft);
    },
    async saveExamVersion(version:ExamVersion){
      if(versions.some(item=>item.id===version.id))throw new Error('duplicate immutable version');
      versions.push(structuredClone(version));return structuredClone(version);
    },
  } as unknown as Repository;
  return {repo,versions,drafts,get questions(){return questions}};
}

function overlap(left:ExamVersion,right:ExamVersion){
  const ids=new Set(left.questions.map(item=>item.questionId));
  return right.questions.reduce((count,item)=>count+(ids.has(item.questionId)?1:0),0);
}
function jsonbRoundTrip<T>(value:T):T{
  const reorder=(input:unknown):unknown=>{
    if(Array.isArray(input))return input.map(reorder);
    if(input&&typeof input==='object'){
      return Object.fromEntries(
        Object.entries(input as Record<string,unknown>)
          .sort(([left],[right])=>right.localeCompare(left))
          .map(([key,nested])=>[key,reorder(nested)]),
      );
    }
    return input;
  };
  return reorder(value) as T;
}

describe('Production 3000 exam release',()=>{
  it('builds 20 low-overlap immutable 48-question forms for every production level',()=>{
    const pack=buildProductionExamReleasePack(seedQuestions,'2026-09-22T00:00:00.000Z');
    expect(pack.report.releaseVersion).toBe(PRODUCTION_RELEASE_VERSION);
    expect(pack.report.examsPerLevel).toBe(PRODUCTION_EXAMS_PER_LEVEL);
    expect(pack.versions).toHaveLength(PRODUCTION_EXAM_LEVELS.length*PRODUCTION_EXAMS_PER_LEVEL);
    expect(pack.report.maxPairwiseOverlap).toBeLessThanOrEqual(1);

    for(const level of PRODUCTION_EXAM_LEVELS){
      const forms=pack.versions.filter(version=>version.questions[0]?.snapshot.level===level);
      expect(forms).toHaveLength(PRODUCTION_EXAMS_PER_LEVEL);
      for(const version of forms){
        expect(version.questions).toHaveLength(48);
        expect(version.durationMinutes).toBe(60);
        expect(new Set(version.questions.map(item=>item.questionId)).size).toBe(48);
        expect(new Set(version.questions.map(item=>item.snapshot.level))).toEqual(new Set([level]));
        expect(version.questions.every(item=>item.snapshot.status==='approved')).toBe(true);
        for(const section of ['script_vocabulary','conversation_expression','listening','reading']){
          expect(version.questions.filter(item=>item.snapshot.section===section),`${version.id}/${section}`).toHaveLength(12);
        }
      }
      for(let left=0;left<forms.length;left++){
        for(let right=left+1;right<forms.length;right++){
          expect(overlap(forms[left],forms[right]),`${forms[left].id} vs ${forms[right].id}`).toBeLessThanOrEqual(1);
        }
      }

      for(const section of ['script_vocabulary','conversation_expression','reading'] as const){
        const ids=forms.flatMap(version=>version.questions.filter(item=>item.snapshot.section===section).map(item=>item.questionId));
        expect(new Set(ids).size).toBe(ids.length);
      }
      const listeningIds=forms.flatMap(version=>version.questions.filter(item=>item.snapshot.section==='listening').map(item=>item.questionId));
      const exposure=new Map<string,number>();
      listeningIds.forEach(id=>exposure.set(id,(exposure.get(id)??0)+1));
      expect(new Set(listeningIds).size).toBe(175);
      expect(Math.max(...exposure.values())).toBe(2);
    }
  });

  it('imports the 3,000-bank and publishes exactly 60 versions idempotently',async()=>{
    const state=repository();
    const first=await publishProductionRelease(state.repo,'2026-09-22T00:00:00.000Z');
    expect(first.bankImport.imported).toBe(3000);
    expect(first.published).toHaveLength(60);
    expect(first.skipped).toEqual([]);
    expect(state.questions).toHaveLength(3000);
    expect(state.versions).toHaveLength(60);
    expect(state.drafts).toHaveLength(60);

    // PostgreSQL jsonb does not preserve object key order. Simulate that
    // round-trip so semantic equality, not insertion order, defines immutability.
    state.versions.splice(0,state.versions.length,...jsonbRoundTrip(state.versions));
    const writes=vi.spyOn(state.repo,'upsertQuestions');
    const draftWrites=vi.spyOn(state.repo,'saveExamDraft');
    const second=await publishProductionRelease(state.repo,'2026-09-23T00:00:00.000Z');
    expect(second.published).toEqual([]);
    expect(second.skipped).toHaveLength(60);
    expect(state.versions).toHaveLength(60);
    expect(writes).not.toHaveBeenCalled();
    expect(draftWrites).not.toHaveBeenCalled();
  });

  it('resumes a partial release without replacing saved versions',async()=>{
    const state=repository();
    await publishProductionRelease(state.repo);
    const retained=state.versions.splice(0,22);
    state.versions.splice(0,state.versions.length,...retained);
    const result=await publishProductionRelease(state.repo);
    expect(result.skipped).toHaveLength(22);
    expect(result.published).toHaveLength(38);
    expect(state.versions).toHaveLength(60);
    expect(state.versions.slice(0,22)).toEqual(retained);
  });

  it('refuses to overwrite an existing production version with a different snapshot',async()=>{
    const state=repository();
    await publishProductionRelease(state.repo,'2026-09-22T00:00:00.000Z');
    state.versions[0].questions[0].snapshot.prompt+=' CHANGED';
    await expect(publishProductionRelease(state.repo,'2026-09-23T00:00:00.000Z')).rejects.toMatchObject({code:'PRODUCTION_VERSION_CONFLICT'});
  });
});
