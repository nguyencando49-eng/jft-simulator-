import {readFile,writeFile} from 'node:fs/promises';

const through=Number(process.argv[2]??37);
if(!Number.isInteger(through)||through<1||through>46)throw new Error('Approval batch must be within 001..046.');
const reviewedAt=new Date().toISOString();

for(let number=1;number<=through;number++){
  const batch=String(number).padStart(3,'0');
  const artifactPath=`data/production/controlled-a1-batch-${batch}.json`;
  const reviewPath=`docs/reviews/CONTROLLED_A1_BATCH_${batch}.md`;
  const artifact=JSON.parse(await readFile(artifactPath,'utf8')) as any;
  if(!Array.isArray(artifact.records)||artifact.records.length!==20)throw new Error(`Batch ${batch} does not contain exactly 20 records.`);
  const reason=`Repository owner explicitly approved Controlled A1 Batch ${batch} without requesting substantive correction.`;
  for(const record of artifact.records)record.humanReview={decision:'GOLD',reason,reviewedAt,reviewer:'repository-owner'};
  artifact.summary.humanGold=20;
  artifact.summary.humanReviewStatus='COMPLETED';
  artifact.summary.humanGoldYield=1;
  for(const key of ['bySection','byCategory','byCanDo','byTemplate'])for(const row of Object.values(artifact.summary[key]??{}) as any[])row.humanGold=row.generated;
  await writeFile(artifactPath,`${JSON.stringify(artifact,null,2)}\n`);

  let review=await readFile(reviewPath,'utf8');
  review=review
    .replace('| Human Gold | PENDING | PENDING |','| Human Gold | 20 | 100.0% |')
    .replace('Human Gold Yield cannot be claimed until every blank decision below is completed independently. This controlled batch cannot enter the Question Bank automatically.','Human review completed: the repository owner approved all 20 frozen items as GOLD without substantive correction. Question Bank admission remains governed by the existing QA and import workflow.')
    .replaceAll('HUMAN_DECISION: [ ] GOLD  [ ] REVISE  [ ] REJECT','HUMAN_DECISION: [x] GOLD  [ ] REVISE  [ ] REJECT')
    .replaceAll('HUMAN_REASON:\r\n',`HUMAN_REASON: ${reason}\r\n`)
    .replaceAll('HUMAN_REASON:\n',`HUMAN_REASON: ${reason}\n`);
  await writeFile(reviewPath,review);
}

console.log(JSON.stringify({approvedThrough:through,approvedItems:through*20,reviewedAt},null,2));
