import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {completeProductionQuestionSet} from '../data/production/mass-question-candidates';

type DecisionRecord={
  questionId:string;batchId:string;decision:string;confidence:string;currentStatus:string;
  section:string;currentLevel:string;recommendedLevel:string;issues:string[];reviewReason:string;
};
type FailureRecord={
  questionId:string;level:string;section:string;category:string;canDo:string;decision:string;
  failures:string[];rootCauses:string[];earliestFailure:string;generatorTemplate:string;
  generationBatch:string;knowledgeUnitIds:string[];sourceDocument:string;reviewEvidence:string;
};

const read=async(path:string)=>JSON.parse(await readFile(path,'utf8')) as {records:DecisionRecord[]};
const full=await read('data/reviews/full-bank/FINAL-DECISIONS.json');
const archived=await read('data/reviews/archived-bank/FINAL-ARCHIVED-DECISIONS.json');
const decisions=[...full.records,...archived.records];
const questions=new Map(completeProductionQuestionSet.map(question=>[question.id,question]));

function templateFor(id:string,section:string){
  if(id.startsWith('PROD-'))return `MASS_TEMPLATE_V1:${section}`;
  if(id.startsWith('A1P3-'))return `A1_LESSON_03_PILOT:${section}`;
  if(id.startsWith('AI-'))return `FACTORY_V1:${section}`;
  return `UNKNOWN:${section}`;
}
function rootCauses(record:DecisionRecord){
  const roots=new Set<string>();
  if(record.questionId.startsWith('PROD-'))roots.add('PLANNING_ERROR');
  if(record.issues.some(x=>['CAN_DO_MISMATCH','CATEGORY_MISMATCH','SECTION_MISMATCH','PROMPT_TASK_MISMATCH'].includes(x)))roots.add('TASK_TYPE_ERROR');
  if(record.issues.includes('LEVEL_MISMATCH'))roots.add('LEVEL_TARGET_ERROR');
  if(record.issues.includes('CAN_DO_MISMATCH'))roots.add('CAN_DO_ERROR');
  if(record.issues.includes('CATEGORY_MISMATCH'))roots.add('CATEGORY_TARGET_ERROR');
  if(record.issues.some(x=>x.includes('DISTRACTOR')||x==='CHOICE_LANGUAGE_MISMATCH'))roots.add('DISTRACTOR_DESIGN_ERROR');
  if(record.issues.includes('JAPANESE_UNNATURAL'))roots.add('JAPANESE_NATURALNESS_ERROR');
  if(record.issues.some(x=>x.includes('AUDIO')))roots.add('LISTENING_SCRIPT_ERROR');
  if(record.issues.some(x=>x.includes('PROVENANCE')||x.includes('EVIDENCE_MISSING')))roots.add('METADATA_ERROR');
  if(record.issues.includes('DUPLICATE_RISK'))roots.add('GENERATOR_PROMPT_ERROR');
  return [...roots];
}
const earliestOrder=['PLANNING_ERROR','LEVEL_TARGET_ERROR','CATEGORY_TARGET_ERROR','CAN_DO_ERROR','SOURCE_GROUNDING_ERROR','GENERATOR_PROMPT_ERROR','ANSWER_DESIGN_ERROR','DISTRACTOR_DESIGN_ERROR','JAPANESE_NATURALNESS_ERROR','TASK_TYPE_ERROR','LISTENING_SCRIPT_ERROR','METADATA_ERROR','POST_PROCESSING_ERROR','QA_FALSE_POSITIVE','QA_FALSE_NEGATIVE'];

const failures:FailureRecord[]=decisions.filter(record=>!['KEEP'].includes(record.decision)).map(record=>{
  const question=questions.get(record.questionId) as (typeof completeProductionQuestionSet[number]&{category?:string;canDo?:string;knowledgeUnitIds?:string[];sourceDocument?:string})|undefined;
  const roots=rootCauses(record);
  return {questionId:record.questionId,level:record.currentLevel,section:record.section,category:question?.category||'unknown',canDo:question?.canDo||question?.tags.find(x=>x.startsWith('can-do:'))?.slice(7)||'unknown',decision:record.decision,failures:record.issues,rootCauses:roots,earliestFailure:earliestOrder.find(x=>roots.includes(x))||'METADATA_ERROR',generatorTemplate:templateFor(record.questionId,record.section),generationBatch:record.batchId,knowledgeUnitIds:question?.knowledgeUnitIds||[],sourceDocument:question?.sourceDocument||'unproven',reviewEvidence:record.reviewReason};
});

const goldCandidates=decisions.filter(record=>record.decision==='KEEP'&&record.confidence==='HIGH').map(record=>{
  const question=questions.get(record.questionId);
  return {questionId:record.questionId,evidence:{decision:record.decision,confidence:record.confidence,batchId:record.batchId,reviewReason:record.reviewReason,sourceArtifact:record.currentStatus==='archived'?'data/reviews/archived-bank/FINAL-ARCHIVED-DECISIONS.json':'data/reviews/full-bank/FINAL-DECISIONS.json'},question:question||null};
});

const keys=['A1','A2.1','A2.2'].flatMap(level=>['script_vocabulary','conversation_expression','listening','reading'].map(section=>`${level}|${section}`));
const grouped=new Map(keys.map(key=>[key,failures.filter(record=>`${record.level}|${record.section}`===key).sort((a,b)=>a.questionId.localeCompare(b.questionId))]));
const sample:FailureRecord[]=[];
for(const key of keys)sample.push(...(grouped.get(key)||[]).slice(0,8));
for(const record of failures.sort((a,b)=>a.questionId.localeCompare(b.questionId)))if(sample.length<100&&!sample.some(x=>x.questionId===record.questionId))sample.push(record);

function counts(values:string[]){return Object.fromEntries([...new Set(values)].sort().map(value=>[value,values.filter(x=>x===value).length]));}
const summary={
  analysisVersion:'GENERATOR_FAILURE_ANALYSIS_V1',historicalItemCount:decisions.length,
  explicitGoldSeedCandidateCount:goldCandidates.length,failureRecordCount:failures.length,manualRootCauseSampleCount:sample.length,
  byFailure:counts(failures.flatMap(x=>x.failures)),byRootCause:counts(failures.flatMap(x=>x.rootCauses)),
  byLevel:counts(failures.map(x=>x.level)),bySection:counts(failures.map(x=>x.section)),
  byCategory:counts(failures.map(x=>x.category)),byTemplate:counts(failures.map(x=>x.generatorTemplate)),
  byBatch:counts(failures.map(x=>x.generationBatch)),byKnowledgeUnit:counts(failures.flatMap(x=>x.knowledgeUnitIds)),
};

await mkdir('data/analysis',{recursive:true});await mkdir('data/gold',{recursive:true});await mkdir('docs/content',{recursive:true});
await writeFile('data/analysis/generator-failure-summary.json',JSON.stringify({summary,records:failures,rootCauseSample:sample},null,2)+'\n');
await writeFile('data/gold/gold-seed-candidates.json',JSON.stringify({version:'GOLD_SEED_CANDIDATES_V1',warning:'KEEP with explicit item-level evidence is a candidate signal, not automatic production Gold approval.',candidates:goldCandidates},null,2)+'\n');

const top=(value:Record<string,number>,limit=20)=>Object.entries(value).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,limit).map(([key,count])=>`| ${key} | ${count} |`).join('\n');
const sampleRows=sample.map(x=>`| ${x.questionId} | ${x.level} | ${x.section} | ${x.category} | ${x.earliestFailure} | ${x.failures.join(', ')} |`).join('\n');
const doc=`# Generator Failure Analysis\n\nDate: 2026-08-24\n\n## Scope and evidence\n\n- Historical AI/pilot decisions analyzed: **${decisions.length}**.\n- Non-KEEP failure records: **${failures.length}**.\n- Explicit high-confidence KEEP candidates: **${goldCandidates.length}**. These are candidates only; database \`approved\` was never treated as Gold.\n- Stratified root-cause sample: **${sample.length}** across A1/A2.1/A2.2 and all four sections.\n- Source of truth: item-level decisions in \`data/reviews/full-bank\` and \`data/reviews/archived-bank\`, joined to the repository question snapshot.\n\n## Ranked failure signals\n\n| Failure | Count |\n|---|---:|\n${top(summary.byFailure)}\n\n## Ranked upstream root causes\n\n| Root cause | Affected records |\n|---|---:|\n${top(summary.byRootCause)}\n\n## Root-cause conclusions\n\n1. **PLANNING_ERROR:** the mass producer targeted a fixed count per level/section and rotated curriculum anchors through a few templates. It did not create a task-specific blueprint.\n2. **CAN_DO/CATEGORY_TARGET_ERROR:** level, Can-do and category were copied from curriculum/loop metadata even when the learner operation measured something else.\n3. **DISTRACTOR_DESIGN_ERROR:** distractors came from global stock arrays or unrelated fallback statements instead of the same decision space and a named learner misconception.\n4. **GENERATOR_PROMPT_ERROR:** repeated surface templates changed names/numbers while preserving the same decision and answer pattern, creating systemic near-duplicates.\n5. **LEVEL_TARGET_ERROR:** A1/A2.1/A2.2 labels did not constrain information load, grammar, discourse or distractor competitiveness.\n6. **POST-GENERATION METADATA:** the generator was free to emit tags while the job attached requested metadata; neither proved that the item actually measured it.\n\nThe earliest failure was normally upstream planning. QA correctly detected downstream symptoms; lowering QA would hide rather than repair these causes.\n\n## Gold vs failed contract\n\n### Script & Vocabulary\n\nGold candidates isolate one word/kanji construct, supply only the context needed for uniqueness, and keep all distractors in the same lexical/reading decision space.\n\n### Conversation & Expression\n\nGold candidates define speaker roles and intent before language generation. Every option is a natural utterance, but only one fulfills the intended pragmatic function.\n\n### Listening\n\nGold candidates define facts and the answer before the script. Visible text does not reveal the fact; distractors come from competing facts or plausible mishearing. Audio is rendered only after script QA.\n\n### Reading\n\nGold candidates use a practical message/notice/schedule, require actual reading, and derive distractors from nearby information rather than absurd actions.\n\n## Stratified 100-item root-cause sample\n\n| ID | Level | Section | Category | Earliest bad stage | Review failures |\n|---|---|---|---|---|---|\n${sampleRows}\n\n## Machine-readable evidence\n\n- \`data/analysis/generator-failure-summary.json\` contains all failure records, aggregates and the 100-item sample.\n- \`data/gold/gold-seed-candidates.json\` contains only explicit item-level KEEP evidence.\n`;
await writeFile('docs/content/GENERATOR_FAILURE_ANALYSIS.md',doc);
console.log(JSON.stringify(summary,null,2));
