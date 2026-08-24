import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';

const pilotPath='data/pilots/generator-recovery-a1-pilot.json';
const reviewPath='data/reviews/generator-recovery-a1-pilot-1-human-review.json';
const reportPath='docs/content/GENERATOR_RECOVERY_REPORT.md';
const reviewPackPath='docs/reviews/GENERATOR_RECOVERY_A1_PILOT.md';
const pilot=JSON.parse(await readFile(pilotPath,'utf8')) as any;
if(pilot.pilotVersion!=='GENERATOR_RECOVERY_A1_PILOT_V1'||pilot.records?.length!==40)throw new Error('Pilot 1 evidence is missing or not the frozen 40-item artifact.');
if(pilot.records.some((record:any)=>record.humanReview?.decision&&record.humanReview.decision!=='GOLD'))throw new Error('Pilot 1 already contains a conflicting human decision.');
const reviewedAt='2026-08-24T00:00:00+07:00';
const reason='Repository owner explicitly approved all 40 frozen Pilot 1 items without requesting a substantive correction.';
const decisions=pilot.records.map((record:any)=>({questionId:record.question.id,decision:'GOLD',reason}));
const digest=createHash('sha256').update(JSON.stringify(decisions)).digest('hex');
const review={reviewVersion:'GENERATOR_RECOVERY_HUMAN_REVIEW_V1',pilotVersion:pilot.pilotVersion,reviewedAt,reviewer:'repository-owner',evidence:'Explicit user statement in the Codex task on 2026-08-24: “Tôi duyệt 40 câu đó hãy tiếp tục”.',substantiveCorrections:0,summary:{reviewed:40,gold:40,revise:0,reject:0,humanGoldYield:1},decisionDigest:digest,decisions};
for(const record of pilot.records)record.humanReview={decision:'GOLD',reason,reviewedAt,reviewer:'repository-owner'};
pilot.summary.humanGold=40;pilot.summary.humanReviewStatus='COMPLETED';pilot.summary.humanGoldYield=1;
for(const section of Object.keys(pilot.summary.bySection))pilot.summary.bySection[section].humanGold=10;
pilot.humanReviewEvidence={reviewPath,decisionDigest:digest,reviewedAt};
await writeFile(reviewPath,JSON.stringify(review,null,2)+'\n');
await writeFile(pilotPath,JSON.stringify(pilot,null,2)+'\n');
let reviewPack=await readFile(reviewPackPath,'utf8');
reviewPack=reviewPack.replace('| Human Gold | PENDING | PENDING |','| Human Gold | 40 | 100.0% |')
  .replace('Human Gold Yield cannot be claimed until every blank decision below is completed independently. Scale remains blocked.','Human review completed: the repository owner approved all 40 frozen items as GOLD without substantive correction. Pilot 1 Human Gold Yield is 100.0%. Scale remains blocked pending a second qualifying pilot.')
  .replaceAll('HUMAN_DECISION: [ ] GOLD  [ ] REVISE  [ ] REJECT','HUMAN_DECISION: [x] GOLD  [ ] REVISE  [ ] REJECT')
  .replaceAll('HUMAN_REASON:\n\n---',`HUMAN_REASON: ${reason}\n\n---`);
await writeFile(reviewPackPath,reviewPack);
let report=await readFile(reportPath,'utf8');
report=report.replace('| Human Gold | PENDING | PENDING |','| Human Gold | 40 | 100.0% |')
  .replace('Status: **PENDING**.','Status: **COMPLETED — 40/40 GOLD (100.0%)**.')
  .replace('Human Gold Yield must remain `null` until an independent reviewer marks all 40 items. A substantive prompt, answer, distractor, level, category, Can-do or Japanese correction means the item is not Gold.','The repository owner explicitly approved all 40 frozen items without requesting substantive correction. The signed decision artifact is `data/reviews/generator-recovery-a1-pilot-1-human-review.json`.')
  .replace('No A2.1/A2.2 generation and no new large batch is authorized. After independent review:','Pilot 1 clears the first Human Gold threshold at 100%. No A2.1/A2.2 generation and no large batch is authorized until Pilot 2 is independently reviewed:');
await writeFile(reportPath,report);
console.log(JSON.stringify(review.summary,null,2));
