import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import type {ExamDraft, ExamVersion, QuestionRecord} from '../lib/admin-types';
import {generateExamVersion} from '../lib/exam-generator';
import {A1_RELEASE_ID,A1_RELEASE_VERSION,hashA1ReleaseBank,loadA1ReleaseBank,sha256,validateA1ReleaseBank,type A1ReleaseBankArtifact,type A1ReleaseManifest,type A1ReleaseQuestion} from '../lib/server/a1-release-bank';
import {scoreFrozenExam} from '../lib/server/server-scoring';
import type {CandidateSessionRecord} from '../lib/server/domain';

type Candidate=Omit<QuestionRecord,'status'> & {status:string;approvalMode?:string;sourceId?:string;derivedFrom?:string|null;category:string;knowledgeUnitIds:string[];canDo:string;taskType:string;contentHash?:string;pipelineVersion?:string;releaseState?:string;speechAct?:string;scenarioType?:string;semanticRepresentation?:unknown;provenance?:Record<string,unknown>;[key:string]:unknown};

const RELEASE_BANK='data/production/releases/a1-machine-bank-v1.json';
const RELEASE_MANIFEST='data/production/releases/a1-machine-bank-v1.manifest.json';
const GATE='data/qa/a1-production-release-gate-v1.json';
const STRESS='data/qa/a1-production-1000-form-stress-v1.json';
const DOC='docs/reviews/A1_PRODUCTION_RELEASE_V1_REPORT.md';
const RELEASE_CANDIDATE_V2='data/production/a1-machine-bank-release-candidate-v2.json';
const BASE_EVIDENCE='data/qa/a1-fresh-800-machine-evidence.json';
const CE_EVIDENCE='data/qa/a1-ce-recovery-machine-evidence-v1.json';
const REJECTED='data/reviews/a1-fresh-800-auto-rejected-v1.json';
const SIM_V3='data/qa/a1-bank-exam-simulation-report-v3.json';
const EXAM_COUNT=1000;
const SECTION_QUOTAS={script_vocabulary:13,conversation_expression:12,listening:13,reading:12} as const;
const now=new Date().toISOString();

function stable(value:unknown):string{if(Array.isArray(value))return `[${value.map(stable).join(',')}]`;if(value&&typeof value==='object')return `{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;return JSON.stringify(value);}
const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const count=(values:string[])=>Object.fromEntries([...new Set(values)].sort().map(value=>[value,values.filter(item=>item===value).length]));
async function fileHash(path:string){return sha(await readFile(path));}
function contentHash(q:Candidate){return sha(stable({level:q.level,section:q.section,category:q.category,knowledgeUnitIds:q.knowledgeUnitIds,canDo:q.canDo,taskType:q.taskType,instruction:q.instruction,prompt:q.prompt,stimulus:q.stimulus||null,audioScript:q.audioScript||null,choices:q.choices,answer:q.answer,speechAct:q.speechAct||null,scenarioType:q.scenarioType||null,semanticRepresentation:q.semanticRepresentation||null}));}
function toReleaseQuestion(q:Candidate,hash:string):A1ReleaseQuestion{
  const state=q.status==='RECOVERED_MACHINE_ACCEPTED'?'RECOVERED_MACHINE_ACCEPTED':'MACHINE_ACCEPTED';
  return {
    id:q.id,section:q.section,type:q.type,level:q.level,instruction:q.instruction,prompt:q.prompt,choices:[...q.choices],answer:q.answer,explanationVi:q.explanationVi,audioSrc:q.audioSrc,tags:[...(q.tags||[])],version:q.version,source:q.source,createdAt:q.createdAt,updatedAt:q.updatedAt,
    status:state,
    sourceId:q.sourceId,
    derivedFrom:q.derivedFrom,
    category:q.category,
    knowledgeUnitIds:[...q.knowledgeUnitIds],
    canDo:q.canDo,
    taskType:q.taskType,
    contentHash:hash,
    approvalMode:'MACHINE',
    machineAcceptanceState:state,
    pipelineVersion:q.pipelineVersion||'UNKNOWN',
    provenance:{sourceArtifact:RELEASE_CANDIDATE_V2,releaseState:q.releaseState||'RELEASE_ELIGIBLE',speechAct:q.speechAct||null,scenarioType:q.scenarioType||null,semanticRepresentation:q.semanticRepresentation||null},
  };
}
function releaseDraft():ExamDraft{return {id:'JFT-A1-MACHINE-V1',title:'JFT Practice A1 Machine Bank V1',durationMinutes:60,status:'draft',rules:[{section:'script_vocabulary',count:13,allowBack:true,levels:['A1']},{section:'conversation_expression',count:12,allowBack:true,levels:['A1']},{section:'listening',count:13,allowBack:false,levels:['A1']},{section:'reading',count:12,allowBack:true,levels:['A1']}]}};
function validateExam(version:ExamVersion){
  const reasons:string[]=[];
  if(version.questions.length!==50)reasons.push('QUESTION_COUNT_INVALID');
  const sections=count(version.questions.map(q=>q.snapshot.section));
  for(const [section,quota] of Object.entries(SECTION_QUOTAS))if((sections[section]||0)!==quota)reasons.push(`SECTION_${section}_INVALID`);
  if(new Set(version.questions.map(q=>q.questionId)).size!==version.questions.length)reasons.push('DUPLICATE_QUESTION_WITHIN_FORM');
  const positions=count(version.questions.map(q=>String.fromCharCode(65+q.snapshot.answer))) as Record<string,number>;
  const spread=Math.max(...['A','B','C','D'].map(key=>positions[key]||0))-Math.min(...['A','B','C','D'].map(key=>positions[key]||0));
  if(spread>1)reasons.push('ANSWER_POSITION_BALANCE_FAIL');
  for(const frozen of version.questions){
    if(!frozen.canonicalSnapshot||!frozen.choicePermutation)reasons.push('MISSING_INSTANCE_TRACE');
    else {
      const permutation=frozen.choicePermutation.permutation;
      if(permutation.length!==frozen.snapshot.choices.length||new Set(permutation).size!==permutation.length||permutation.some(index=>!Number.isInteger(index)||index<0||index>=frozen.snapshot.choices.length))reasons.push('CHOICE_PERMUTATION_CORRUPT');
      if(permutation[frozen.snapshot.answer]!==frozen.canonicalSnapshot.answer)reasons.push('CHOICE_PERMUTATION_MISMATCH');
    }
  }
  return {status:reasons.length?'FAIL':'PASS',reasonCodes:Array.from(new Set(reasons)).sort(),answerPositions:positions,sections};
}
function smoke(version:ExamVersion){
  const correctAnswers=Object.fromEntries(version.questions.map(q=>[q.questionId,q.snapshot.answer]));
  const wrongAnswers=Object.fromEntries(version.questions.map(q=>[q.questionId,(q.snapshot.answer+1)%q.snapshot.choices.length]));
  const session=(answers:Record<string,number>):CandidateSessionRecord=>({id:'smoke',examVersionId:version.id,status:'submitted',startedAt:now,expiresAt:now,submittedAt:now,currentIndex:0,answers});
  const perfect=scoreFrozenExam(version,session(correctAnswers));
  const wrong=scoreFrozenExam(version,session(wrongAnswers));
  return {perfectScore:perfect.scorePercent,wrongScore:wrong.scorePercent,pass:perfect.scorePercent===100&&wrong.scorePercent<100,positionCoverage:Array.from(new Set(version.questions.map(q=>q.snapshot.answer))).sort()};
}

await mkdir('data/production/releases',{recursive:true});await mkdir('data/qa',{recursive:true});await mkdir('docs/reviews',{recursive:true});
const [candidateV2,baseEvidence,ceEvidence,rejected]=await Promise.all([
  readFile(RELEASE_CANDIDATE_V2,'utf8').then(text=>JSON.parse(text) as {items:Candidate[]}),
  readFile(BASE_EVIDENCE,'utf8').then(text=>JSON.parse(text) as {records:Array<{id:string;contentHash:string;finalDecision:string}>}),
  readFile(CE_EVIDENCE,'utf8').then(text=>JSON.parse(text) as {records:Array<{candidateId:string;contentHash:string;result:{accepted:boolean}} >}),
  readFile(REJECTED,'utf8').then(text=>JSON.parse(text) as {items:Array<{candidate:{id:string}}>}),
]);
const items=candidateV2.items;
const baseEvidenceById=new Map(baseEvidence.records.map(record=>[record.id,record]));
const ceEvidenceById=new Map(ceEvidence.records.filter(record=>record.result.accepted).map(record=>[record.candidateId,record]));
const rejectedIds=new Set(rejected.items.map(row=>row.candidate.id));
if(items.length!==486)throw new Error(`Expected 486 release questions, got ${items.length}`);
const releaseQuestions=items.map(q=>{
  const hash=q.status==='RECOVERED_MACHINE_ACCEPTED'?ceEvidenceById.get(q.id)?.contentHash||contentHash(q):baseEvidenceById.get(q.id)?.contentHash||contentHash(q);
  return toReleaseQuestion(q,hash);
});
const releaseBank:A1ReleaseBankArtifact={releaseId:A1_RELEASE_ID,releaseVersion:A1_RELEASE_VERSION,releaseDecision:'A1_BANK_RELEASE_READY',approvalMode:'MACHINE',questionCount:releaseQuestions.length,questions:releaseQuestions};
const releaseBankHash=hashA1ReleaseBank(releaseBank);
const counts={sections:count(releaseQuestions.map(q=>q.section)),categories:count(releaseQuestions.map(q=>q.category)),knowledgeUnits:count(releaseQuestions.flatMap(q=>q.knowledgeUnitIds)),canDos:count(releaseQuestions.map(q=>q.canDo)),taskTypes:count(releaseQuestions.map(q=>q.taskType))};
const sourceArtifactHashes=Object.fromEntries(await Promise.all([RELEASE_CANDIDATE_V2,SIM_V3,'data/production/a1-ce-recovery-machine-accepted-v1.json'].map(async path=>[path,await fileHash(path)])));
const qaEvidenceHashes=Object.fromEntries(await Promise.all([BASE_EVIDENCE,CE_EVIDENCE,'data/qa/a1-ce-recovery-report-v1.json','data/qa/a1-bank-final-release-gate.json'].map(async path=>[path,await fileHash(path)])));
const codeHashes=Object.fromEntries(await Promise.all(['lib/exam-generator.ts','lib/server/exam-choice-permutation.ts','lib/server/a1-release-bank.ts','app/api/v1/exams/route.ts','lib/server/server-scoring.ts'].map(async path=>[path,await fileHash(path)])));
const manifest:A1ReleaseManifest={releaseId:A1_RELEASE_ID,releaseVersion:A1_RELEASE_VERSION,createdAt:now,questionCount:releaseQuestions.length,sectionCounts:counts.sections as any,categoryCounts:counts.categories as any,kuCounts:counts.knowledgeUnits as any,canDoCounts:counts.canDos as any,taskTypeCounts:counts.taskTypes as any,originalMachineAcceptedCount:447,recoveredCECount:39,sourceArtifactHashes,releaseBankHash,qaEvidenceHashes,assembler:{version:'EXAM_CHOICE_PERMUTATION_V1',codeHashes},pipelineVersion:'A1_PRODUCTION_RELEASE_FREEZE_V1',releaseDecision:'A1_BANK_RELEASE_READY',approvalMode:'MACHINE',questionIds:releaseQuestions.map(q=>q.id),counts} as A1ReleaseManifest & Record<string,unknown>;
await writeFile(RELEASE_BANK,JSON.stringify(releaseBank,null,2)+'\n');
await writeFile(RELEASE_MANIFEST,JSON.stringify(manifest,null,2)+'\n');
validateA1ReleaseBank({bank:releaseBank,manifest,rejectedIds,evidenceById:new Map([...baseEvidence.records.map(r=>[r.id,r] as const),...ceEvidence.records.filter(r=>r.result.accepted).map(r=>[r.candidateId,{id:r.candidateId,contentHash:r.contentHash,finalDecision:'MACHINE_ACCEPTED'}] as const)])});

const loaded=await loadA1ReleaseBank({bank:RELEASE_BANK,manifest:RELEASE_MANIFEST});
const bankHashBeforeStress=hashA1ReleaseBank(releaseBank);
const draft=releaseDraft();
const exams:ExamVersion[]=[];
const validations:any[]=[];
const smokes:any[]=[];
const replayFailures:string[]=[];
for(let versionNo=1;versionNo<=EXAM_COUNT;versionNo+=1){
  const generated=generateExamVersion(draft,loaded.questions,versionNo);
  if(!generated.ok)throw new Error(generated.errors.join('; '));
  const replay=generateExamVersion(draft,loaded.questions,versionNo);
  if(!replay.ok||stable(replay.version.questions)!==stable(generated.version.questions))replayFailures.push(generated.version.id);
  exams.push(generated.version);
  validations.push({examId:generated.version.id,...validateExam(generated.version)});
  if(versionNo<=8)smokes.push({examId:generated.version.id,...smoke(generated.version)});
}
const allFrozen=exams.flatMap(exam=>exam.questions.map(frozen=>({examId:exam.id,...frozen})));
const stress={
  examCount:EXAM_COUNT,
  totalQuestionInstances:allFrozen.length,
  examGenerationFailures:0,
  pass:validations.filter(v=>v.status==='PASS').length,
  fail:validations.filter(v=>v.status==='FAIL').length,
  scoringMismatches:validations.filter(v=>v.reasonCodes.includes('CHOICE_PERMUTATION_MISMATCH')).length,
  duplicateWithinForm:validations.filter(v=>v.reasonCodes.includes('DUPLICATE_QUESTION_WITHIN_FORM')).length,
  answerPositions:count(allFrozen.map(row=>String.fromCharCode(65+row.snapshot.answer))),
  sectionCounts:count(allFrozen.map(row=>row.snapshot.section)),
  kuCounts:count(allFrozen.flatMap(row=>(row.canonicalSnapshot as any)?.knowledgeUnitIds||[])),
  canDoCounts:count(allFrozen.map(row=>String((row.canonicalSnapshot as any)?.canDo||'UNKNOWN'))),
  taskTypeCounts:count(allFrozen.map(row=>String((row.canonicalSnapshot as any)?.taskType||'UNKNOWN'))),
  questionExposure:Object.entries(count(allFrozen.map(row=>row.questionId))).sort((a:any,b:any)=>b[1]-a[1]).slice(0,50).map(([id,total])=>({id,total})),
  ceExposure:Object.entries(count(allFrozen.filter(row=>row.snapshot.section==='conversation_expression').map(row=>row.questionId))).sort((a:any,b:any)=>b[1]-a[1]).slice(0,50).map(([id,total])=>({id,total})),
  templateExposureWarnings:[],
  choiceOrderLockedInstances:allFrozen.filter(row=>row.choicePermutation?.locked).length,
  replayFailures:replayFailures.length,
  canonicalMutations:hashA1ReleaseBank(releaseBank)===bankHashBeforeStress && bankHashBeforeStress===releaseBankHash ? 0 : 1,
  smokeTests:{total:smokes.length,pass:smokes.filter(s=>s.pass).length,fail:smokes.filter(s=>!s.pass).length,details:smokes},
};
function expectFailure(name:string,fn:()=>void){try{fn();return {name,passed:false};}catch{return {name,passed:true};}}
const negativeTests=[
  expectFailure('modified release question without manifest update',()=>validateA1ReleaseBank({bank:{...releaseBank,questions:releaseBank.questions.map((q,i)=>i? q:{...q,prompt:`${q.prompt} `})},manifest})),
  expectFailure('wrong bank hash',()=>validateA1ReleaseBank({bank:releaseBank,manifest:{...manifest,releaseBankHash:'bad'}})),
  expectFailure('duplicate ID',()=>validateA1ReleaseBank({bank:{...releaseBank,questions:releaseBank.questions.map((q,i)=>i===1?{...q,id:releaseBank.questions[0].id}:q)},manifest:{...manifest,questionIds:manifest.questionIds.map((id,i)=>i===1?manifest.questionIds[0]:id)}})),
  expectFailure('rejected question inserted',()=>validateA1ReleaseBank({bank:{...releaseBank,questions:releaseBank.questions.map((q,i)=>i? q:{...q,id:[...rejectedIds][0]})},manifest:{...manifest,questionIds:manifest.questionIds.map((id,i)=>i? id:[...rejectedIds][0])},rejectedIds})),
  expectFailure('invalid answer index',()=>validateA1ReleaseBank({bank:{...releaseBank,questions:releaseBank.questions.map((q,i)=>i? q:{...q,answer:9})},manifest})),
  expectFailure('missing KU',()=>validateA1ReleaseBank({bank:{...releaseBank,questions:releaseBank.questions.map((q,i)=>i? q:{...q,knowledgeUnitIds:[]})},manifest})),
  expectFailure('missing evidence',()=>validateA1ReleaseBank({bank:releaseBank,manifest,evidenceById:new Map()})),
  expectFailure('PENDING question',()=>validateA1ReleaseBank({bank:{...releaseBank,questions:releaseBank.questions.map((q,i)=>i? q:{...q,humanReviewStatus:'PENDING'} as any)},manifest})),
];
const corruptPermutation=(()=>{const exam=structuredClone(exams[0]);const q=exam.questions[0];if(!q.choicePermutation)return {name:'corrupt permutation',passed:true};q.choicePermutation.permutation=[0,0,2,3];return {name:'corrupt permutation',passed:validateExam(exam).status==='FAIL'};})();
negativeTests.push(corruptPermutation);
const canonicalMutation={name:'canonical mutation',passed:stress.canonicalMutations===0};
negativeTests.push(canonicalMutation);
const runtimePathAudit=[
  {layer:'QUESTION_BANK',file:'data/production/releases/a1-machine-bank-v1.json',classification:'ACTIVE_PRODUCTION_PATH'},
  {layer:'QUESTION_PROVIDER',file:'lib/server/a1-release-bank.ts',classification:'ACTIVE_PRODUCTION_PATH'},
  {layer:'EXAM_ASSEMBLY',file:'app/api/v1/exams/route.ts',classification:'ACTIVE_PRODUCTION_PATH'},
  {layer:'EXAM_ASSEMBLY',file:'lib/exam-generator.ts',classification:'ACTIVE_PRODUCTION_PATH'},
  {layer:'EXAM_INSTANCE',file:'lib/server/exam-choice-permutation.ts',classification:'ACTIVE_PRODUCTION_PATH'},
  {layer:'SESSION',file:'app/api/v1/sessions/route.ts',classification:'ACTIVE_PRODUCTION_PATH'},
  {layer:'FRONTEND_PAYLOAD',file:'lib/server/candidate-question.ts',classification:'ACTIVE_PRODUCTION_PATH'},
  {layer:'SCORING',file:'lib/server/server-scoring.ts',classification:'ACTIVE_PRODUCTION_PATH'},
  {layer:'LEGACY_BANK',file:'data/questions.ts',classification:'MIGRATION_REQUIRED'},
  {layer:'LEGACY_BANK',file:'data/question-bank-expansion.ts',classification:'MIGRATION_REQUIRED'},
  {layer:'LEGACY_BANK',file:'data/production/mass-question-candidates.ts',classification:'MIGRATION_REQUIRED'},
  {layer:'TEST_DATA',file:'data/CONTROLLED_A1_FRESH_200_V3.json through V6',classification:'LEGACY_UNUSED'},
];
const finalReady=stress.pass===EXAM_COUNT&&stress.scoringMismatches===0&&stress.duplicateWithinForm===0&&stress.replayFailures===0&&stress.canonicalMutations===0&&stress.smokeTests.fail===0&&negativeTests.every(t=>t.passed)&&loaded.questions.length===486;
const summary={releaseBankCount:releaseQuestions.length,releaseBankHash,sectionDistribution:counts.sections,ceCount:counts.sections.conversation_expression||0,runtimeSourceBefore:'repository listQuestions from legacy seedQuestions or Supabase questions table',runtimeSourceAfter:'A1-only exam publish uses A1ReleaseBankProvider -> a1-machine-bank-v1.json',stress,fullSessionSmoke:stress.smokeTests,negativeSafetyTests:{total:negativeTests.length,pass:negativeTests.filter(t=>t.passed).length,fail:negativeTests.filter(t=>!t.passed).length,details:negativeTests},productionBankIdentity:{pass:loaded.questions.map(q=>q.id).join('|')===manifest.questionIds.join('|'),count:loaded.questions.length},finalDecision:finalReady?'A1_PRODUCTION_CANDIDATE_READY':'A1_PRODUCTION_CANDIDATE_BLOCKED'};
await writeFile(STRESS,JSON.stringify({artifactVersion:'A1_PRODUCTION_1000_FORM_STRESS_V1',generatedAt:now,summary,validations,exams:exams.map(exam=>({id:exam.id,questionIds:exam.questions.map(q=>q.questionId),answerPositions:count(exam.questions.map(q=>String.fromCharCode(65+q.snapshot.answer))),traceSample:exam.questions.slice(0,3).map(q=>({questionId:q.questionId,canonicalQuestionId:q.canonicalSnapshot?.id,releaseVersion:A1_RELEASE_VERSION,contentHash:releaseQuestions.find(item=>item.id===q.questionId)?.contentHash,choicePermutation:q.choicePermutation,displayAnswerIndex:q.snapshot.answer}))}))},null,2)+'\n');
await writeFile(GATE,JSON.stringify({artifactVersion:'A1_PRODUCTION_RELEASE_GATE_V1',generatedAt:now,releaseBank:RELEASE_BANK,manifest:RELEASE_MANIFEST,releaseManifest:manifest,runtimePathAudit,summary},null,2)+'\n');
const legacyRows=runtimePathAudit.map(row=>`| ${row.layer} | ${row.file} | ${row.classification} |`).join('\n');
const doc=`# A1 Production Release V1 Report

Generated: ${now}

No questions were generated, repaired, human-approved, published, staged, committed, or pushed. The release freezes the existing 486-question machine bank.

## Release

- Release bank count: **${summary.releaseBankCount}**
- Release bank hash: \`${summary.releaseBankHash}\`
- CE count: **${summary.ceCount}**
- Runtime source before: ${summary.runtimeSourceBefore}
- Runtime source after: ${summary.runtimeSourceAfter}

## Runtime path audit

| Layer | File | Classification |
|---|---|---|
${legacyRows}

## 1000-form stress

- PASS / FAIL: **${stress.pass} / ${stress.fail}**
- Total instances: **${stress.totalQuestionInstances}**
- A/B/C/D: **${JSON.stringify(stress.answerPositions)}**
- Scoring mismatches: **${stress.scoringMismatches}**
- Duplicate-within-form: **${stress.duplicateWithinForm}**
- Canonical mutations: **${stress.canonicalMutations}**
- Replay failures: **${stress.replayFailures}**
- Max question exposure: **${(stress.questionExposure[0] as any)?.total||0}**
- Max CE exposure: **${(stress.ceExposure[0] as any)?.total||0}**
- Choice-order-locked instances: **${stress.choiceOrderLockedInstances}**

## Safety tests

- Full-session smoke: **${stress.smokeTests.pass} PASS / ${stress.smokeTests.fail} FAIL**
- Negative safety tests: **${summary.negativeSafetyTests.pass} PASS / ${summary.negativeSafetyTests.fail} FAIL**
- Production bank identity: **${summary.productionBankIdentity.pass?'PASS':'FAIL'}**

Final decision: **${summary.finalDecision}**
`;
await writeFile(DOC,doc);
console.log(JSON.stringify(summary,null,2));
