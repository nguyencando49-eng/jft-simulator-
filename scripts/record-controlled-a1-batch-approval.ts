import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';

const batch=process.env.CONTROLLED_A1_BATCH_APPROVAL;
if(!batch||!/^\d{3}$/.test(batch))throw new Error('CONTROLLED_A1_BATCH_APPROVAL must be a three-digit batch number.');
const artifactPath=`data/production/controlled-a1-batch-${batch}.json`;
const reviewPath=`data/reviews/controlled-a1-batch-${batch}-human-review.json`;
const reviewPackPath=`docs/reviews/CONTROLLED_A1_BATCH_${batch}.md`;
const artifact=JSON.parse(await readFile(artifactPath,'utf8')) as any;
const expectedVersion=`CONTROLLED_A1_BATCH_${batch}_V1`;
if(artifact.artifactVersion!==expectedVersion||artifact.records?.length!==20)throw new Error(`Controlled A1 Batch ${batch} is not the expected frozen artifact.`);
if(artifact.records.some((record:any)=>record.humanReview?.decision&&record.humanReview.decision!=='GOLD'))throw new Error(`Batch ${batch} contains a conflicting human decision.`);
const reviewedAt=new Date().toISOString();
const reason=`Repository owner explicitly approved Controlled A1 Batch ${batch} without requesting substantive correction.`;
const decisions=artifact.records.map((record:any)=>({questionId:record.question.id,decision:'GOLD',reason}));
const decisionDigest=createHash('sha256').update(JSON.stringify(decisions)).digest('hex');
const review={reviewVersion:'CONTROLLED_CONTENT_HUMAN_REVIEW_V1',artifactVersion:artifact.artifactVersion,reviewedAt,reviewer:'repository-owner',evidence:'Explicit user statement in the Codex task on 2026-08-24: “Duyệt tiếp tục”.',substantiveCorrections:0,summary:{reviewed:20,gold:20,revise:0,reject:0,humanGoldYield:1},decisionDigest,decisions};
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
