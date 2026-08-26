import {mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {buildRecoveryBlueprint,generatorRecoveryA1Blueprints,type RecoveryBlueprintSpec} from '../data/pilots/generator-recovery-a1-blueprints';
import {generatorRecoveryA1Pilot2Blueprints} from '../data/pilots/generator-recovery-a1-pilot-2-blueprints';
import {controlledA1Batch001Blueprints} from '../data/production/controlled-a1-batch-001-blueprints';
import {controlledA1Batch002Blueprints} from '../data/production/controlled-a1-batch-002-blueprints';
import {controlledA1Batch003Blueprints} from '../data/production/controlled-a1-batch-003-blueprints';
import {controlledA1Batch004Blueprints} from '../data/production/controlled-a1-batch-004-blueprints';
import {completeProductionQuestionSet} from '../data/production/mass-question-candidates';
import {generateBlueprintItem} from '../lib/server/generator-v2';
import {DeterministicBlueprintGenerationProvider} from '../lib/server/generator-v2-provider';
import {DeterministicJftContentQaJudge,type QaQuestion} from '../lib/server/jft-content-qa-agent';
import {buildAnswerOracleInput,compareOracleWithDeclaredAnswer} from '../lib/server/answer-oracle';
import {DeterministicAnswerOracleProvider} from '../lib/server/answer-oracle-provider';
import {buildJapaneseNaturalnessInput,validateJapaneseNaturalnessOutput,withJapaneseNaturalnessAudit} from '../lib/server/japanese-naturalness';
import {MockJapaneseNaturalnessProvider} from '../lib/server/japanese-naturalness-provider';
import {finalizeCurriculumGrounding,validateCurriculumGroundingAnalysis,withCurriculumGroundingAudit,type CurriculumGroundingInput} from '../lib/server/curriculum-grounding';
import {MockCurriculumGroundingProvider} from '../lib/server/curriculum-grounding-provider';
import {buildDeclaredAlignmentTarget,buildJftAlignmentClassificationInput,finalizeJftAlignment,validateJftAlignmentAnalysis,withJftAlignmentAudit} from '../lib/server/jft-alignment';
import {MockJftAlignmentProvider} from '../lib/server/jft-alignment-provider';
import {buildDifficultyCalibrationInput,finalizeDifficultyCalibration,validateDifficultyCalibrationAnalysis,withDifficultyCalibrationAudit} from '../lib/server/difficulty-calibration';
import {MockDifficultyCalibrationProvider} from '../lib/server/difficulty-calibration-provider';
import {buildOriginalityDuplicateInput,finalizeOriginalityDuplicate,validateOriginalityDuplicateAnalysis,withOriginalityDuplicateAudit,type OriginalityCorpusItem} from '../lib/server/originality-duplicate';
import {MockOriginalityDuplicateProvider} from '../lib/server/originality-duplicate-provider';
import {textSimilarity} from '../lib/server/duplicate-detection';

const autoBatch=process.env.CONTROLLED_A1_AUTO_BATCH&&/^\d{3}$/.test(process.env.CONTROLLED_A1_AUTO_BATCH)?process.env.CONTROLLED_A1_AUTO_BATCH:undefined;
const explicitScale=process.env.GENERATOR_RECOVERY_PILOT?.match(/^scale-(\d{3})$/)?.[1];
const batchId=autoBatch||explicitScale;
const runMode=batchId?`scale-${batchId}`:process.env.GENERATOR_RECOVERY_PILOT==='2'?'pilot-2':'pilot-1';
const explicitBlueprints:Record<string,typeof controlledA1Batch001Blueprints>={'001':controlledA1Batch001Blueprints,'002':controlledA1Batch002Blueprints,'003':controlledA1Batch003Blueprints,'004':controlledA1Batch004Blueprints};
const autoSpecs=autoBatch?JSON.parse(await readFile(`data/production/controlled-a1-batch-${autoBatch}-blueprints.json`,'utf8')) as RecoveryBlueprintSpec[]:undefined;
const blueprints=autoSpecs?autoSpecs.map(buildRecoveryBlueprint):batchId?explicitBlueprints[batchId]:runMode==='pilot-2'?generatorRecoveryA1Pilot2Blueprints:generatorRecoveryA1Blueprints;
if(!blueprints)throw new Error(`No blueprints found for ${runMode}.`);
const expectedCount=runMode.startsWith('scale-')?20:40;
if(blueprints.length!==expectedCount)throw new Error(`${runMode} must contain exactly ${expectedCount} blueprints, found ${blueprints.length}.`);
const priorControlled=batchId?(await readdir('data/production')).filter(name=>/^controlled-a1-batch-\d{3}\.json$/.test(name)&&name.slice(20,23)<batchId).sort().map(name=>`data/production/${name}`):[];
const priorPaths=runMode==='pilot-1'?[]:runMode==='pilot-2'?['data/pilots/generator-recovery-a1-pilot.json']:['data/pilots/generator-recovery-a1-pilot.json','data/pilots/generator-recovery-a1-pilot-2.json',...priorControlled];
const previousPilotItems:any[]=(await Promise.all(priorPaths.map(async path=>(JSON.parse(await readFile(path,'utf8')) as any).records))).flat();
const oldIds=new Set([...completeProductionQuestionSet.map(question=>question.id),...previousPilotItems.map(record=>record.question.id)]);
const generator=new DeterministicBlueprintGenerationProvider();const qa1Judge=new DeterministicJftContentQaJudge();const qa2Provider=new DeterministicAnswerOracleProvider();const qa3Provider=new MockJapaneseNaturalnessProvider();const qa4Provider=new MockCurriculumGroundingProvider();const qa5Provider=new MockJftAlignmentProvider();const qa6Provider=new MockDifficultyCalibrationProvider();const qa7Provider=new MockOriginalityDuplicateProvider();
const generated=[];
for(const [index,blueprint] of blueprints.entries()){
  const item=await generateBlueprintItem(blueprint,generator,{id:blueprint.id,choiceRotation:index%4});
  if(oldIds.has(item.question.id))throw new Error(`Pilot ID collides with historical bank: ${item.question.id}`);
  generated.push(item);
}

const records:Array<Record<string,any>>=[];
for(const [index,item] of generated.entries()){
  const {blueprint,question,audioScript}=item;const previous=generated.slice(0,index);
  const duplicateSimilarityScore=Math.max(0,...completeProductionQuestionSet.map(existing=>textSimilarity(question.prompt,existing.prompt)),...previous.map(existing=>textSimilarity(question.prompt,existing.question.prompt)));
  const qaQuestion:QaQuestion={...question,category:blueprint.category,canDo:blueprint.canDo,knowledgeUnitIds:blueprint.knowledgeUnitIds,audioScript,productionStatus:runMode.startsWith('scale-')?'CONTROLLED_REVIEW':'PILOT_REVIEW'};
  const qa1=qa1Judge.judge(qaQuestion,{unit:{id:blueprint.knowledgeUnitIds[0],anchors:blueprint.targetKnowledge},audioAvailable:question.type!=='audio_choice',sourceSimilarityScore:0,duplicateSimilarityScore});

  const qa2Input=buildAnswerOracleInput(question,audioScript);const qa2Solve=await qa2Provider.solve(qa2Input);const qa2=compareOracleWithDeclaredAnswer(qa2Solve,question.answer,{provider:qa2Provider.name,model:qa2Provider.model});

  const qa3Input=buildJapaneseNaturalnessInput(question,{audioScript,category:blueprint.category,topic:blueprint.topic,canDo:blueprint.canDo});const qa3Assessment=validateJapaneseNaturalnessOutput(await qa3Provider.judge(qa3Input),qa3Input);const qa3=withJapaneseNaturalnessAudit(qa3Assessment,{provider:qa3Provider.name,model:qa3Provider.model});

  const unitId=blueprint.knowledgeUnitIds[0],sourceDocumentId=`CURRICULUM-${unitId}`,chunkId=`CHUNK-${unitId}`;
  const qa4Input:CurriculumGroundingInput={questionId:question.id,instruction:question.instruction,stem:question.prompt,choices:[...question.choices],...(audioScript?{audioScript}:{}),section:question.section,category:blueprint.category,targetLevel:question.level,targetCanDo:blueprint.canDo,topic:blueprint.topic,approvedKnowledgeUnits:[{id:unitId,sourceDocumentId,sourceChunkIds:[chunkId],status:'approved',topic:blueprint.topic,situation:blueprint.taskIntent,level:'A1',canDo:blueprint.canDo,grammar:['～です','～ます','～ませんか','～たいです','～てください'],vocabulary:blueprint.targetKnowledge,kanji:blueprint.targetKnowledge.filter(value=>/\p{Script=Han}/u.test(value)),expressions:[blueprint.answerContract.correctValue],keyKnowledge:[blueprint.taskIntent],skills:[question.section]}],sourceChunks:[{id:chunkId,sourceDocumentId,normalizedText:blueprint.targetKnowledge.join('、')}],retrieval:{complete:false,strategy:'INTENDED_PLUS_RELEVANT',totalApprovedUnits:1,returnedUnitCount:1,searchedSourceDocumentIds:[sourceDocumentId],intendedKnowledgeUnitIds:[unitId],missingIntendedKnowledgeUnitIds:[],reason:'Repository curriculum catalog contains abstract anchors; full source-chunk retrieval is intentionally not claimed for this pilot.'}};
  const qa4Analysis=validateCurriculumGroundingAnalysis(await qa4Provider.evaluate(qa4Input),qa4Input);const qa4=withCurriculumGroundingAudit(finalizeCurriculumGrounding(qa4Analysis,qa4Input),{provider:qa4Provider.name,model:qa4Provider.model});

  const qa5Input=buildJftAlignmentClassificationInput(question,audioScript);const qa5Analysis=validateJftAlignmentAnalysis(await qa5Provider.classify(qa5Input),qa5Input);const qa5=withJftAlignmentAudit(finalizeJftAlignment(qa5Analysis,buildDeclaredAlignmentTarget(question,{category:blueprint.category,canDo:blueprint.canDo,taskType:blueprint.templateId}),qa5Input,question.id),{provider:qa5Provider.name,model:qa5Provider.model});

  const qa6Input=buildDifficultyCalibrationInput(question,{category:blueprint.category,audioScript});const qa6Analysis=validateDifficultyCalibrationAnalysis(await qa6Provider.estimate(qa6Input),qa6Input);const qa6=withDifficultyCalibrationAudit(finalizeDifficultyCalibration(qa6Analysis,question.level,qa6Input,undefined,question.id),{provider:qa6Provider.name,model:qa6Provider.model});

  const corpus:OriginalityCorpusItem[]=[{id:`SOURCE-${unitId}`,kind:'SOURCE',text:`Curriculum knowledge: ${blueprint.targetKnowledge.join('、')}`} as const,...completeProductionQuestionSet.map(existing=>({id:existing.id,kind:'BANK' as const,text:`${existing.instruction}\n${existing.prompt}\n${existing.choices.join('\n')}`})),...previousPilotItems.map(existing=>({id:existing.question.id,kind:'BANK' as const,text:`${existing.question.instruction}\n${existing.question.prompt}\n${existing.question.choices.join('\n')}\n${existing.audioScript||''}`})),...generated.filter(other=>other.question.id!==question.id).map(other=>({id:other.question.id,kind:'BATCH' as const,text:`${other.question.instruction}\n${other.question.prompt}\n${other.question.choices.join('\n')}\n${other.audioScript||''}`}))];
  const qa7Input=buildOriginalityDuplicateInput(question,{audioScript,sourceExpected:true,corpus});const qa7Analysis=validateOriginalityDuplicateAnalysis(await qa7Provider.analyze(qa7Input),qa7Input);const qa7=withOriginalityDuplicateAudit(finalizeOriginalityDuplicate(qa7Analysis,qa7Input,question.id),{provider:qa7Provider.name,model:qa7Provider.model});
  const gates={qa1:qa1.verdict,qa2:qa2.verdict,qa3:qa3.verdict,qa4:qa4.verdict,qa5:qa5.verdict,qa6:qa6.verdict,qa7:qa7.verdict};
  records.push({...item,qa:{qa1,qa2,qa3,qa4,qa5,qa6,qa7},machinePassed:item.preflight.passed&&Object.values(gates).every(value=>value==='PASS'),humanReview:{decision:null as null|'GOLD'|'REVISE'|'REJECT',reason:''}});
}

const sections=['script_vocabulary','conversation_expression','listening','reading'];
const count=(name:keyof (typeof records)[number]['qa'])=>records.filter(record=>record.qa[name].verdict==='PASS').length;
const groupMetrics=(key:(record:(typeof records)[number])=>string)=>Object.fromEntries([...new Set(records.map(key))].sort().map(value=>[value,{generated:records.filter(record=>key(record)===value).length,preflightPass:records.filter(record=>key(record)===value&&record.preflight.passed).length,machinePass:records.filter(record=>key(record)===value&&record.machinePassed).length,humanGold:null}]));
const summary={generated:records.length,preflightPass:records.filter(x=>x.preflight.passed).length,qa1Pass:count('qa1'),qa2Pass:count('qa2'),qa3Pass:count('qa3'),qa4Pass:count('qa4'),qa5Pass:count('qa5'),qa6Pass:count('qa6'),qa7Pass:count('qa7'),machinePass:records.filter(x=>x.machinePassed).length,humanGold:null,humanReviewStatus:'PENDING',preflightYield:records.filter(x=>x.preflight.passed).length/records.length,machineQaYield:records.filter(x=>x.machinePassed).length/records.length,humanGoldYield:null,bySection:groupMetrics(record=>record.question.section),byCategory:groupMetrics(record=>record.blueprint.category),byCanDo:groupMetrics(record=>record.blueprint.canDo),byTemplate:groupMetrics(record=>record.blueprint.templateId)};
const artifactVersion=batchId?`CONTROLLED_A1_BATCH_${batchId}_V1`:runMode==='pilot-2'?'GENERATOR_RECOVERY_A1_PILOT_2_V1':'GENERATOR_RECOVERY_A1_PILOT_V1';
const artifact={artifactVersion,pilotVersion:artifactVersion,generatorVersion:'JFT_QUESTION_GENERATOR_V2',runMode,generatedAt:new Date().toISOString(),frozenBeforeHumanReview:true,manualPreEvaluationEdits:0,summary,records};
await mkdir('data/pilots',{recursive:true});await mkdir('docs/reviews',{recursive:true});
const pilotDataPath=batchId?`data/production/controlled-a1-batch-${batchId}.json`:runMode==='pilot-2'?'data/pilots/generator-recovery-a1-pilot-2.json':'data/pilots/generator-recovery-a1-pilot.json';
const pilotReviewPath=batchId?`docs/reviews/CONTROLLED_A1_BATCH_${batchId}.md`:runMode==='pilot-2'?'docs/reviews/GENERATOR_RECOVERY_A1_PILOT_2.md':'docs/reviews/GENERATOR_RECOVERY_A1_PILOT.md';
await writeFile(pilotDataPath,JSON.stringify(artifact,null,2)+'\n');

const verdict=(value:{verdict:string;release?:{blockReason?:string[]};issues?:Array<{code:string}>})=>`${value.verdict}${value.release?.blockReason?.length?` — ${value.release.blockReason.join(', ')}`:value.issues?.length?` — ${value.issues.map(x=>x.code).join(', ')}`:''}`;
const blocks=records.map(record=>`## ${record.question.id}\n\n- Level: ${record.question.level}\n- Section: ${record.question.section}\n- Category: ${record.blueprint.category}\n- Can-do: ${record.blueprint.canDo}\n- Blueprint: ${record.blueprint.id} / ${record.blueprint.templateId}\n- KnowledgeUnit: ${record.blueprint.knowledgeUnitIds.join(', ')}\n- Preflight: ${record.preflight.passed?'PASS':'FAIL'}\n\n**Stimulus / script**\n\n${record.audioScript?record.audioScript:record.question.section==='reading'?record.question.prompt.split('\n\n')[0]:'N/A'}\n\n**Prompt**\n\n${record.question.section==='reading'?record.question.prompt.split('\n\n').slice(1).join('\n\n'):record.question.prompt}\n\n**Choices**\n\n${record.question.choices.map((choice:string,index:number)=>`${index===record.question.answer?'*':'-'} ${String.fromCharCode(65+index)}. ${choice}`).join('\n')}\n\n- Declared answer: ${String.fromCharCode(65+record.question.answer)} — ${record.question.choices[record.question.answer]}\n- Independent answer: ${record.qa.qa2.derivedCorrectOptions.map((index:number)=>`${String.fromCharCode(65+index)} — ${record.question.choices[index]}`).join('; ')||'No defensible answer derived by configured oracle'}\n- Explanation: ${record.question.explanationVi}\n\n**QA evidence**\n\n- QA1 General Content: ${verdict(record.qa.qa1)}\n- QA2 Answer Oracle: ${verdict(record.qa.qa2)}\n- QA3 Japanese Naturalness: ${verdict(record.qa.qa3)}\n- QA4 Curriculum Grounding: ${verdict(record.qa.qa4)}\n- QA5 JFT Alignment: ${verdict(record.qa.qa5)}\n- QA6 Difficulty: ${verdict(record.qa.qa6)}\n- QA7 Originality: ${verdict(record.qa.qa7)}\n\n**Human review — leave unchanged until independent review**\n\nHUMAN_DECISION: [ ] GOLD  [ ] REVISE  [ ] REJECT\n\nHUMAN_REASON:\n\n---`).join('\n\n');
const heading=batchId?`Controlled A1 Batch ${batchId}`:runMode==='pilot-2'?'Generator Recovery A1 Pilot 2':'Generator Recovery A1 Pilot 1';
const perSection=expectedCount/4;
const priorNote=batchId?` Both approved recovery pilots and all earlier Controlled A1 batches are included in ID and QA7 comparisons.`:runMode==='pilot-2'?' Pilot 1 questions are included in QA7 bank comparisons.':'';
const markdown=`# ${heading} — Human Review Pack\n\nGenerated: ${artifact.generatedAt}\n\nThis package contains exactly **${expectedCount} fresh A1 items** (${perSection} per section). The outputs were frozen immediately after Generator V2 → preflight → QA1–QA7. No item received a manual pre-evaluation content edit and none is approved or inserted into the Question Bank.${priorNote}\n\n## Machine summary\n\n| Stage | Pass | Yield |\n|---|---:|---:|\n| Generated | ${summary.generated} | 100.0% |\n| Preflight | ${summary.preflightPass} | ${(summary.preflightYield*100).toFixed(1)}% |\n| QA1 | ${summary.qa1Pass} | ${(summary.qa1Pass/expectedCount*100).toFixed(1)}% |\n| QA2 | ${summary.qa2Pass} | ${(summary.qa2Pass/expectedCount*100).toFixed(1)}% |\n| QA3 | ${summary.qa3Pass} | ${(summary.qa3Pass/expectedCount*100).toFixed(1)}% |\n| QA4 | ${summary.qa4Pass} | ${(summary.qa4Pass/expectedCount*100).toFixed(1)}% |\n| QA5 | ${summary.qa5Pass} | ${(summary.qa5Pass/expectedCount*100).toFixed(1)}% |\n| QA6 | ${summary.qa6Pass} | ${(summary.qa6Pass/expectedCount*100).toFixed(1)}% |\n| QA7 | ${summary.qa7Pass} | ${(summary.qa7Pass/expectedCount*100).toFixed(1)}% |\n| All machine gates | ${summary.machinePass} | ${(summary.machineQaYield*100).toFixed(1)}% |\n| Human Gold | PENDING | PENDING |\n\nHuman Gold Yield cannot be claimed until every blank decision below is completed independently. This controlled batch cannot enter the Question Bank automatically.\n\n${blocks}\n`;
await writeFile(pilotReviewPath,markdown);
console.log(JSON.stringify(autoBatch?{generated:summary.generated,preflightPass:summary.preflightPass,qa1Pass:summary.qa1Pass,qa2Pass:summary.qa2Pass,qa3Pass:summary.qa3Pass,qa4Pass:summary.qa4Pass,qa5Pass:summary.qa5Pass,qa6Pass:summary.qa6Pass,qa7Pass:summary.qa7Pass,machinePass:summary.machinePass,humanReviewStatus:summary.humanReviewStatus}:summary,null,2));
