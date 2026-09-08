import {describe,expect,it} from 'vitest';
import type {QuestionRecord} from '@/lib/admin-types';
import {applyChoicePermutation,buildChoicePermutation,detectChoiceOrderLock,validateChoicePermutation} from '@/lib/server/exam-choice-permutation';
import {scoreFrozenExam} from '@/lib/server/server-scoring';
import type {CandidateSessionRecord} from '@/lib/server/domain';

const question=(patch:Partial<QuestionRecord>={}):QuestionRecord=>({
  id:'q1',
  section:'reading',
  type:'choice',
  level:'A1',
  instruction:'文章を読んで、答えてください。',
  prompt:'店は何時までですか。',
  choices:['6時','7時','8時','9時'],
  answer:0,
  explanationVi:'x',
  tags:[],
  version:1,
  status:'approved',
  source:'ai',
  createdAt:'x',
  updatedAt:'x',
  ...patch,
});

describe('exam choice permutation',()=>{
  it('places the canonical answer at every displayed answer position without mutating the canonical question',()=>{
    const canonical=question();
    for(const target of [0,1,2,3]){
      const evidence=buildChoicePermutation({question:canonical,examSeed:'seed',examFormId:`form-${target}`,targetAnswerIndex:target});
      const displayed=applyChoicePermutation(canonical,evidence);
      expect(displayed.answer).toBe(target);
      expect(displayed.choices[target]).toBe(canonical.choices[canonical.answer]);
      expect(canonical.answer).toBe(0);
      expect(canonical.choices).toEqual(['6時','7時','8時','9時']);
    }
  });

  it('is deterministic for replay and can vary across form seeds',()=>{
    const canonical=question();
    const a=buildChoicePermutation({question:canonical,examSeed:'seed',examFormId:'form-a',targetAnswerIndex:2});
    const b=buildChoicePermutation({question:canonical,examSeed:'seed',examFormId:'form-a',targetAnswerIndex:2});
    const c=buildChoicePermutation({question:canonical,examSeed:'seed',examFormId:'form-b',targetAnswerIndex:2});
    expect(a).toEqual(b);
    expect(c.seed).not.toBe(a.seed);
  });

  it('preserves locked choice order',()=>{
    const locked=question({prompt:'正しい順番を選んでください。',choices:['1) 受付 2) 会議室','1) 会議室 2) 受付','1) 食堂 2) 受付','1) 事務所 2) 食堂'],answer:1});
    expect(detectChoiceOrderLock(locked).locked).toBe(true);
    const evidence=buildChoicePermutation({question:locked,examSeed:'seed',examFormId:'form',targetAnswerIndex:3});
    const displayed=applyChoicePermutation(locked,evidence);
    expect(evidence.locked).toBe(true);
    expect(displayed.choices).toEqual(locked.choices);
    expect(displayed.answer).toBe(locked.answer);
  });

  it('rejects malformed permutations',()=>{
    expect(()=>validateChoicePermutation(question(),[0,0,2,3],0)).toThrow(/duplicate/);
    expect(()=>validateChoicePermutation(question(),[1,2,3,4],0)).toThrow(/out of range/);
    expect(()=>validateChoicePermutation(question(),[1,0,2,3],0)).toThrow(/canonical answer/);
  });

  it('scores against the displayed answer index while retaining canonical evidence',()=>{
    const canonical=question();
    const evidence=buildChoicePermutation({question:canonical,examSeed:'seed',examFormId:'form',targetAnswerIndex:3});
    const displayed=applyChoicePermutation(canonical,evidence);
    const version={id:'v1',examId:'e1',version:1,title:'Exam',durationMinutes:1,createdAt:'x',publishedAt:'x',rules:[],questions:[{questionId:canonical.id,questionVersion:1,canonicalSnapshot:canonical,choicePermutation:evidence,snapshot:displayed}]};
    const session:CandidateSessionRecord={id:'s',examVersionId:'v1',status:'submitted',startedAt:'x',expiresAt:'x',submittedAt:'x',currentIndex:0,answers:{[canonical.id]:3}};
    expect(scoreFrozenExam(version,session).correct).toBe(1);
    expect(scoreFrozenExam(version,{...session,answers:{[canonical.id]:0}}).correct).toBe(0);
  });
});
