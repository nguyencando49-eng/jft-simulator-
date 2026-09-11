import {describe,expect,it} from 'vitest';
import type {ExamDraft} from '@/lib/admin-types';
import {generateExamVersion} from '@/lib/exam-generator';
import {hashA1ReleaseBank, loadA1ReleaseBank} from '@/lib/server/a1-release-bank';
import {loadA21ReleaseBank, validateA21ReleaseBank} from '@/lib/server/a21-release-bank';
import {draftReleaseLevel, loadReleaseBankForDraft} from '@/lib/server/release-bank-provider';
import {scoreFrozenExam} from '@/lib/server/server-scoring';
import type {CandidateSessionRecord} from '@/lib/server/domain';

const a21Draft:ExamDraft={
  id:'A21-RUNTIME-TEST',
  title:'A2.1 Runtime Test',
  durationMinutes:60,
  status:'draft',
  rules:[
    {section:'script_vocabulary',count:13,allowBack:true,levels:['A2.1']},
    {section:'conversation_expression',count:12,allowBack:true,levels:['A2.1']},
    {section:'listening',count:13,allowBack:false,levels:['A2.1']},
    {section:'reading',count:12,allowBack:true,levels:['A2.1']},
  ],
};

describe('A2.1 runtime release provider',()=>{
  it('loads A2.1 release bank server-side with immutable identity',async()=>{
    const loaded=await loadA21ReleaseBank();
    expect(loaded.bank.questionCount).toBe(334);
    expect(loaded.questions).toHaveLength(334);
    expect(loaded.manifest.releaseBankHash).toBe('698860254d6a7a50e33aa214b4e908fce4de7cc8a789a9c185dba056ead069d7');
    expect(()=>validateA21ReleaseBank({bank:loaded.bank,manifest:loaded.manifest})).not.toThrow();
    expect(loaded.questions.every(question=>question.status==='approved')).toBe(true);
    expect(loaded.questions.every(question=>question.level==='A2.1')).toBe(true);
  });

  it('routes A2.1 single-level exam drafts to the release bank, not repository fallback',async()=>{
    expect(draftReleaseLevel(a21Draft)).toBe('A2.1');
    const release=await loadReleaseBankForDraft(a21Draft);
    expect(release.source).toBe('release');
    expect(release.releaseLevel).toBe('A2.1');
    expect(release.releaseVersion).toBe('a21-machine-bank-v1');
    expect(release.questions).toHaveLength(334);
  });

  it('generates and scores an A2.1 exam using display-instance answer indexes',async()=>{
    const {questions}=await loadA21ReleaseBank();
    const generated=generateExamVersion(a21Draft,questions,3);
    expect(generated.ok).toBe(true);
    if(!generated.ok)return;
    expect(generated.version.questions).toHaveLength(50);
    expect(generated.version.questions.filter(q=>q.snapshot.section==='conversation_expression')).toHaveLength(12);
    expect(new Set(generated.version.questions.map(q=>q.questionId)).size).toBe(50);
    const displayedPositions=new Set(generated.version.questions.map(q=>q.snapshot.answer));
    expect(displayedPositions).toEqual(new Set([0,1,2,3]));

    const correctAnswers=Object.fromEntries(generated.version.questions.map(q=>[q.questionId,q.snapshot.answer]));
    const perfect:CandidateSessionRecord={id:'a21-perfect',examVersionId:generated.version.id,candidateId:'candidate',status:'submitted',startedAt:'x',expiresAt:'2099-01-01T00:00:00Z',submittedAt:'x',currentIndex:0,answers:correctAnswers};
    expect(scoreFrozenExam(generated.version,perfect).scorePercent).toBe(100);

    const wrongAnswers={...correctAnswers};
    for(const item of generated.version.questions.slice(0,5)) wrongAnswers[item.questionId]=(item.snapshot.answer+1)%4;
    const wrong:CandidateSessionRecord={...perfect,id:'a21-wrong',answers:wrongAnswers};
    expect(scoreFrozenExam(generated.version,wrong).correct).toBe(45);
  });

  it('preserves A1 runtime behavior and release identity',async()=>{
    const loaded=await loadA1ReleaseBank();
    expect(loaded.bank.questions).toHaveLength(486);
    expect(hashA1ReleaseBank(loaded.bank)).toBe('3e83d4820a8513c4eaf4ed4d974e8ba92f1fb2484abb2e0e423b059871cdc079');
  });
});
