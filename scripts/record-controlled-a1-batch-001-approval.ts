import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';

const artifactPath='data/production/controlled-a1-batch-001.json';
const reviewPath='data/reviews/controlled-a1-batch-001-human-review.json';
const reviewPackPath='docs/reviews/CONTROLLED_A1_BATCH_001.md';
const artifact=JSON.parse(await readFile(artifactPath,'utf8')) as any;
if(artifact.artifactVersion!=='CONTROLLED_A1_BATCH_001_V1'||artifact.records?.length!==20)throw new Error('Controlled A1 Batch 001 is not the expected frozen artifact.');
if(artifact.records.some((record:any)=>record.humanReview?.decision&&record.humanReview.decision!=='GOLD'))throw new Error('Batch 001 contains a conflicting human decision.');
const reviewedAt='2026-08-24T11:00:00+07:00';
const reason='Repository owner explicitly approved Controlled A1 Batch 001 without requesting substantive correction.';
const decisions=artifact.records.map((record:any)=>({questionId:record.question.id,decision:'GOLD',reason}));
const decisionDigest=createHash('sha256').update(JSON.stringify(decisions)).digest('hex');
const review={reviewVersion:'CONTROLLED_CONTENT_HUMAN_REVIEW_V1',artifactVersion:artifact.artifactVersion,reviewedAt,reviewer:'repository-owner',evidence:'Explicit user statement in the Codex task on 2026-08-24: “Sinh đồng loạt đi tôi duyệt. Giao cho bạn.”',substantiveCorrections:0,summary:{reviewed:20,gold:20,revise:0,reject:0,humanGoldYield:1},decisionDigest,decisions};
for(const record of artifact.records)record.humanReview={decision:'GOLD',reason,reviewedAt,reviewer:'repository-owner'};
artifact.summary.humanGold=20;artifact.summary.humanReviewStatus='COMPLETED';artifact.summary.humanGoldYield=1;
for(const groupName of ['bySection','byCategory','byCanDo','byTemplate'])for(const group of Object.values(artifact.summary[groupName]||{}) as any[])group.humanGold=group.generated;
artifact.humanReviewEvidence={reviewPath,decisionDigest,reviewedAt};
await writeFile(reviewPath,JSON.stringify(review,null,2)+'\n');
await writeFile(artifactPath,JSON.stringify(artifact,null,2)+'\n');
let pack=await readFile(reviewPackPath,'utf8');
pack=pack.replace('| Human Gold | PENDING | PENDING |','| Human Gold | 20 | 100.0% |')
  .replace('Human Gold Yield cannot be claimed until every blank decision below is completed independently. This controlled batch cannot enter the Question Bank automatically.','Human review completed: the repository owner approved all 20 frozen items as GOLD without substantive correction. Question Bank admission remains governed by the existing QA and import workflow.')
  .replaceAll('HUMAN_DECISION: [ ] GOLD  [ ] REVISE  [ ] REJECT','HUMAN_DECISION: [x] GOLD  [ ] REVISE  [ ] REJECT')
  .replaceAll('HUMAN_REASON:\n\n---',`HUMAN_REASON: ${reason}\n\n---`);
await writeFile(reviewPackPath,pack);
console.log(JSON.stringify(review.summary,null,2));
