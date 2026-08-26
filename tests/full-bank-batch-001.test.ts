import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe,expect,it } from 'vitest';
import { seedQuestions } from '@/data/admin/seed';
import pendingReview from '@/data/reviews/pending-question-review-2026-08-23.json';
import batch from '@/data/reviews/full-bank/BATCH-001-DECISIONS.json';

const levelOrder:Record<string,number>={'A1':0,'A2.1':1,'A2.2':2};
const sectionOrder:Record<string,number>={script_vocabulary:0,conversation_expression:1,listening:2,reading:3};
const queue=pendingReview.records.filter(record=>record.decision==='KEEP_REVIEW').sort((left,right)=>
  levelOrder[left.level]-levelOrder[right.level]
  ||sectionOrder[left.section]-sectionOrder[right.section]
  ||left.questionId.localeCompare(right.questionId),
);

describe('full-bank manual repair Batch 001',()=>{
  it('covers exactly the first 25 deterministic queue items once',()=>{
    const ids=batch.records.map(record=>record.questionId);
    expect(ids).toEqual(queue.slice(0,25).map(record=>record.questionId));
    expect(new Set(ids).size).toBe(25);
    expect(batch.records.every(record=>record.batchId==='BATCH-001'&&record.currentStatus==='review')).toBe(true);
  });

  it('reconciles decisions and mandatory decision evidence',()=>{
    const counts=Object.fromEntries(['KEEP','REVISE','REVIEW_LEVEL','HOLD_AUDIO','REMOVE'].map(decision=>[
      decision,batch.records.filter(record=>record.decision===decision).length,
    ]));
    expect(counts).toEqual({KEEP:3,REVISE:1,REVIEW_LEVEL:0,HOLD_AUDIO:5,REMOVE:16});
    for(const record of batch.records){
      expect(record.reviewReason.trim().length,record.questionId).toBeGreaterThan(20);
      if(record.decision==='REVISE'){
        expect(Object.keys(record.before).length,record.questionId).toBeGreaterThan(0);
        expect(Object.keys(record.after).length,record.questionId).toBeGreaterThan(0);
      }
      if(record.decision==='HOLD_AUDIO')expect(record.remainingHumanCheck,record.questionId).toContain('Listen');
    }
  });

  it('applies only the audited high-confidence repair and preserves its answer text',()=>{
    const revised=batch.records.filter(record=>record.decision==='REVISE');
    expect(revised.map(record=>record.questionId)).toEqual(['A1P3-SV-002']);
    const question=seedQuestions.find(item=>item.id==='A1P3-SV-002')!;
    expect(question.prompt).toBe('「名前」の よみかたは どれですか。');
    expect(question.choices[question.answer]).toBe('なまえ');
    expect(question.status).toBe('review');
  });

  it('keeps every held listening file present while requiring audible review',()=>{
    for(const record of batch.records.filter(record=>record.decision==='HOLD_AUDIO')){
      const question=seedQuestions.find(item=>item.id===record.questionId)!;
      expect(question.section).toBe('listening');
      expect(question.audioSrc).toBeTruthy();
      expect(existsSync(join(process.cwd(),'public',question.audioSrc!))).toBe(true);
      expect(record.audioVerified).toBe(false);
    }
  });

  it('keeps answer indexes valid for every reviewed item',()=>{
    const byId=new Map(seedQuestions.map(question=>[question.id,question]));
    for(const record of batch.records){
      const question=byId.get(record.questionId)!;
      expect(question,record.questionId).toBeTruthy();
      expect(question.answer,record.questionId).toBeGreaterThanOrEqual(0);
      expect(question.answer,record.questionId).toBeLessThan(question.choices.length);
    }
  });
});
