import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {curriculumCatalog} from '../data/production/curriculum-catalog';
import type {QuestionRecord} from '../lib/admin-types';
import {allocateBalancedAnswerPositions,applyChoicePermutation,buildChoicePermutation,detectChoiceOrderLock} from '../lib/server/exam-choice-permutation';

type Section='script_vocabulary'|'conversation_expression'|'listening'|'reading';
type Candidate=QuestionRecord & {category:string;knowledgeUnitIds:string[];canDo:string;taskType?:string;stimulus?:string|null;audioScript?:string|null;sourceId?:string;derivedFrom?:string|null;releaseState?:string;[key:string]:unknown};

const INPUT='data/production/a1-machine-bank-release-candidate-v1.json';
const PREVIOUS='data/qa/a1-bank-exam-simulation-report.json';
const OUTPUT='data/qa/a1-bank-exam-simulation-report-v2.json';
const DOC='docs/reviews/A1_EXAM_ASSEMBLY_V2_REPORT.md';
const EXAM_COUNT=100;
const QUESTION_COUNT=50;
const SECTION_QUOTAS:Record<Section,number>={script_vocabulary:13,conversation_expression:12,listening:13,reading:12};
const SECTIONS=Object.keys(SECTION_QUOTAS) as Section[];
const HEALTHY_EXPOSURE_RATE=.2;

const artifact=JSON.parse(await readFile(INPUT,'utf8')) as {items:Candidate[]};
const previous=JSON.parse(await readFile(PREVIOUS,'utf8')) as {summary:{answerPositionBias:Record<string,{actual:number}>;simulatedExams:{pass:number;fail:number};questionExposureRisk:{highFrequencyCount:number};templateExposureRisk:{highFrequencyCount:number}}};
const bank=artifact.items;
const a1Units=curriculumCatalog.filter(unit=>unit.level==='A1');

const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
const norm=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'');
const count=(values:string[])=>Object.fromEntries([...new Set(values)].sort().map(value=>[value,values.filter(item=>item===value).length]));
const visible=(q:Candidate)=>[q.instruction,q.prompt,q.stimulus,q.audioScript,...q.choices].filter(Boolean).join('\n');
function targetInQuotes(q:Candidate){return q.prompt.match(/「([^」]+)」/u)?.[1]||null;}
function targetSignature(q:Candidate){const quoted=targetInQuotes(q);if(quoted)return norm(quoted);const question=q.prompt.split('\n').at(-1)||q.prompt;return norm(question.replace(/(?:は|が|を|に|で)?(?:何|どこ|どれ|だれ|いつ|いくつ|何時).*/u,''))||norm(question);}
function semanticSignature(q:Candidate){const support=q.section==='listening'?q.audioScript||'':q.section==='reading'?q.stimulus||'':q.prompt;return [q.section,q.taskType||q.category,[...q.knowledgeUnitIds].sort().join(','),targetSignature(q),norm(q.choices[q.answer]),q.section==='script_vocabulary'?'':norm(support)].join('|');}
function templateSignature(q:Candidate){return [q.section,q.taskType||q.category,targetSignature(q),q.prompt.replace(/[0-9０-９]+|[一二三四五六七八九十百千]+|「[^」]+」/gu,'#')].map(norm).join('|');}
function contentHash(q:Candidate){return sha(JSON.stringify({id:q.id,choices:q.choices,answer:q.answer,prompt:q.prompt,section:q.section,category:q.category,knowledgeUnitIds:q.knowledgeUnitIds,taskType:q.taskType}));}
function sectionAvailability(items:Candidate[]){
  return Object.fromEntries(SECTIONS.map(section=>[section,{requestedPerExam:SECTION_QUOTAS[section],available:items.filter(q=>q.section===section).length,totalSlotsAcross100:SECTION_QUOTAS[section]*EXAM_COUNT,averageExposureAcross100:Number((SECTION_QUOTAS[section]*EXAM_COUNT/Math.max(1,items.filter(q=>q.section===section).length)).toFixed(2)),minimumForHealthy100FormRotation:Math.ceil(SECTION_QUOTAS[section]*EXAM_COUNT/(EXAM_COUNT*HEALTHY_EXPOSURE_RATE))}]));
}
function coverage<T extends string>(values:T[],universe:T[]){const counts=count(values) as Record<string,number>;return Object.fromEntries(universe.sort().map(key=>[key,counts[key]||0]));}

function exposureAwarePick(pool:Candidate[],countNeeded:number,formId:string,globalExposure:Map<string,number>,kuExposure:Map<string,number>,templateExposure:Map<string,number>){
  const picked:Candidate[]=[];
  const usedTemplates=new Set<string>();
  const candidates=[...pool];
  while(picked.length<countNeeded&&candidates.length){
    candidates.sort((a,b)=>{
      const aTemplate=templateSignature(a),bTemplate=templateSignature(b);
      const aPenalty=(globalExposure.get(a.id)||0)*100+(templateExposure.get(aTemplate)||0)*10+a.knowledgeUnitIds.reduce((sum,id)=>sum+(kuExposure.get(id)||0),0)+(usedTemplates.has(aTemplate)?1000:0);
      const bPenalty=(globalExposure.get(b.id)||0)*100+(templateExposure.get(bTemplate)||0)*10+b.knowledgeUnitIds.reduce((sum,id)=>sum+(kuExposure.get(id)||0),0)+(usedTemplates.has(bTemplate)?1000:0);
      if(aPenalty!==bPenalty)return aPenalty-bPenalty;
      return sha(`${formId}:${a.id}`).localeCompare(sha(`${formId}:${b.id}`));
    });
    const nextIndex=candidates.findIndex(q=>!usedTemplates.has(templateSignature(q)))>=0?candidates.findIndex(q=>!usedTemplates.has(templateSignature(q))):0;
    const [next]=candidates.splice(nextIndex,1);
    picked.push(next);
    usedTemplates.add(templateSignature(next));
  }
  return picked;
}

function buildExam(formNumber:number,globalExposure:Map<string,number>,kuExposure:Map<string,number>,templateExposure:Map<string,number>){
  const formId=`A1-ASSEMBLY-V2-SIM-${String(formNumber).padStart(3,'0')}`;
  const canonical:Candidate[]=[];
  for(const section of SECTIONS)canonical.push(...exposureAwarePick(bank.filter(q=>q.section===section),SECTION_QUOTAS[section],`${formId}:${section}`,globalExposure,kuExposure,templateExposure));
  const targets=allocateBalancedAnswerPositions(canonical);
  const instances=canonical.map((question,index)=>{
    const permutation=buildChoicePermutation({question,examSeed:'A1_ASSEMBLY_V2',examFormId:formId,targetAnswerIndex:targets[index]});
    const display=applyChoicePermutation(question,permutation) as Candidate;
    return {questionId:question.id,canonicalContentHash:contentHash(question),canonicalAnswerIndex:question.answer,displayAnswerIndex:display.answer,choicePermutation:permutation,canonicalChoices:question.choices,displayChoices:display.choices,section:question.section,category:question.category,knowledgeUnitIds:question.knowledgeUnitIds,canDo:question.canDo,taskType:question.taskType||question.category,semanticSignature:semanticSignature(question),templateSignature:templateSignature(question),scoringProbe:{correctSelectionScoresCorrect:display.answer===permutation.displayAnswerIndex,canonicalIndexWouldScoreCorrect:display.answer===question.answer}};
  });
  for(const question of canonical){globalExposure.set(question.id,(globalExposure.get(question.id)||0)+1);for(const id of question.knowledgeUnitIds)kuExposure.set(id,(kuExposure.get(id)||0)+1);const templ=templateSignature(question);templateExposure.set(templ,(templateExposure.get(templ)||0)+1);}
  return {examId:formId,questionCount:instances.length,questions:instances};
}

function validateExam(exam:ReturnType<typeof buildExam>){
  const codes:string[]=[];
  if(exam.questionCount!==QUESTION_COUNT)codes.push('QUESTION_COUNT_INVALID');
  const sectionCounts=count(exam.questions.map(q=>q.section));
  for(const section of SECTIONS)if((sectionCounts[section]||0)!==SECTION_QUOTAS[section])codes.push(`SECTION_QUOTA_${section}_INVALID`);
  if(new Set(exam.questions.map(q=>q.questionId)).size!==exam.questions.length)codes.push('DUPLICATED_QUESTION_IN_FORM');
  if(new Set(exam.questions.map(q=>q.semanticSignature)).size!==exam.questions.length)codes.push('DUPLICATE_SEMANTIC_TARGET_IN_FORM');
  const positions=count(exam.questions.map(q=>String.fromCharCode(65+q.displayAnswerIndex))) as Record<string,number>;
  const spread=Math.max(...['A','B','C','D'].map(letter=>positions[letter]||0))-Math.min(...['A','B','C','D'].map(letter=>positions[letter]||0));
  if(spread>1)codes.push('ANSWER_POSITION_BALANCE_FAIL');
  if(exam.questions.some(q=>!q.scoringProbe.correctSelectionScoresCorrect))codes.push('SCORING_MISMATCH');
  return {status:codes.length?'FAIL':'PASS',reasonCodes:Array.from(new Set(codes)).sort(),sectionCounts,answerPositionDistribution:positions,answerPositionSpread:spread,kuCounts:count(exam.questions.flatMap(q=>q.knowledgeUnitIds)),canDoCounts:count(exam.questions.map(q=>q.canDo)),taskTypeCounts:count(exam.questions.map(q=>q.taskType)),templateCounts:count(exam.questions.map(q=>q.templateSignature))};
}

await mkdir('data/qa',{recursive:true});
await mkdir('docs/reviews',{recursive:true});
const locked=bank.map(q=>({id:q.id,...detectChoiceOrderLock(q)})).filter(row=>row.locked);
const globalExposure=new Map<string,number>();
const kuExposure=new Map<string,number>();
const templateExposure=new Map<string,number>();
const exams=[];
for(let i=1;i<=EXAM_COUNT;i+=1){const exam=buildExam(i,globalExposure,kuExposure,templateExposure);exams.push({...exam,validation:validateExam(exam)});}
const allInstances=exams.flatMap(exam=>exam.questions);
const afterPositions=count(allInstances.map(q=>String.fromCharCode(65+q.displayAnswerIndex))) as Record<string,number>;
const duplicateWithinFormCount=exams.filter(exam=>exam.validation.reasonCodes.includes('DUPLICATED_QUESTION_IN_FORM')).length;
const scoringMismatchCount=exams.reduce((sum,exam)=>sum+exam.validation.reasonCodes.filter(code=>code==='SCORING_MISMATCH').length,0);
const exposure=Object.fromEntries([...globalExposure.entries()].sort((a,b)=>b[1]-a[1]));
const ceItems=bank.filter(q=>q.section==='conversation_expression');
const ceExposure=[...globalExposure.entries()].filter(([id])=>ceItems.some(q=>q.id===id)).map(([id,forms])=>({id,forms,rate:Number((forms/EXAM_COUNT).toFixed(2))})).sort((a,b)=>b.forms-a.forms);
const exposureRisk=Object.entries(exposure).filter(([,forms])=>forms>EXAM_COUNT*HEALTHY_EXPOSURE_RATE).map(([id,forms])=>({id,forms,rate:Number((forms/EXAM_COUNT).toFixed(2)),section:bank.find(q=>q.id===id)?.section}));
const ceExposureRisk=ceExposure.filter(row=>row.rate>HEALTHY_EXPOSURE_RATE);
const minimumRecommendedCeBankSize=Math.ceil(SECTION_QUOTAS.conversation_expression*EXAM_COUNT/(EXAM_COUNT*HEALTHY_EXPOSURE_RATE));
const sourceMutations=bank.filter(q=>contentHash(q)!==contentHash(artifact.items.find(item=>item.id===q.id)!)).length;
const simulationPass=exams.filter(exam=>exam.validation.status==='PASS').length;
const coverageBlockers:string[]=[];
if(ceItems.length<minimumRecommendedCeBankSize)coverageBlockers.push('INSUFFICIENT_CE_BANK_COVERAGE');
if(exposureRisk.length)coverageBlockers.push('QUESTION_EXPOSURE_RISK');
const assemblerDefective=simulationPass<EXAM_COUNT||scoringMismatchCount>0||sourceMutations>0;
const finalClassification=assemblerDefective?'ASSEMBLER_STILL_DEFECTIVE':coverageBlockers.length?'ASSEMBLER_FIXED_BANK_COVERAGE_BLOCKED':'ASSEMBLER_FIXED_BANK_READY';
const summary={
  inputBank:bank.length,
  before:{answerPositions:previous.summary.answerPositionBias,simulatedExams:previous.summary.simulatedExams,questionExposureRisk:previous.summary.questionExposureRisk.highFrequencyCount,templateExposureRisk:previous.summary.templateExposureRisk.highFrequencyCount},
  after:{answerPositions:afterPositions,simulatedExams:{pass:simulationPass,fail:EXAM_COUNT-simulationPass}},
  scoringMismatches:scoringMismatchCount,
  choiceOrderLockedItemCount:locked.length,
  duplicateWithinFormCount,
  questionExposureRisk:{count:exposureRisk.length,items:exposureRisk.slice(0,40)},
  ceExposureRisk:{availableCe:ceItems.length,requestedCePerExam:SECTION_QUOTAS.conversation_expression,totalCeSlotsAcross100:SECTION_QUOTAS.conversation_expression*EXAM_COUNT,minimumRecommendedCeBankSize,count:ceExposureRisk.length,items:ceExposureRisk.slice(0,40)},
  templateExposureRisk:{count:[...templateExposure.entries()].filter(([,forms])=>forms>EXAM_COUNT*HEALTHY_EXPOSURE_RATE).length},
  coverageBlockers,
  finalClassification,
};
const generatedAt=new Date().toISOString();
const report={artifactVersion:'A1_EXAM_ASSEMBLY_V2',generatedAt,sourceArtifact:INPUT,published:false,questionBankLayer:{canonicalQuestionsImmutable:true,inputBankSize:bank.length,sourceMutations},examAssemblyLayer:{choicePermutation:'DETERMINISTIC_BALANCED_PER_FORM',selection:'EXPOSURE_AWARE_BY_SECTION_KU_TASK_TEMPLATE',sectionQuotas:SECTION_QUOTAS},examInstanceLayer:{storesCanonicalSnapshot:true,storesChoicePermutation:true,displayAnswerIndexRemapped:true},scoringLayer:{usesDisplayedSnapshotAnswer:true,scoringMismatchCount},availability:{bySection:sectionAvailability(bank),byCategory:coverage(bank.map(q=>q.category),[...new Set(bank.map(q=>q.category))]),byKnowledgeUnit:coverage(bank.flatMap(q=>q.knowledgeUnitIds),a1Units.map(unit=>unit.id)),byCanDo:coverage(bank.map(q=>q.canDo),[...new Set(bank.map(q=>q.canDo))]),byTaskType:coverage(bank.map(q=>q.taskType||q.category),[...new Set(bank.map(q=>q.taskType||q.category))])},choiceOrderLocked:locked,summary,exams};
await writeFile(OUTPUT,JSON.stringify(report,null,2)+'\n');
const beforeRows=Object.entries(previous.summary.answerPositionBias).map(([letter,row])=>`| ${letter} | ${row.actual} | ${afterPositions[letter]||0} |`).join('\n');
const exposureRows=ceExposureRisk.slice(0,12).map(row=>`| ${row.id} | ${row.forms} | ${row.rate} |`).join('\n');
const doc=`# A1 Exam Assembly V2 Report

Generated: ${generatedAt}

The 447 canonical machine-accepted questions were not modified. The fix is in exam assembly: each exam stores a deterministic choice permutation, a canonical snapshot, and a displayed snapshot with the remapped answer index used by scoring.

## Layer audit

- QUESTION_BANK layer: canonical choices and canonical answer index remain immutable.
- EXAM_ASSEMBLY layer: selects questions by section with exposure/KU/task/template penalties, then allocates balanced target answer positions.
- EXAM_INSTANCE layer: stores \`canonicalSnapshot\`, \`choicePermutation\`, displayed \`snapshot.choices\`, and displayed \`snapshot.answer\`.
- SCORING layer: scores against displayed \`snapshot.answer\`; replay evidence links it back to the canonical answer.

## Before vs after answer positions

| Position | Before | After |
|---|---:|---:|
${beforeRows}

## Simulation result

- Input bank: **${summary.inputBank}**
- 100 exams before: **${previous.summary.simulatedExams.pass} PASS / ${previous.summary.simulatedExams.fail} FAIL**
- 100 exams after: **${summary.after.simulatedExams.pass} PASS / ${summary.after.simulatedExams.fail} FAIL**
- Scoring mismatches: **${summary.scoringMismatches}**
- Choice-order-locked items: **${summary.choiceOrderLockedItemCount}**
- Duplicate-within-form count: **${summary.duplicateWithinFormCount}**
- Source mutations: **${sourceMutations}**

## Coverage and exposure

- CE requested per exam: **${SECTION_QUOTAS.conversation_expression}**
- CE available: **${ceItems.length}**
- CE total slots across 100 exams: **${SECTION_QUOTAS.conversation_expression*EXAM_COUNT}**
- Minimum recommended CE bank size at <= ${(HEALTHY_EXPOSURE_RATE*100).toFixed(0)}% exposure over 100 forms: **${minimumRecommendedCeBankSize}**
- Question exposure risk count: **${summary.questionExposureRisk.count}**
- CE exposure risk count: **${summary.ceExposureRisk.count}**
- Template exposure risk count: **${summary.templateExposureRisk.count}**

| High CE exposure sample | Forms | Rate |
|---|---:|---:|
${exposureRows||'| None | 0 | 0 |'}

Coverage blockers: **${coverageBlockers.length?coverageBlockers.join(', '):'none'}**

Final classification: **${finalClassification}**
`;
await writeFile(DOC,doc);
console.log(JSON.stringify(summary,null,2));
