import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import type {ExamDraft} from '@/lib/admin-types';
import {
  A1_RELEASE_VERSION,
  A1ReleaseBankIntegrityError,
  hashA1ReleaseBank,
  loadA1ReleaseBank,
  validateA1ReleaseBank,
  type A1ReleaseBankArtifact,
  type A1ReleaseManifest,
} from '@/lib/server/a1-release-bank';
import {generateExamVersion} from '@/lib/exam-generator';
import {validateChoicePermutation} from '@/lib/server/exam-choice-permutation';
import {scoreFrozenExam} from '@/lib/server/server-scoring';
import type {CandidateSessionRecord} from '@/lib/server/domain';

const bankPath='data/production/releases/a1-machine-bank-v1.json';
const manifestPath='data/production/releases/a1-machine-bank-v1.manifest.json';
const gatePath='data/qa/a1-production-release-gate-v1.json';
const stressPath='data/qa/a1-production-1000-form-stress-v1.json';

function readJson<T>(path:string):T {
  return JSON.parse(readFileSync(path,'utf8')) as T;
}

function clone<T>(value:T):T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const draft:ExamDraft={
  id:'A1-PRODUCTION-TEST',
  title:'A1 Production Test',
  durationMinutes:60,
  status:'draft',
  rules:[
    {section:'script_vocabulary',count:13,allowBack:true,levels:['A1']},
    {section:'conversation_expression',count:12,allowBack:true,levels:['A1']},
    {section:'listening',count:13,allowBack:false,levels:['A1']},
    {section:'reading',count:12,allowBack:true,levels:['A1']},
  ],
};

describe('A1 production release V1',()=>{
  it('freezes exactly 486 machine-approved questions with a matching manifest hash',()=>{
    const bank=readJson<A1ReleaseBankArtifact>(bankPath);
    const manifest=readJson<A1ReleaseManifest>(manifestPath);
    expect(bank.questionCount).toBe(486);
    expect(bank.questions).toHaveLength(486);
    expect(new Set(bank.questions.map(q=>q.id)).size).toBe(486);
    expect(bank.questions.every(q=>q.approvalMode==='MACHINE')).toBe(true);
    expect(bank.questions.some(q=>String((q as unknown as Record<string,unknown>).humanReviewStatus)==='PENDING')).toBe(false);
    expect(manifest.releaseBankHash).toBe(hashA1ReleaseBank(bank));
    expect(manifest.originalMachineAcceptedCount).toBe(447);
    expect(manifest.recoveredCECount).toBe(39);
    expect(manifest.counts.sections.conversation_expression).toBe(80);
    expect(()=>validateA1ReleaseBank({bank,manifest})).not.toThrow();
  });

  it('loads through the release provider and preserves production metadata for assembly',async()=>{
    const loaded=await loadA1ReleaseBank();
    expect(loaded.questions).toHaveLength(486);
    expect(loaded.questions.every(q=>q.status==='approved')).toBe(true);
    expect(loaded.questions.every(q=>q.tags.includes(`release:${A1_RELEASE_VERSION}`))).toBe(true);
    expect(loaded.questions.every(q=>Array.isArray((q as unknown as {knowledgeUnitIds:string[]}).knowledgeUnitIds))).toBe(true);
  });

  it('loads the default release bank without depending on the process cwd',async()=>{
    const originalCwd=process.cwd();
    process.chdir(process.env.SystemRoot || originalCwd);
    try {
      const loaded=await loadA1ReleaseBank();
      expect(loaded.bank.questionCount).toBe(486);
      expect(loaded.manifest.releaseBankHash).toBe(hashA1ReleaseBank(loaded.bank));
      expect(loaded.questions).toHaveLength(486);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('fails closed for release-bank integrity violations',()=>{
    const bank=readJson<A1ReleaseBankArtifact>(bankPath);
    const manifest=readJson<A1ReleaseManifest>(manifestPath);
    const wrongHash=clone(manifest);
    wrongHash.releaseBankHash='bad-hash';
    expect(()=>validateA1ReleaseBank({bank,manifest:wrongHash})).toThrow(A1ReleaseBankIntegrityError);

    const duplicate=clone(bank);
    duplicate.questions[1].id=duplicate.questions[0].id;
    expect(()=>validateA1ReleaseBank({bank:duplicate,manifest})).toThrow(A1ReleaseBankIntegrityError);

    const pending=clone(bank);
    (pending.questions[0] as unknown as {humanReviewStatus:string}).humanReviewStatus='PENDING';
    expect(()=>validateA1ReleaseBank({bank:pending,manifest})).toThrow(A1ReleaseBankIntegrityError);

    const missingKu=clone(bank);
    missingKu.questions[0].knowledgeUnitIds=[];
    expect(()=>validateA1ReleaseBank({bank:missingKu,manifest})).toThrow(A1ReleaseBankIntegrityError);

    const invalidAnswer=clone(bank);
    invalidAnswer.questions[0].answer=99;
    expect(()=>validateA1ReleaseBank({bank:invalidAnswer,manifest})).toThrow(A1ReleaseBankIntegrityError);
  });

  it('generates deterministic exam instances without mutating canonical release questions',async()=>{
    const {questions}=await loadA1ReleaseBank();
    const before=JSON.stringify(questions);
    const first=generateExamVersion(draft,questions,42);
    const replay=generateExamVersion(draft,questions,42);
    const different=generateExamVersion(draft,questions,43);
    expect(first.ok).toBe(true);
    expect(replay.ok).toBe(true);
    expect(different.ok).toBe(true);
    if(!first.ok||!replay.ok||!different.ok)return;

    expect(first.version.questions.map(q=>q.questionId)).toEqual(replay.version.questions.map(q=>q.questionId));
    expect(first.version.questions.map(q=>q.choicePermutation?.permutation)).toEqual(replay.version.questions.map(q=>q.choicePermutation?.permutation));
    expect(first.version.questions.map(q=>q.questionId)).not.toEqual(different.version.questions.map(q=>q.questionId));
    expect(JSON.stringify(questions)).toBe(before);

    for (const item of first.version.questions) {
      expect(item.canonicalSnapshot).toBeTruthy();
      expect(item.choicePermutation).toBeTruthy();
      validateChoicePermutation(item.canonicalSnapshot!,item.choicePermutation!.permutation,item.choicePermutation!.displayAnswerIndex);
      expect(item.snapshot.answer).toBe(item.choicePermutation!.displayAnswerIndex);
      expect(item.snapshot.choices[item.snapshot.answer]).toBe(item.canonicalSnapshot!.choices[item.canonicalSnapshot!.answer]);
    }
  });

  it('scores displayed answers from the immutable exam snapshot',async()=>{
    const {questions}=await loadA1ReleaseBank();
    const generated=generateExamVersion(draft,questions,7);
    expect(generated.ok).toBe(true);
    if(!generated.ok)return;
    const correctAnswers=Object.fromEntries(generated.version.questions.map(q=>[q.questionId,q.snapshot.answer]));
    const correctSession:CandidateSessionRecord={id:'s1',examVersionId:generated.version.id,status:'submitted',startedAt:'x',expiresAt:'2099-01-01T00:00:00Z',submittedAt:'x',currentIndex:0,answers:correctAnswers};
    expect(scoreFrozenExam(generated.version,correctSession).scorePercent).toBe(100);

    const wrongAnswers=Object.fromEntries(generated.version.questions.map(q=>[q.questionId,(q.snapshot.answer+1)%q.snapshot.choices.length]));
    const wrongSession:CandidateSessionRecord={...correctSession,id:'s2',answers:wrongAnswers};
    expect(scoreFrozenExam(generated.version,wrongSession).scorePercent).toBeLessThan(100);
  });

  it('records a passing production release gate and 1000-form stress result',()=>{
    const gate=readJson<{summary:{finalDecision:string;releaseBankCount:number;negativeSafetyTests:{pass:number;fail:number};fullSessionSmoke:{pass:number;fail:number}}}>(gatePath);
    const stress=readJson<{summary:{stress:{examCount:number;pass:number;fail:number;totalQuestionInstances:number;scoringMismatches:number;duplicateWithinForm:number;replayFailures:number;canonicalMutations:number;answerPositions:Record<string,number>}}}>(stressPath);
    expect(gate.summary.finalDecision).toBe('A1_PRODUCTION_CANDIDATE_READY');
    expect(gate.summary.releaseBankCount).toBe(486);
    expect(gate.summary.negativeSafetyTests).toMatchObject({pass:10,fail:0});
    expect(gate.summary.fullSessionSmoke.fail).toBe(0);
    expect(stress.summary.stress).toMatchObject({examCount:1000,pass:1000,fail:0,totalQuestionInstances:50000,scoringMismatches:0,duplicateWithinForm:0,replayFailures:0,canonicalMutations:0});
    expect(stress.summary.stress.answerPositions).toEqual({A:13000,B:13000,C:12000,D:12000});
  });
});
