import { describe,expect,it } from 'vitest';
import { auditPendingQuestionReviewState,buildPendingQuestionReviewRecords,pendingReviewDigest,reconcilePendingQuestionReviewState,reviewPendingQuestionBatch,summarizePendingQuestionReviews } from '@/lib/server/pending-question-review';
import { hasPendingQuestionReviewToken } from '@/lib/server/pending-question-review-auth';
import type { QuestionRecord } from '@/lib/admin-types';
import { seedQuestions } from '@/data/admin/seed';
import { questions as authoredQuestions } from '@/data/questions';
import type { Repository } from '@/lib/server/domain';

const question=(id:string):QuestionRecord=>({id,section:'reading',type:'choice',level:'A1',instruction:'読んでください。',prompt:'店は6時に閉まります。何時に閉まりますか。',choices:['5時','6時','7時','8時'],answer:1,explanationVi:'6 giờ.',tags:[],version:1,status:'review',source:'ai',createdAt:'x',updatedAt:'x'});

describe('pending Question Bank review',()=>{
  it('keeps an unknown item in review when QA evidence is missing',()=>{
    const [record]=buildPendingQuestionReviewRecords([question('UNKNOWN')]);
    expect(record).toMatchObject({decision:'KEEP_REVIEW',qaSummary:{qa1:'MISSING',qa2:'MISSING',qa3:'MISSING',qa4:'MISSING',qa5:'MISSING',qa6:'MISSING',qa7:'MISSING'}});
  });
  it('never promotes a structurally invalid known item',()=>{
    const source=seedQuestions.find(item=>item.id.startsWith('PROD-'))!;
    const broken={...source,status:'review' as const,choices:[source.choices[0],source.choices[0],source.choices[2],source.choices[3]]};
    const [record]=buildPendingQuestionReviewRecords([broken]);
    expect(record.decision).toBe('REJECT');
    expect(record.reasons.some(reason=>reason.includes('Q0 deterministic validation failed'))).toBe(true);
  });
  it('produces stable summaries and decision digests',()=>{
    const records=buildPendingQuestionReviewRecords([question('B'),question('A')]);
    expect(summarizePendingQuestionReviews(records)).toMatchObject({reviewed:2,approved:0,review:2,rejected:0});
    expect(pendingReviewDigest(records)).toMatch(/^[a-f0-9]{64}$/);
  });
  it('reviews all 2,950 non-authored production items individually without mass approval',()=>{
    const approved=new Set(authoredQuestions.map(item=>item.id));
    const bank=seedQuestions.map(item=>approved.has(item.id)?{...item,status:'approved' as const}:{...item,status:'review' as const});
    const records=buildPendingQuestionReviewRecords(bank),summary=summarizePendingQuestionReviews(records);
    expect(summary.reviewed).toBe(2950);
    expect(summary.approved).toBe(0);
    expect(summary.review+summary.rejected).toBe(2950);
    expect(new Set(records.map(item=>item.questionId)).size).toBe(2950);
  });
  it('applies REJECT through the supported archived state and increments the record version',async()=>{
    const original=seedQuestions.find(item=>item.id.startsWith('PROD-'))!;
    const source={...original,status:'review' as const,choices:[original.choices[0],original.choices[0],original.choices[2],original.choices[3]]};
    let saved:QuestionRecord[]=[];
    const repo={listQuestions:async()=>[source],listFactoryJobs:async()=>[],upsertQuestions:async(items:QuestionRecord[])=>{saved=items;return items}} as unknown as Repository;
    const result=await reviewPendingQuestionBatch(repo,{limit:10,apply:true});
    expect(result.processed).toBe(1);
    expect(result.changed).toEqual([{id:source.id,status:'archived'}]);
    expect(saved[0]).toMatchObject({status:'archived',version:source.version+1});
  });
  it('detects and reconciles drift without creating an approval path',async()=>{
    const original=seedQuestions.find(item=>item.id.startsWith('PROD-'))!;
    const broken={...original,status:'review' as const,choices:[original.choices[0],original.choices[0],original.choices[2],original.choices[3]]};
    const audit=auditPendingQuestionReviewState([broken]);
    expect(audit.driftCount).toBe(1);
    expect(audit.drift[0]).toMatchObject({id:broken.id,decision:'REJECT',expectedStatus:'archived',actualStatus:'review'});
    let bank:QuestionRecord[]=[broken];
    const repo={listQuestions:async()=>bank,listFactoryJobs:async()=>[],upsertQuestions:async(items:QuestionRecord[])=>{bank=items;return items}} as unknown as Repository;
    const result=await reconcilePendingQuestionReviewState(repo);
    expect(result.changed).toEqual([{id:broken.id,status:'archived'}]);
    expect(bank[0].status).toBe('archived');
  });
  it('uses an exact timing-safe one-time token',()=>{
    process.env.PENDING_QUESTION_REVIEW_TOKEN='review-secret';
    expect(hasPendingQuestionReviewToken(new Request('https://test',{headers:{'x-pending-question-review-token':'review-secret'}}))).toBe(true);
    expect(hasPendingQuestionReviewToken(new Request('https://test',{headers:{authorization:'Bearer review-secret'}}))).toBe(true);
    expect(hasPendingQuestionReviewToken(new Request('https://test',{headers:{authorization:'Bearer wrong'}}))).toBe(false);
    delete process.env.PENDING_QUESTION_REVIEW_TOKEN;
  });
});
