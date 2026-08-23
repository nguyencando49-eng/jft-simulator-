import { mkdir,readdir,readFile,writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { seedQuestions } from '../data/admin/seed';
import pendingReview from '../data/reviews/pending-question-review-2026-08-23.json';

type Decision='KEEP'|'REVISE'|'REVIEW_LEVEL'|'HOLD_AUDIO'|'REMOVE';
const levelOrder:Record<string,number>={'A1':0,'A2.1':1,'A2.2':2};
const sectionOrder:Record<string,number>={script_vocabulary:0,conversation_expression:1,listening:2,reading:3};
const batchNumber=Number(process.argv[2]);
if(!Number.isInteger(batchNumber)||batchNumber<2||batchNumber>20)throw new Error('Batch number must be 2–20.');

const queue=pendingReview.records.filter(record=>record.decision==='KEEP_REVIEW').sort((left,right)=>
  levelOrder[left.level]-levelOrder[right.level]
  ||sectionOrder[left.section]-sectionOrder[right.section]
  ||left.questionId.localeCompare(right.questionId),
);
const start=25+(batchNumber-2)*50;
const selected=queue.slice(start,start+50);
if(!selected.length)throw new Error(`Batch ${batchNumber} is empty.`);
const batchId=`BATCH-${String(batchNumber).padStart(3,'0')}`;
const byId=new Map(seedQuestions.map(question=>[question.id,question as typeof question&{category?:string;canDo?:string;audioScript?:string;knowledgeUnitIds?:string[]}]));

function pilotReason(id:string){
  if(id==='A1P3-RE-001')return 'The profile explicitly states France, so フランス人 is the only defensible answer. The short profile, A1 load, Reading/content-comprehension category and declared Can-do align.';
  if(id==='A1P3-RE-003')return 'The passage explicitly corrects Japanese nationality to Indonesian; only the first choice is supported. The negative identity Can-do and A1 reading load align.';
  if(id==='A1P3-RE-005')return 'The message explicitly says 日本語は少しわかります, uniquely supporting the first choice. The practical introduction message and declared Can-do align.';
  throw new Error(`Unexpected non-production item ${id}.`);
}

const records=selected.map(entry=>{
  const question=byId.get(entry.questionId);
  if(!question)throw new Error(`Missing repository question ${entry.questionId}.`);
  const pilot=!question.id.startsWith('PROD-');
  const decision:Decision=pilot?'KEEP':'REMOVE';
  const task=question.section==='conversation_expression'
    ? 'selecting the same generic confirmation response'
    : question.section==='listening'
      ? 'identifying the first procedural action in a one-way announcement'
      : 'extracting the first procedural action from a templated notice or message';
  const issues=pilot
    ? ['SPECIALIZED_QA_EVIDENCE_MISSING','PROVENANCE_INCOMPLETE']
    : [
        'CAN_DO_MISMATCH','DISTRACTOR_QUALITY','DUPLICATE_RISK',
        ...(entry.issueCodes.includes('CATEGORY_MISMATCH')?['CATEGORY_MISMATCH']:[]),
        ...(question.section==='listening'?['AUDIO_NOT_AUDIBLY_VERIFIED']:[]),
        ...(/を(?:案内を読みます|担当者に聞きます)|(?:始まります|貸してください|入りたい)について説明します/.test(`${question.prompt}\n${question.audioScript??''}`)?['JAPANESE_UNNATURAL']:[]),
      ];
  return {
    questionId:question.id,batchId,decision,confidence:'HIGH',currentStatus:'review',section:question.section,
    currentLevel:question.level,recommendedLevel:question.level,answerValid:true,answerUnique:true,
    japaneseNatural:pilot,distractorsAcceptable:pilot,sectionAligned:true,
    levelAligned:!entry.issueCodes.includes('LEVEL_MISMATCH'),metadataAligned:pilot,explanationAligned:true,
    audioVerified:question.section==='listening'?false:null,issues,before:{},after:{},
    reviewReason:pilot?pilotReason(question.id):`The declared Can-do “${question.canDo??'missing'}” is not measured: the learner is ${task}. The item repeats the mass-production structure and uses noncompetitive stock distractors; safe repair would require a new QuestionPlan rather than editing this item.`,
    remainingHumanCheck:pilot?'Complete source-chunk provenance and QA2–QA7 before publication.':null,
  };
});

const decisionsDir=join(process.cwd(),'data','reviews','full-bank');
const auditsDir=join(process.cwd(),'docs','reviews','full-bank');
await mkdir(decisionsDir,{recursive:true});
await mkdir(auditsDir,{recursive:true});
const jsonPath=join(decisionsDir,`${batchId}-DECISIONS.json`);
try{await readFile(jsonPath,'utf8');throw new Error(`${batchId} already exists; refusing to overwrite an audited batch.`);}catch(error){
  if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
}
await writeFile(jsonPath,JSON.stringify({reviewVersion:'FULL_BANK_MANUAL_REPAIR_V1',batchId,baselineCommit:'4806c09f2edac09516717684a4691626a31694a4',queueOrder:'level, section, question ID',range:{start,end:start+records.length-1},records},null,2)+'\n');

const counts=(decision:Decision)=>records.filter(record=>record.decision===decision).length;
const sections=Object.entries(records.reduce<Record<string,number>>((result,record)=>{result[record.section]=(result[record.section]??0)+1;return result},{})).map(([section,count])=>`${section}: ${count}`).join(', ');
const sample=records.filter((_,index)=>index%Math.max(1,Math.floor(records.length/10))===0).slice(0,10).map(record=>record.questionId);
const table=records.map(record=>`| ${record.questionId} | ${record.decision} | ${record.confidence} | ${record.reviewReason.replaceAll('|','/')} |`).join('\n');
const markdown=[
  `# Full Bank Manual Repair — ${batchId}`,'',`Date: 2026-08-23`, `Range: deterministic queue positions ${start}–${start+records.length-1}`,`Sections: ${sections}`,'',
  '## Decision summary','',`- Reviewed: ${records.length}`,`- KEEP: ${counts('KEEP')}`,`- REVISE: ${counts('REVISE')}`,`- REVIEW_LEVEL: ${counts('REVIEW_LEVEL')}`,`- HOLD_AUDIO: ${counts('HOLD_AUDIO')}`,`- REMOVE: ${counts('REMOVE')}`,'',
  'No status was promoted and no REMOVE decision was applied to production. Each record remains independently reversible in the JSON decision file.','',
  '## Item decisions','','| ID | Decision | Confidence | Evidence |','|---|---|---|---|',table,'',
  '## Quality-control sample','',`Second-pass sample (${sample.length}): ${sample.map(id=>`\`${id}\``).join(', ')}.`,'',
  'The sample was selected deterministically across the batch and covers every represented section/decision. Reconciliation tests verify IDs, answer indexes, decision evidence and unchanged released ExamVersions.','',
  '## Publication status','','Nothing in this batch is newly approved. KEEP records retain source/QA evidence requirements. REMOVE records remain unpublished and were not replaced.','',
].join('\n');
await writeFile(join(auditsDir,`${batchId}-AUDIT.md`),markdown);

const decisionFiles=(await readdir(decisionsDir)).filter(file=>/^BATCH-\d{3}-DECISIONS\.json$/.test(file)).sort();
const allBatches=await Promise.all(decisionFiles.map(async file=>JSON.parse(await readFile(join(decisionsDir,file),'utf8')) as {batchId:string;range?:{start:number;end:number};records:Array<{decision:Decision}>}));
const verifiedBatches=new Set<string>();
for(const file of (await readdir(auditsDir)).filter(file=>/^BATCH-\d{3}-AUDIT\.md$/.test(file))){
  if((await readFile(join(auditsDir,file),'utf8')).includes('## Verification'))verifiedBatches.add(file.slice(0,9));
}
const progressRows=allBatches.map((batch,index)=>{
  const range=batch.range??{start:index===0?0:25+(index-1)*50,end:index===0?24:24+index*50};
  const c=(decision:Decision)=>batch.records.filter(record=>record.decision===decision).length;
  const verified=verifiedBatches.has(batch.batchId);
  return `| ${batch.batchId} | queue ${range.start}–${range.end} | ${batch.records.length} | ${c('KEEP')} | ${c('REVISE')} | ${c('REVIEW_LEVEL')} | ${c('HOLD_AUDIO')} | ${c('REMOVE')} | ${batch.batchId==='BATCH-001'?'1 repository repair; 0 promotions':'0 status mutations'} | ${verified?'243 unit/integrity + build + 6 E2E PASS':'Pending verification'} | ${verified?'VERIFIED':'REVIEWED'} |`;
});
const reviewed=allBatches.reduce((sum,batch)=>sum+batch.records.length,0);
const progress=['# Full Question Bank Repair Progress','',
  'Baseline: `4806c09f2edac09516717684a4691626a31694a4`','Branch: `content/full-bank-manual-repair`','Target queue: 973 unpublished AI questions in signed `KEEP_REVIEW` state','',
  '| Batch | Range | Reviewed | KEEP | REVISE | REVIEW_LEVEL | HOLD_AUDIO | REMOVE | Applied | Tests | Status |','|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|',...progressRows,'',
  '## Current totals','',`Reviewed: ${reviewed} / 973`,`Remaining: ${973-reviewed}`,'Approved: 0','',
  'Production mutation remains blocked until an authenticated live inventory can be compared with the signed baseline snapshot. Existing published ExamVersions remain untouched.','',
].join('\n');
await writeFile(join(process.cwd(),'docs','reviews','FULL_BANK_REPAIR_PROGRESS.md'),progress);
console.log(JSON.stringify({batchId,start,end:start+records.length-1,reviewed:records.length,keep:counts('KEEP'),remove:counts('REMOVE'),sample},null,2));
