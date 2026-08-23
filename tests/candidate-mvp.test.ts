import { describe, expect, it } from 'vitest';
import type { ExamVersion, QuestionRecord } from '@/lib/admin-types';
import { latestPublishedVersions, toCandidateExamSummary } from '@/lib/server/candidate-exam';
import { devUserId } from '@/lib/server/auth';

function question(id:string,level:QuestionRecord['level']='A1'):QuestionRecord{return {id,section:'reading',type:'choice',level,instruction:'読んでください。',prompt:'店は何時に開きますか。',choices:['8時','9時'],answer:1,explanationVi:'9 giờ.',tags:[],version:1,status:'approved',source:'original',createdAt:'x',updatedAt:'x'};}
function version(id:string,examId:string,publishedAt:string,level:QuestionRecord['level']='A1'):ExamVersion{return {id,examId,version:Number(id.match(/\d+$/)?.[0]||1),title:`Đề ${examId}`,durationMinutes:60,rules:[{section:'reading',count:1,allowBack:true,levels:[level]}],createdAt:publishedAt,publishedAt,questions:[{questionId:`q-${id}`,questionVersion:1,snapshot:question(`q-${id}`,level)}]};}

describe('candidate MVP catalog',()=>{
  it('returns only the newest immutable version of each published exam',()=>{
    const values=[version('A-v1','A','2026-01-01'),version('A-v2','A','2026-02-01'),version('B-v1','B','2026-01-15')];
    expect(latestPublishedVersions(values).map(item=>item.id)).toEqual(['A-v2','B-v1']);
  });
  it('derives learner-safe level, count and section metadata',()=>{
    expect(toCandidateExamSummary(version('A-v1','A','2026-01-01'))).toMatchObject({id:'A-v1',level:'A1',questionCount:1,sections:['reading']});
  });
  it('gives different development learners different stable identities',()=>{
    expect(devUserId('candidate','a@example.com')).toBe(devUserId('candidate','A@example.com'));
    expect(devUserId('candidate','a@example.com')).not.toBe(devUserId('candidate','b@example.com'));
  });
});
