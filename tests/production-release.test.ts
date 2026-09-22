import { describe,expect,it } from 'vitest';
import { seedQuestions } from '@/data/admin/seed';
import type { ExamDraft,ExamVersion,QuestionRecord } from '@/lib/admin-types';
import type { Repository } from '@/lib/server/domain';
import { buildProductionExamReleasePack,publishProductionRelease,PRODUCTION_RELEASE_VERSION } from '@/lib/server/production-release';

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

describe('Production 3000 exam release',()=>{
  it('builds one immutable 48-question form for every production level',()=>{
    const pack=buildProductionExamReleasePack(seedQuestions,'2026-09-22T00:00:00.000Z');
    expect(pack.report.releaseVersion).toBe(PRODUCTION_RELEASE_VERSION);
    expect(pack.versions).toHaveLength(3);
    expect(pack.report.levels).toEqual(['A1','A2.1','A2.2']);
    for(const [index,version] of pack.versions.entries()){
      expect(version.questions).toHaveLength(48);
      expect(version.durationMinutes).toBe(60);
      expect(new Set(version.questions.map(item=>item.questionId)).size).toBe(48);
      expect(new Set(version.questions.map(item=>item.snapshot.level))).toEqual(new Set([pack.report.levels[index]]));
      expect(version.questions.every(item=>item.snapshot.status==='approved')).toBe(true);
      for(const section of ['script_vocabulary','conversation_expression','listening','reading']){
        expect(version.questions.filter(item=>item.snapshot.section===section),`${version.id}/${section}`).toHaveLength(12);
      }
    }
  });

  it('imports the 3,000-bank and publishes exactly three versions idempotently',async()=>{
    const state=repository();
    const first=await publishProductionRelease(state.repo,'2026-09-22T00:00:00.000Z');
    expect(first.bankImport.imported).toBe(3000);
    expect(first.published).toHaveLength(3);
    expect(first.skipped).toEqual([]);
    expect(state.questions).toHaveLength(3000);
    expect(state.versions).toHaveLength(3);
    expect(state.drafts).toHaveLength(3);

    const second=await publishProductionRelease(state.repo,'2026-09-23T00:00:00.000Z');
    expect(second.published).toEqual([]);
    expect(second.skipped).toHaveLength(3);
    expect(state.versions).toHaveLength(3);
  });

  it('refuses to overwrite an existing production version with a different snapshot',async()=>{
    const state=repository();
    await publishProductionRelease(state.repo,'2026-09-22T00:00:00.000Z');
    state.versions[0].questions[0].snapshot.prompt+=' CHANGED';
    await expect(publishProductionRelease(state.repo,'2026-09-23T00:00:00.000Z')).rejects.toMatchObject({code:'PRODUCTION_VERSION_CONFLICT'});
  });
});
