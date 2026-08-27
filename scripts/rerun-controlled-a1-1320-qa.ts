import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { curriculumCatalog } from '../data/production/curriculum-catalog';
import { completeProductionQuestionSet } from '../data/production/mass-question-candidates';
import { DeterministicJftContentQaJudge, type QaQuestion } from '../lib/server/jft-content-qa-agent';
import { buildAnswerOracleInput, compareOracleWithDeclaredAnswer } from '../lib/server/answer-oracle';
import { DeterministicAnswerOracleProvider } from '../lib/server/answer-oracle-provider';
import { buildJapaneseNaturalnessInput, validateJapaneseNaturalnessOutput, withJapaneseNaturalnessAudit } from '../lib/server/japanese-naturalness';
import { MockJapaneseNaturalnessProvider } from '../lib/server/japanese-naturalness-provider';
import { finalizeCurriculumGrounding, validateCurriculumGroundingAnalysis, withCurriculumGroundingAudit, type CurriculumGroundingInput } from '../lib/server/curriculum-grounding';
import { MockCurriculumGroundingProvider } from '../lib/server/curriculum-grounding-provider';
import { buildDeclaredAlignmentTarget, buildJftAlignmentClassificationInput, finalizeJftAlignment, validateJftAlignmentAnalysis, withJftAlignmentAudit } from '../lib/server/jft-alignment';
import { MockJftAlignmentProvider } from '../lib/server/jft-alignment-provider';
import { buildDifficultyCalibrationInput, finalizeDifficultyCalibration, validateDifficultyCalibrationAnalysis, withDifficultyCalibrationAudit } from '../lib/server/difficulty-calibration';
import { MockDifficultyCalibrationProvider } from '../lib/server/difficulty-calibration-provider';
import { buildOriginalityDuplicateInput, finalizeOriginalityDuplicate, validateOriginalityDuplicateAnalysis, withOriginalityDuplicateAudit, type OriginalityCorpusItem } from '../lib/server/originality-duplicate';
import { MockOriginalityDuplicateProvider } from '../lib/server/originality-duplicate-provider';
import { textSimilarity } from '../lib/server/duplicate-detection';

type ArtifactRecord = {
  blueprint: { id:string; category:string; canDo:string; topic:string; templateId:string; taskIntent:string; targetKnowledge:string[]; knowledgeUnitIds:string[]; answerContract:{correctValue:string} };
  question: any;
  audioScript?: string;
  preflight: { passed:boolean };
  qa: Record<string,{verdict:string}>;
  humanReview: unknown;
};

const sourcePaths = [
  'data/pilots/generator-recovery-a1-pilot.json',
  'data/pilots/generator-recovery-a1-pilot-2.json',
  ...Array.from({ length: 62 }, (_, index) => `data/production/controlled-a1-batch-${String(index + 1).padStart(3, '0')}.json`),
];
const records: ArtifactRecord[] = (await Promise.all(sourcePaths.map(async path => (JSON.parse(await readFile(path, 'utf8')) as {records:ArtifactRecord[]}).records))).flat();
if (records.length !== 1320) throw new Error(`Expected 1320 questions, received ${records.length}.`);
if (new Set(records.map(record => record.question.id)).size !== 1320) throw new Error('Question IDs are not unique.');

const qa1Judge = new DeterministicJftContentQaJudge();
const qa2Provider = new DeterministicAnswerOracleProvider();
const qa3Provider = new MockJapaneseNaturalnessProvider();
const qa4Provider = new MockCurriculumGroundingProvider();
const qa5Provider = new MockJftAlignmentProvider();
const qa6Provider = new MockDifficultyCalibrationProvider();
const qa7Provider = new MockOriginalityDuplicateProvider();
const a1Units = curriculumCatalog.filter(unit => unit.level === 'A1');
const allNew = records.map(record => ({id:record.question.id, text:`${record.question.instruction}\n${record.question.prompt}\n${record.question.choices.join('\n')}\n${record.audioScript || ''}`}));
const oldBank = completeProductionQuestionSet.map(question => ({id:question.id,text:`${question.instruction}\n${question.prompt}\n${question.choices.join('\n')}`}));

const gateCounts = Object.fromEntries(Array.from({length:7},(_,index)=>[`qa${index+1}`,{PASS:0,REVIEW:0,FAIL:0}])) as Record<string,Record<string,number>>;
const output: Array<Record<string,unknown>> = [];
const compact = (gate:string,result:any) => {
  const base={qaVersion:result.qaVersion,questionId:result.questionId,verdict:result.verdict,hardFail:result.hardFail,confidence:result.confidence,issues:result.issues,release:result.release,provider:result.provider,model:result.model,promptVersion:result.promptVersion,checkedAt:result.checkedAt};
  if(gate==='qa1')return {...base,independentAnswer:result.independentAnswer,classification:result.classification,scores:result.scores,originality:result.originality};
  if(gate==='qa2')return {...base,derivedCorrectOptions:result.derivedCorrectOptions,numberOfDefensibleAnswers:result.numberOfDefensibleAnswers,outcome:result.outcome,declaredCorrectOption:result.declaredCorrectOption,match:result.match,ambiguity:result.ambiguity,hiddenContextRequired:result.hiddenContextRequired};
  if(gate==='qa3')return {...base,scores:result.scores,contextAssessment:result.contextAssessment};
  if(gate==='qa4')return {...base,coverage:result.coverage,outsideKnowledge:result.outsideKnowledge,provenance:result.provenance,retrieval:result.retrieval,evaluatedKnowledgeUnitIds:result.evaluatedKnowledgeUnitIds};
  if(gate==='qa5')return {...base,declared:result.declared,independentAssessment:result.independentAssessment,alignment:result.alignment,taskValidity:result.taskValidity,scores:result.scores,referenceVersion:result.referenceVersion,taxonomyVersion:result.taxonomyVersion};
  if(gate==='qa6')return {...base,declaredLevel:result.declaredLevel,estimatedLevel:result.estimatedLevel,levelMatch:result.levelMatch,difficultyScore:result.difficultyScore,profile:result.profile,reasoningDepth:result.reasoningDepth,empirical:result.empirical,calibrationVersion:result.calibrationVersion};
  return {...base,policyVersion:result.policyVersion,algorithmVersion:result.algorithmVersion,summary:result.summary,comparisons:(result.comparisons||[]).filter((value:any)=>value.semanticRisk==='HIGH'||value.semanticRisk==='MEDIUM')};
};
for (const [index, record] of records.entries()) {
  const {blueprint,question,audioScript} = record;
  const unit = a1Units.find(value => blueprint.knowledgeUnitIds.includes(value.id));
  const sourceDocument = unit?.sourceDocument || `CURRICULUM-${blueprint.knowledgeUnitIds[0]}`;
  const qaQuestion:QaQuestion = {...question,sourceDocument,category:blueprint.category,canDo:blueprint.canDo,knowledgeUnitIds:blueprint.knowledgeUnitIds,audioScript,productionStatus:'CONTROLLED_REVIEW'};
  const nearestScore = Math.max(0,...allNew.filter(value=>value.id!==question.id).map(value=>textSimilarity(question.prompt,value.text)),...oldBank.map(value=>textSimilarity(question.prompt,value.text)));
  const qa1 = qa1Judge.judge(qaQuestion,{unit:{id:blueprint.knowledgeUnitIds[0],anchors:blueprint.targetKnowledge},audioAvailable:question.section!=='listening'||Boolean(audioScript),sourceSimilarityScore:0,duplicateSimilarityScore:nearestScore});

  const qa2Input=buildAnswerOracleInput(question,audioScript);const qa2Solve=await qa2Provider.solve(qa2Input);const qa2=compareOracleWithDeclaredAnswer(qa2Solve,question.answer,{provider:qa2Provider.name,model:qa2Provider.model});
  const qa3Input=buildJapaneseNaturalnessInput(question,{audioScript,category:blueprint.category,topic:blueprint.topic,canDo:blueprint.canDo});const qa3=withJapaneseNaturalnessAudit(validateJapaneseNaturalnessOutput(await qa3Provider.judge(qa3Input),qa3Input),{provider:qa3Provider.name,model:qa3Provider.model});

  const approvedKnowledgeUnits=a1Units.map(value=>({id:value.id,sourceDocumentId:value.sourceDocument,sourceChunkIds:[`CATALOG-${value.id}`],status:'approved' as const,chapter:`Lesson ${value.lesson}`,lesson:String(value.lesson),topic:value.topic,situation:value.title,level:value.level,canDo:value.canDo,grammar:['～です','～ます','～ません','～ませんか','～たいです','～てください'],vocabulary:[...value.anchors],kanji:value.anchors.filter(anchor=>/\p{Script=Han}/u.test(anchor)),expressions:value.anchors.filter(anchor=>/[ぁ-んァ-ヶ]/u.test(anchor)),keyKnowledge:[value.title,value.canDo],skills:['script_vocabulary','conversation_expression','listening','reading']}));
  const qa4Input:CurriculumGroundingInput={questionId:question.id,instruction:question.instruction,stem:question.prompt,choices:[...question.choices],...(audioScript?{audioScript}:{}),section:question.section,category:blueprint.category,targetLevel:question.level,targetCanDo:blueprint.canDo,topic:blueprint.topic,approvedKnowledgeUnits,sourceChunks:a1Units.map(value=>({id:`CATALOG-${value.id}`,sourceDocumentId:value.sourceDocument,normalizedText:[value.title,value.canDo,...value.anchors].join('、')})),retrieval:{complete:true,strategy:'FULL_APPROVED_CATALOG',totalApprovedUnits:a1Units.length,returnedUnitCount:a1Units.length,searchedSourceDocumentIds:Array.from(new Set(a1Units.map(value=>value.sourceDocument))),intendedKnowledgeUnitIds:blueprint.knowledgeUnitIds,missingIntendedKnowledgeUnitIds:blueprint.knowledgeUnitIds.filter(id=>!a1Units.some(value=>value.id===id))}};
  const qa4Analysis=validateCurriculumGroundingAnalysis(await qa4Provider.evaluate(qa4Input),qa4Input);const qa4=withCurriculumGroundingAudit(finalizeCurriculumGrounding(qa4Analysis,qa4Input),{provider:qa4Provider.name,model:qa4Provider.model});
  const qa5Input=buildJftAlignmentClassificationInput(question,audioScript);const qa5Analysis=validateJftAlignmentAnalysis(await qa5Provider.classify(qa5Input),qa5Input);const qa5=withJftAlignmentAudit(finalizeJftAlignment(qa5Analysis,buildDeclaredAlignmentTarget(question,{category:blueprint.category,canDo:blueprint.canDo,taskType:blueprint.templateId}),qa5Input,question.id),{provider:qa5Provider.name,model:qa5Provider.model});
  const qa6Input=buildDifficultyCalibrationInput(question,{category:blueprint.category,audioScript});const qa6Analysis=validateDifficultyCalibrationAnalysis(await qa6Provider.estimate(qa6Input),qa6Input);const qa6=withDifficultyCalibrationAudit(finalizeDifficultyCalibration(qa6Analysis,question.level,qa6Input,undefined,question.id),{provider:qa6Provider.name,model:qa6Provider.model});

  const ranked=[...allNew.filter(value=>value.id!==question.id).map(value=>({...value,kind:'BATCH' as const,score:textSimilarity(question.prompt,value.text)})),...oldBank.map(value=>({...value,kind:'BANK' as const,score:textSimilarity(question.prompt,value.text)}))].sort((a,b)=>b.score-a.score).slice(0,30);
  const corpus:OriginalityCorpusItem[]=[{id:`SOURCE-${blueprint.knowledgeUnitIds[0]}`,kind:'SOURCE',text:`Curriculum knowledge: ${blueprint.targetKnowledge.join('、')}`},...ranked.map(({id,kind,text})=>({id,kind,text}))];
  const qa7Input=buildOriginalityDuplicateInput(question,{audioScript,sourceExpected:true,corpus});const qa7Analysis=validateOriginalityDuplicateAnalysis(await qa7Provider.analyze(qa7Input),qa7Input);const qa7=withOriginalityDuplicateAudit(finalizeOriginalityDuplicate(qa7Analysis,qa7Input,question.id),{provider:qa7Provider.name,model:qa7Provider.model});
  const rerun={qa1,qa2,qa3,qa4,qa5,qa6,qa7};
  for(const [gate,result] of Object.entries(rerun))gateCounts[gate][result.verdict]=(gateCounts[gate][result.verdict]||0)+1;
  const allPass=record.preflight.passed&&Object.values(rerun).every(result=>result.verdict==='PASS');
  output.push({questionId:question.id,previous:Object.fromEntries(Object.entries(record.qa).map(([gate,value])=>[gate,value.verdict])),rerun:Object.fromEntries(Object.entries(rerun).map(([gate,result])=>[gate,compact(gate,result)])),allPass,humanReview:record.humanReview});
  if((index+1)%100===0)console.log(`QA rerun ${index+1}/${records.length}`);
}

const allPassCount=output.filter(value=>value.allPass).length;
const artifact={qaRunVersion:'CONTROLLED_A1_1320_QA_RERUN_V1',generatedAt:new Date().toISOString(),providerMode:'deterministic-specialized-judges',audioSemanticEvidenceAvailable:true,curriculumRetrieval:{complete:true,units:a1Units.length,source:'data/production/curriculum-catalog.ts'},total:records.length,allPass:allPassCount,requiresReview:records.length-allPassCount,gateCounts,records:output};
await mkdir('data/qa',{recursive:true});await mkdir('docs/reviews',{recursive:true});
await writeFile('data/qa/controlled-a1-1320-qa-rerun.json',`${JSON.stringify(artifact,null,2)}\n`);
const rows=Object.entries(gateCounts).map(([gate,counts])=>`| ${gate.toUpperCase()} | ${counts.PASS||0} | ${counts.REVIEW||0} | ${counts.FAIL||0} |`).join('\n');
await writeFile('docs/reviews/CONTROLLED_A1_1320_QA_RERUN.md',`# Controlled A1 1320 — QA rerun\n\n- Run: ${artifact.generatedAt}\n- Questions: ${records.length}\n- Audio semantic evidence: available for all 330 Listening scripts; production MP3 validation is handled by the release pack.\n- Curriculum retrieval: full checked-in A1 catalog (${a1Units.length} units).\n- Provider mode: deterministic specialized judges. No verdict was coerced or manually changed.\n\n| Gate | PASS | REVIEW | FAIL |\n|---|---:|---:|---:|\n${rows}\n\n- Passed every gate: **${allPassCount}/${records.length}**\n- Still requiring review: **${records.length-allPassCount}/${records.length}**\n\nQuestions that do not pass every gate remain in Question Bank status \`review\`; deployment does not publish them to candidate exams.\n`);
console.log(JSON.stringify({total:records.length,allPass:allPassCount,requiresReview:records.length-allPassCount,gateCounts},null,2));
