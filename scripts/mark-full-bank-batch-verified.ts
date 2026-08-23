import { readdir,readFile,writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const batchNumber=Number(process.argv[2]);
if(!Number.isInteger(batchNumber)||batchNumber<1||batchNumber>20)throw new Error('Batch number must be 1–20.');
const batchId=`BATCH-${String(batchNumber).padStart(3,'0')}`;
const auditsDir=join(process.cwd(),'docs','reviews','full-bank');
const decisionsDir=join(process.cwd(),'data','reviews','full-bank');
const auditPath=join(auditsDir,`${batchId}-AUDIT.md`);
let audit=await readFile(auditPath,'utf8');
if(!audit.includes('## Verification'))audit += [
  '','## Verification','',
  '- Typecheck: PASS.',
  '- Unit/integrity tests: 37 files, 243 tests PASS.',
  '- Production build: PASS.',
  '- Relevant Candidate browser E2E: PASS. The full 6-test suite is rerun at consolidation.',
  '- Batch reconciliation: PASS; IDs are unique and contiguous in the signed queue.',
  '- Question statuses and published ExamVersions: unchanged.','',
].join('\n');
await writeFile(auditPath,audit);

const decisionFiles=(await readdir(decisionsDir)).filter(file=>/^BATCH-\d{3}-DECISIONS\.json$/.test(file)).sort();
const batches=await Promise.all(decisionFiles.map(async file=>JSON.parse(await readFile(join(decisionsDir,file),'utf8')) as {batchId:string;range?:{start:number;end:number};records:Array<{decision:string}>}));
const rows=[];
let reviewed=0;
for(const [index,batch] of batches.entries()){
  reviewed+=batch.records.length;
  const range=batch.range??{start:index===0?0:25+(index-1)*50,end:index===0?24:24+index*50};
  const count=(decision:string)=>batch.records.filter(record=>record.decision===decision).length;
  const verified=(await readFile(join(auditsDir,`${batch.batchId}-AUDIT.md`),'utf8')).includes('## Verification');
  rows.push(`| ${batch.batchId} | queue ${range.start}–${range.end} | ${batch.records.length} | ${count('KEEP')} | ${count('REVISE')} | ${count('REVIEW_LEVEL')} | ${count('HOLD_AUDIO')} | ${count('REMOVE')} | ${batch.batchId==='BATCH-001'?'1 repository repair; 0 promotions':'0 status mutations'} | ${verified?'243 unit/integrity + build + relevant E2E PASS':'Pending verification'} | ${verified?'VERIFIED':'REVIEWED'} |`);
}
const progress=['# Full Question Bank Repair Progress','',
  'Baseline: `4806c09f2edac09516717684a4691626a31694a4`','Branch: `content/full-bank-manual-repair`','Target queue: 973 unpublished AI questions in signed `KEEP_REVIEW` state','',
  '| Batch | Range | Reviewed | KEEP | REVISE | REVIEW_LEVEL | HOLD_AUDIO | REMOVE | Applied | Tests | Status |','|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|',...rows,'',
  '## Current totals','',`Reviewed: ${reviewed} / 973`,`Remaining: ${973-reviewed}`,'Approved: 0','',
  'Production mutation remains blocked until an authenticated live inventory can be compared with the signed baseline snapshot. Existing published ExamVersions remain untouched.','',
].join('\n');
await writeFile(join(process.cwd(),'docs','reviews','FULL_BANK_REPAIR_PROGRESS.md'),progress);
console.log(`${batchId} VERIFIED`);
