import {readdir,readFile,writeFile} from 'node:fs/promises';

const target=1000,batchSize=20;
const pilotPaths=['data/pilots/generator-recovery-a1-pilot.json','data/pilots/generator-recovery-a1-pilot-2.json'];
const productionFiles=(await readdir('data/production')).filter(name=>/^controlled-a1-batch-\d{3}\.json$/.test(name)).sort();
const paths=[...pilotPaths,...productionFiles.map(name=>`data/production/${name}`)];
const artifacts=await Promise.all(paths.map(async path=>({path,data:JSON.parse(await readFile(path,'utf8')) as any})));
const rows=artifacts.map(({path,data})=>({artifactVersion:data.artifactVersion||data.pilotVersion,path,generated:data.records.length,preflightPass:data.summary.preflightPass,humanReviewStatus:data.summary.humanReviewStatus,humanGold:data.summary.humanGold,machinePass:data.summary.machinePass}));
const generated=rows.reduce((sum,row)=>sum+row.generated,0),remaining=Math.max(0,target-generated);
const manifest={version:'CONTROLLED_A1_SCALE_MANIFEST_V1',generatedAt:new Date().toISOString(),target,batchSize,generated,remaining,remainingBatchCount:Math.ceil(remaining/batchSize),reviewPolicy:'CUMULATIVE_REVIEW_AT_1000',publicationPolicy:'NO_AUTO_APPROVAL_OR_PUBLISH',providerRequirement:{provider:'azure-openai',model:'jft-gpt-5-mini',configuredLocally:Boolean(process.env.AI_FACTORY_ENDPOINT&&process.env.AI_FACTORY_API_KEY&&process.env.AI_FACTORY_MODEL)},artifacts:rows};
await writeFile('data/production/controlled-a1-scale-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({target,generated,remaining,remainingBatchCount:manifest.remainingBatchCount,providerConfiguredLocally:manifest.providerRequirement.configuredLocally},null,2));
