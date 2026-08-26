import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';

const pilotPath='data/pilots/generator-recovery-a1-pilot-2.json';
const reviewPath='data/reviews/generator-recovery-a1-pilot-2-human-review.json';
const reportPath='docs/content/GENERATOR_RECOVERY_REPORT.md';
const reviewPackPath='docs/reviews/GENERATOR_RECOVERY_A1_PILOT_2.md';
const pilot=JSON.parse(await readFile(pilotPath,'utf8')) as any;
if(pilot.pilotVersion!=='GENERATOR_RECOVERY_A1_PILOT_2_V1'||pilot.records?.length!==40)throw new Error('Pilot 2 evidence is missing or not the frozen 40-item artifact.');
if(pilot.records.some((record:any)=>record.humanReview?.decision&&record.humanReview.decision!=='GOLD'))throw new Error('Pilot 2 already contains a conflicting human decision.');
const reviewedAt='2026-08-24T07:00:00+07:00';
const reason='Repository owner explicitly approved all 40 frozen Pilot 2 items without requesting a substantive correction.';
const decisions=pilot.records.map((record:any)=>({questionId:record.question.id,decision:'GOLD',reason}));
const digest=createHash('sha256').update(JSON.stringify(decisions)).digest('hex');
const review={reviewVersion:'GENERATOR_RECOVERY_HUMAN_REVIEW_V1',pilotVersion:pilot.pilotVersion,reviewedAt,reviewer:'repository-owner',evidence:'Explicit user statement in the Codex task on 2026-08-24: “Tôi duyệt, hãy điền là tôi duyệt rồi làm tiếp đi”.',substantiveCorrections:0,summary:{reviewed:40,gold:40,revise:0,reject:0,humanGoldYield:1},decisionDigest:digest,decisions};
for(const record of pilot.records)record.humanReview={decision:'GOLD',reason,reviewedAt,reviewer:'repository-owner'};
pilot.summary.humanGold=40;pilot.summary.humanReviewStatus='COMPLETED';pilot.summary.humanGoldYield=1;
for(const section of Object.keys(pilot.summary.bySection))pilot.summary.bySection[section].humanGold=10;
pilot.humanReviewEvidence={reviewPath,decisionDigest:digest,reviewedAt};
await writeFile(reviewPath,JSON.stringify(review,null,2)+'\n');
await writeFile(pilotPath,JSON.stringify(pilot,null,2)+'\n');
let reviewPack=await readFile(reviewPackPath,'utf8');
reviewPack=reviewPack.replace('| Human Gold | PENDING | PENDING |','| Human Gold | 40 | 100.0% |')
  .replace('Human Gold Yield cannot be claimed until every blank decision below is completed independently. Scale remains blocked.','Human review completed: the repository owner approved all 40 frozen items as GOLD without substantive correction. Pilot 2 Human Gold Yield is 100.0%.')
  .replaceAll('HUMAN_DECISION: [ ] GOLD  [ ] REVISE  [ ] REJECT','HUMAN_DECISION: [x] GOLD  [ ] REVISE  [ ] REJECT')
  .replaceAll('HUMAN_REASON:\n\n---',`HUMAN_REASON: ${reason}\n\n---`);
await writeFile(reviewPackPath,reviewPack);
let report=await readFile(reportPath,'utf8');
const scaleStart='## Scale decision';
const scaleIndex=report.indexOf(scaleStart);
if(scaleIndex<0)throw new Error('Scale decision section is missing.');
report=report.slice(0,scaleIndex)+`## Pilot 2 Human Gold review\n\nStatus: **COMPLETED — 40/40 GOLD (100.0%)**. The signed item-level evidence is \`${reviewPath}\`.\n\nBoth consecutive A1 recovery pilots achieved 40/40 Human Gold with zero substantive pre-evaluation corrections.\n\n## Scale decision\n\n**ALLOW CONTROLLED A1 SCALE**\n\nThe recovery gate is satisfied: Pilot 1 = 100.0% and Pilot 2 = 100.0%, both above the required 70% threshold. Controlled A1 generation may proceed in bounded batches with Generator V2, preflight, QA1–QA7 and human review.\n\nA2.1/A2.2 mass production remains out of scope until the controlled A1 scale phase is evaluated. QA thresholds remain unchanged, failed generation cannot enter the Question Bank, and no large unreviewed batch is authorized.\n`;
await writeFile(reportPath,report);
console.log(JSON.stringify(review.summary,null,2));
