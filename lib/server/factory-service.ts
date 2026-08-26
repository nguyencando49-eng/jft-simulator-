import { QuestionRecord } from '@/lib/admin-types';
import { createHash } from 'node:crypto';
import { FactoryCandidate, FactoryJob, FactoryRequest } from './factory-domain';
import { getFactoryProvider } from './factory-provider';
import { runFactoryQa } from './factory-qa';
import { runQuestionQa } from './qa';
import { getRepository } from './repository';
import { getSemanticQaProvider } from './semantic-qa-provider';
import { textSimilarity } from './duplicate-detection';
import { getTtsProvider } from './tts-provider';
import { persistGeneratedAudio } from './asset-storage';
import { hasQuestionIdCollision } from './question-integrity';
import { DeterministicJftContentQaJudge,type QaQuestion } from './jft-content-qa-agent';
import { AnswerOracleError,buildAnswerOracleInput,compareOracleWithDeclaredAnswer,technicalAnswerOracleResult } from './answer-oracle';
import { getAnswerOracleProvider,type AnswerOracleProvider } from './answer-oracle-provider';
import { buildJapaneseNaturalnessInput,JapaneseNaturalnessError,technicalJapaneseNaturalnessResult,validateJapaneseNaturalnessOutput,withJapaneseNaturalnessAudit } from './japanese-naturalness';
import { getJapaneseNaturalnessProvider,type JapaneseNaturalnessProvider } from './japanese-naturalness-provider';
import { CurriculumGroundingError,finalizeCurriculumGrounding,technicalCurriculumGroundingResult,validateCurriculumGroundingAnalysis,withCurriculumGroundingAudit,type CurriculumGroundingInput } from './curriculum-grounding';
import { getCurriculumGroundingProvider,type CurriculumGroundingProvider } from './curriculum-grounding-provider';
import { buildCurriculumGroundingInput,loadCurriculumCatalog,type CurriculumCatalog } from './curriculum-retrieval';
import { buildDeclaredAlignmentTarget,buildJftAlignmentClassificationInput,finalizeJftAlignment,JftAlignmentError,technicalJftAlignmentResult,validateJftAlignmentAnalysis,withJftAlignmentAudit } from './jft-alignment';
import { getJftAlignmentProvider,type JftAlignmentProvider } from './jft-alignment-provider';
import {bindDifficultyReviewEvidence,buildDifficultyCalibrationInput,difficultyReviewFingerprint,DifficultyCalibrationError,finalizeDifficultyCalibration,technicalDifficultyCalibrationResult,validateDifficultyCalibrationAnalysis,withDifficultyCalibrationAudit} from './difficulty-calibration';
import {getDifficultyCalibrationProvider,type DifficultyCalibrationProvider} from './difficulty-calibration-provider';
import {emptyQuestionPerformance,loadQuestionPerformanceCatalog,type QuestionPerformanceAggregate} from './question-performance';
import {bindOriginalityReviewEvidence,buildOriginalityDuplicateInput,finalizeOriginalityDuplicate,OriginalityDuplicateError,originalityReviewFingerprint,technicalOriginalityDuplicateResult,validateOriginalityDuplicateAnalysis,withOriginalityDuplicateAudit,type OriginalityCorpusItem,type OriginalityDuplicateInput} from './originality-duplicate';
import {getOriginalityDuplicateProvider,type OriginalityDuplicateProvider} from './originality-duplicate-provider';
import {generateBlueprintItem} from './generator-v2';
import {getBlueprintGenerationProvider} from './generator-v2-provider';

const contentQaJudge=new DeterministicJftContentQaJudge();

export async function runAnswerOracleGate(candidate:FactoryCandidate,provider:AnswerOracleProvider=getAnswerOracleProvider()){
  candidate.qa.issues=candidate.qa.issues.filter(issue=>!issue.code.startsWith('answer_oracle_'));
  const input=buildAnswerOracleInput(candidate.question,candidate.audioScript);
  try{
    const solve=await provider.solve(input);
    candidate.answerOracleQa=compareOracleWithDeclaredAnswer(solve,candidate.question.answer,{provider:provider.name,model:provider.model,threshold:answerOracleThreshold()});
  }catch(error){
    const code=error instanceof AnswerOracleError?error.code:'QA_ORACLE_PROVIDER_FAILURE';
    candidate.answerOracleQa=technicalAnswerOracleResult(candidate.question.id,code,provider.name,provider.model);
  }
  if(candidate.answerOracleQa.verdict==='FAIL'){
    candidate.qa.issues.push({code:'answer_oracle_fail',severity:'error',category:'pedagogy',message:`${candidate.answerOracleQa.promptVersion} FAIL: ${candidate.answerOracleQa.outcome}.`});
    candidate.qa.passed=false;
  }else if(candidate.answerOracleQa.verdict==='REVIEW'){
    candidate.qa.issues.push({code:'answer_oracle_review',severity:'warning',category:'pedagogy',message:`${candidate.answerOracleQa.promptVersion} requires human review: ${candidate.answerOracleQa.outcome}.`});
  }
  return candidate.answerOracleQa;
}

function answerOracleThreshold(){const value=Number(process.env.ANSWER_ORACLE_CONFIDENCE_THRESHOLD??.85);return Number.isFinite(value)&&value>=0&&value<=1?value:.85}

export async function runJapaneseNaturalnessGate(candidate:FactoryCandidate,context:{category?:string;topic?:string;canDo?:string}={},provider:JapaneseNaturalnessProvider=getJapaneseNaturalnessProvider()){
  candidate.qa.issues=candidate.qa.issues.filter(issue=>!issue.code.startsWith('japanese_naturalness_'));
  const input=buildJapaneseNaturalnessInput(candidate.question,{audioScript:candidate.audioScript,...context});
  try{candidate.japaneseNaturalnessQa=withJapaneseNaturalnessAudit(validateJapaneseNaturalnessOutput(await provider.judge(input),input),{provider:provider.name,model:provider.model});}
  catch(error){const code=error instanceof JapaneseNaturalnessError?error.code:'JAPANESE_NATURALNESS_PROVIDER_FAILURE';candidate.japaneseNaturalnessQa=technicalJapaneseNaturalnessResult(input,code,provider.name,provider.model);}
  if(candidate.japaneseNaturalnessQa.verdict==='FAIL'){
    candidate.qa.issues.push({code:'japanese_naturalness_fail',severity:'error',category:'language',message:`${candidate.japaneseNaturalnessQa.promptVersion} FAIL: ${candidate.japaneseNaturalnessQa.release.blockReason.join(', ')||`score ${candidate.japaneseNaturalnessQa.scores.overall}`}.`});
    candidate.qa.passed=false;candidate.qa.score=Math.min(candidate.qa.score,candidate.japaneseNaturalnessQa.scores.overall);
  }else if(candidate.japaneseNaturalnessQa.verdict==='REVIEW'){
    candidate.qa.issues.push({code:'japanese_naturalness_review',severity:'warning',category:'language',message:`${candidate.japaneseNaturalnessQa.promptVersion} requires human review (${candidate.japaneseNaturalnessQa.scores.overall}/100, ${candidate.japaneseNaturalnessQa.confidence} confidence).`});
    candidate.qa.score=Math.min(candidate.qa.score,candidate.japaneseNaturalnessQa.scores.overall);
  }
  return candidate.japaneseNaturalnessQa;
}

export async function runCurriculumGroundingGate(candidate:FactoryCandidate,input:CurriculumGroundingInput,provider:CurriculumGroundingProvider=getCurriculumGroundingProvider()){
  candidate.qa.issues=candidate.qa.issues.filter(issue=>!issue.code.startsWith('curriculum_grounding_'));
  try{const analysis=validateCurriculumGroundingAnalysis(await provider.evaluate(input),input);candidate.curriculumGroundingQa=withCurriculumGroundingAudit(finalizeCurriculumGrounding(analysis,input),{provider:provider.name,model:provider.model});}
  catch(error){const code=error instanceof CurriculumGroundingError?error.code:'CURRICULUM_GROUNDING_PROVIDER_FAILURE';candidate.curriculumGroundingQa=technicalCurriculumGroundingResult(input,code,provider.name,provider.model);}
  const coverageScore=Math.round(candidate.curriculumGroundingQa.coverage.coverageRatio*100);
  if(candidate.curriculumGroundingQa.verdict==='FAIL'){
    candidate.qa.issues.push({code:'curriculum_grounding_fail',severity:'error',category:'pedagogy',message:`${candidate.curriculumGroundingQa.promptVersion} FAIL: ${candidate.curriculumGroundingQa.release.blockReason.join(', ')||'essential curriculum knowledge unsupported'}.`});candidate.qa.passed=false;candidate.qa.score=Math.min(candidate.qa.score,coverageScore);
  }else if(candidate.curriculumGroundingQa.verdict==='REVIEW'){
    candidate.qa.issues.push({code:'curriculum_grounding_review',severity:'warning',category:'pedagogy',message:`${candidate.curriculumGroundingQa.promptVersion} requires human review (${candidate.curriculumGroundingQa.coverage.supportedCount}/${candidate.curriculumGroundingQa.coverage.requiredCount} required items supported).`});candidate.qa.score=Math.min(candidate.qa.score,coverageScore);
  }
  return candidate.curriculumGroundingQa;
}

async function applyCurriculumGroundingQa(job:FactoryJob,candidate:FactoryCandidate,catalog:CurriculumCatalog){const input=await buildCurriculumGroundingInput(job,candidate,catalog,getRepository());return runCurriculumGroundingGate(candidate,input)}

export async function runJftAlignmentGate(candidate:FactoryCandidate,context:{category?:string;canDo?:string;taskType?:string}={},provider:JftAlignmentProvider=getJftAlignmentProvider()){
  candidate.qa.issues=candidate.qa.issues.filter(issue=>!issue.code.startsWith('jft_alignment_'));
  const input=buildJftAlignmentClassificationInput(candidate.question,candidate.audioScript);
  const declared=buildDeclaredAlignmentTarget(candidate.question,context);
  try{
    const analysis=validateJftAlignmentAnalysis(await provider.classify(input),input);
    candidate.jftAlignmentQa=withJftAlignmentAudit(finalizeJftAlignment(analysis,declared,input,candidate.question.id),{provider:provider.name,model:provider.model});
  }catch(error){
    const code=error instanceof JftAlignmentError?error.code:'JFT_ALIGNMENT_PROVIDER_FAILURE';
    candidate.jftAlignmentQa=technicalJftAlignmentResult(input,declared,code,provider.name,provider.model,candidate.question.id);
  }
  bindAlignmentReviewEvidence(candidate.jftAlignmentQa,input,declared);
  if(candidate.jftAlignmentQa.verdict==='FAIL'){
    candidate.qa.issues.push({code:'jft_alignment_fail',severity:'error',category:'jft_style',message:`${candidate.jftAlignmentQa.promptVersion} FAIL: ${candidate.jftAlignmentQa.release.blockReason.join(', ')||`score ${candidate.jftAlignmentQa.scores.total}`}.`});
    candidate.qa.passed=false;candidate.qa.score=Math.min(candidate.qa.score,candidate.jftAlignmentQa.scores.total);
  }else if(candidate.jftAlignmentQa.verdict==='REVIEW'){
    candidate.qa.issues.push({code:'jft_alignment_review',severity:'warning',category:'jft_style',message:`${candidate.jftAlignmentQa.promptVersion} requires human review (${candidate.jftAlignmentQa.scores.total}/100, ${candidate.jftAlignmentQa.confidence} confidence).`});
    candidate.qa.score=Math.min(candidate.qa.score,candidate.jftAlignmentQa.scores.total);
  }
  return candidate.jftAlignmentQa;
}

function alignmentContext(job:FactoryJob){return {category:job.request.category,canDo:job.request.canDo,taskType:job.sourceContext?.objective||job.request.sourceGuidance?.objective||job.request.category};}
async function applyJftAlignmentQa(job:FactoryJob,candidate:FactoryCandidate){return runJftAlignmentGate(candidate,alignmentContext(job))}
const alignmentReviewBindingKey='reviewBindingFingerprint' as const;
type ReviewBoundAlignment=NonNullable<FactoryCandidate['jftAlignmentQa']>&{[alignmentReviewBindingKey]?:string};
function bindAlignmentReviewEvidence(value:NonNullable<FactoryCandidate['jftAlignmentQa']>,input:ReturnType<typeof buildJftAlignmentClassificationInput>,declared:ReturnType<typeof buildDeclaredAlignmentTarget>){
  if(value.verdict!=='REVIEW')return;
  const binding={
    learnerVisible:{questionId:input.questionId,instruction:input.instruction,stem:input.stem,choices:input.choices,audioScript:input.audioScript??null,visualEvidence:input.visualEvidence??null},
    declared,
    promptVersion:value.promptVersion,
    referenceVersion:input.referenceVersion,
    taxonomyVersion:input.taxonomyVersion,
  };
  (value as ReviewBoundAlignment)[alignmentReviewBindingKey]=createHash('sha256').update(JSON.stringify(binding)).digest('hex');
}
function alignmentReviewFingerprint(value:NonNullable<FactoryCandidate['jftAlignmentQa']>){const {checkedAt,...stable}=value as ReviewBoundAlignment;void checkedAt;return JSON.stringify(stable)}

export async function runDifficultyCalibrationGate(candidate:FactoryCandidate,context:{category?:string;performance?:QuestionPerformanceAggregate}={},provider:DifficultyCalibrationProvider=getDifficultyCalibrationProvider()){
  candidate.qa.issues=candidate.qa.issues.filter(issue=>!issue.code.startsWith('difficulty_calibration_'));
  const input=buildDifficultyCalibrationInput(candidate.question,{category:context.category,audioScript:candidate.audioScript,audioEvidence:candidate.audio?.status==='ready'?{available:true}:undefined});
  try{
    const analysis=validateDifficultyCalibrationAnalysis(await provider.estimate(input),input);
    candidate.difficultyCalibrationQa=withDifficultyCalibrationAudit(finalizeDifficultyCalibration(analysis,candidate.question.level,input,context.performance||emptyQuestionPerformance(candidate.question.id),candidate.question.id),{provider:provider.name,model:provider.model});
  }catch(error){
    const code=error instanceof DifficultyCalibrationError?error.code:'DIFFICULTY_CALIBRATION_PROVIDER_FAILURE';
    candidate.difficultyCalibrationQa=technicalDifficultyCalibrationResult(input,candidate.question.level,code,provider.name,provider.model,candidate.question.id);
  }
  bindDifficultyReviewEvidence(candidate.difficultyCalibrationQa,input,candidate.question.level);
  if(candidate.difficultyCalibrationQa.verdict==='FAIL'){
    candidate.qa.issues.push({code:'difficulty_calibration_fail',severity:'error',category:'pedagogy',message:`${candidate.difficultyCalibrationQa.promptVersion} FAIL: ${candidate.difficultyCalibrationQa.release.blockReason.join(', ')||candidate.difficultyCalibrationQa.levelMatch}.`});
    candidate.qa.passed=false;candidate.qa.score=Math.min(candidate.qa.score,50);
  }else if(candidate.difficultyCalibrationQa.verdict==='REVIEW'){
    candidate.qa.issues.push({code:'difficulty_calibration_review',severity:'warning',category:'pedagogy',message:`${candidate.difficultyCalibrationQa.promptVersion} requires human review (${candidate.difficultyCalibrationQa.declaredLevel} declared / ${candidate.difficultyCalibrationQa.estimatedLevel} estimated, score ${candidate.difficultyCalibrationQa.difficultyScore}).`});
    candidate.qa.score=Math.min(candidate.qa.score,85);
  }
  return candidate.difficultyCalibrationQa;
}
async function applyDifficultyCalibrationQa(job:FactoryJob,candidate:FactoryCandidate,performance:Map<string,QuestionPerformanceAggregate>){return runDifficultyCalibrationGate(candidate,{category:job.request.category,performance:performance.get(candidate.question.id)||emptyQuestionPerformance(candidate.question.id)})}

export async function runOriginalityDuplicateGate(candidate:FactoryCandidate,input:OriginalityDuplicateInput,provider:OriginalityDuplicateProvider=getOriginalityDuplicateProvider()){
  candidate.qa.issues=candidate.qa.issues.filter(issue=>!issue.code.startsWith('originality_duplicate_'));
  try{
    const analysis=validateOriginalityDuplicateAnalysis(await provider.analyze(input),input);
    candidate.originalityDuplicateQa=withOriginalityDuplicateAudit(finalizeOriginalityDuplicate(analysis,input,candidate.question.id),{provider:provider.name,model:provider.model});
  }catch(error){
    const code=error instanceof OriginalityDuplicateError?error.code:'ORIGINALITY_DUPLICATE_PROVIDER_FAILURE';
    candidate.originalityDuplicateQa=technicalOriginalityDuplicateResult(input,code,provider.name,provider.model,candidate.question.id);
  }
  bindOriginalityReviewEvidence(candidate.originalityDuplicateQa,input);
  if(candidate.originalityDuplicateQa.verdict==='FAIL'){
    candidate.qa.issues.push({code:'originality_duplicate_fail',severity:'error',category:'pedagogy',message:`${candidate.originalityDuplicateQa.promptVersion} FAIL: ${candidate.originalityDuplicateQa.release.blockReason.join(', ')||'source copy or duplicate confirmed'}.`});
    candidate.qa.passed=false;candidate.qa.score=Math.min(candidate.qa.score,45);
  }else if(candidate.originalityDuplicateQa.verdict==='REVIEW'){
    candidate.qa.issues.push({code:'originality_duplicate_review',severity:'warning',category:'pedagogy',message:`${candidate.originalityDuplicateQa.promptVersion} requires human review (source ${candidate.originalityDuplicateQa.summary.sourceCopyRisk}, batch ${candidate.originalityDuplicateQa.summary.batchDuplicateRisk}, bank ${candidate.originalityDuplicateQa.summary.bankDuplicateRisk}).`});
    candidate.qa.score=Math.min(candidate.qa.score,85);
  }
  return candidate.originalityDuplicateQa;
}
function comparisonText(value:FactoryCandidate){return `${value.question.instruction} ${value.question.prompt} ${value.question.choices.join(' ')} ${value.audioScript||''}`.trim()}
function originalityCorpus(job:FactoryJob,candidate:FactoryCandidate,existing:QuestionRecord[]):OriginalityCorpusItem[]{
  const source=(job.sourceContext?.sourceTexts||[]).map((text,index)=>({id:job.sourceContext?.sourceChunkIds[index]||`source-${index}`,kind:'SOURCE' as const,text}));
  const batch=job.candidates.filter(item=>item.id!==candidate.id).map(item=>({id:item.question.id,kind:'BATCH' as const,text:comparisonText(item)}));
  const bank=existing.map(item=>({id:item.id,kind:'BANK' as const,text:`${item.instruction} ${item.prompt} ${item.choices.join(' ')}`.trim()}));
  return [...source,...batch,...bank];
}
async function applyOriginalityDuplicateQa(job:FactoryJob,candidate:FactoryCandidate,existing:QuestionRecord[]){const input=buildOriginalityDuplicateInput(candidate.question,{audioScript:candidate.audioScript,sourceExpected:!!job.sourceContext,corpus:originalityCorpus(job,candidate,existing)});return runOriginalityDuplicateGate(candidate,input)}

async function applyContentQa(job:FactoryJob,candidate:FactoryCandidate,existing:QuestionRecord[]){
  candidate.qa.issues=candidate.qa.issues.filter(issue=>!issue.code.startsWith('content_qa_'));
  const ids=job.sourceContext?.knowledgeUnitIds||[job.sourceContext?.knowledgeUnitId].filter((id):id is string=>!!id);
  const units=job.sourceContext?await getRepository().listKnowledgeUnits(job.sourceContext.sourceDocumentId):[];
  const unit=units.find(item=>ids.includes(item.id));
  const candidateText=`${candidate.question.prompt} ${candidate.question.choices.join(' ')} ${candidate.audioScript||''}`;
  const sourceSimilarityScore=job.sourceContext?Math.max(0,...job.sourceContext.sourceTexts.map(text=>textSimilarity(candidateText,text))):undefined;
  const duplicateSimilarityScore=Math.max(0,...existing.map(question=>textSimilarity(candidate.question.prompt,question.prompt)),...job.candidates.filter(item=>item.id!==candidate.id).map(item=>textSimilarity(candidate.question.prompt,item.question.prompt)));
  const qaQuestion:QaQuestion={...candidate.question,category:job.request.category,canDo:job.request.canDo,knowledgeUnitIds:ids,sourceDocument:job.sourceContext?.sourceDocumentId,audioScript:candidate.audioScript};
  candidate.contentQa=contentQaJudge.judge(qaQuestion,{unit:unit?{id:unit.id,anchors:[...unit.vocabulary,...(unit.kanji||[]),...unit.grammar,...unit.expressions,...unit.keyKnowledge].filter(Boolean)}:undefined,audioAvailable:candidate.question.type!=='audio_choice'||candidate.audio?.status==='ready'&&!!candidate.question.audioSrc,sourceSimilarityScore,duplicateSimilarityScore});
  if(candidate.contentQa.verdict==='FAIL'){
    candidate.qa.issues.push({code:'content_qa_fail',severity:'error',category:'pedagogy',message:`${candidate.contentQa.qaVersion} FAIL: ${candidate.contentQa.release.blockReason.join(', ')||'score below release threshold'}.`});
    candidate.qa.passed=false;candidate.qa.score=Math.min(candidate.qa.score,candidate.contentQa.scores.total);
  }else if(candidate.contentQa.verdict==='REVIEW'){
    candidate.qa.issues.push({code:'content_qa_review',severity:'warning',category:'pedagogy',message:`${candidate.contentQa.qaVersion} requires explicit human review (${candidate.contentQa.scores.total}/100).`});
    candidate.qa.score=Math.min(candidate.qa.score,candidate.contentQa.scores.total);
  }
}

export function validateFactoryRequest(input:FactoryRequest){
  if(!input.topic?.trim()) throw new Error('topic is required');
  if(!['script_vocabulary','conversation_expression','listening','reading'].includes(input.section)) throw new Error('invalid section');
  if(!['A1','A2.1','A2.2'].includes(input.level)) throw new Error('invalid level');
  if(!Number.isInteger(input.count)||input.count<1||input.count>20) throw new Error('count must be 1..20');
  if(input.itemBlueprints&&input.itemBlueprints.length!==input.count)throw new Error('itemBlueprints must match count');
}

export async function runFactoryJob(job:FactoryJob):Promise<FactoryJob>{
  const repo=getRepository(); const provider=getFactoryProvider(); const semantic=getSemanticQaProvider();
  job.status='running'; job.updatedAt=new Date().toISOString(); await repo.saveFactoryJob(job);
  try{
    const candidates:FactoryCandidate[]=[];
    const generated=job.request.itemBlueprints
      ? await Promise.all(job.request.itemBlueprints.map((blueprint,index)=>generateBlueprintItem(blueprint,getBlueprintGenerationProvider(),{id:`AI-V2-${job.id.slice(0,8)}-${String(index+1).padStart(3,'0')}`})))
      : (await provider.generate(job.request)).map((draft,index)=>({question:{id:`AI-${job.request.section.toUpperCase().replaceAll('_','-')}-${job.id.slice(0,8)}-${String(index+1).padStart(3,'0')}`,section:job.request.section,type:job.request.section==='listening'?'audio_choice':'choice',level:job.request.level,instruction:draft.instruction,prompt:draft.prompt,choices:draft.choices,answer:draft.answer,explanationVi:job.request.includeExplanation?draft.explanationVi:'',audioSrc:undefined,tags:Array.from(new Set([...(draft.tags||[]),job.request.topic,job.request.canDo||''].filter(Boolean))),version:1,status:'review',source:'ai',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()} as QuestionRecord,audioScript:draft.audioScript,generation:{provider:provider.name,model:provider.model,promptVersion:'v5.1'},preflight:undefined}));
    for(const item of generated){
      const now=new Date().toISOString();const q=item.question;
      const bare:Omit<FactoryCandidate,'qa'>={id:crypto.randomUUID(),question:q,audioScript:job.request.generateAudioScript?item.audioScript:undefined,generation:{provider:item.generation.provider,model:item.generation.model,promptVersion:item.generation.promptVersion,architecture:'architecture' in item.generation?item.generation.architecture:undefined,blueprintId:'blueprint' in item?item.blueprint.id:undefined,createdAt:now},generatorPreflight:item.preflight,audio:q.type==='audio_choice'?{status:'pending'}:undefined};
      const semanticQa=await semantic.review(bare,job.request);
      const withSemantic={...bare,semanticQa};
      candidates.push({...withSemantic,qa:runFactoryQa(withSemantic)});
    }
    job.candidates=candidates;

    const existing=await repo.listQuestions();const curriculumCatalog=await loadCurriculumCatalog(repo,[job.sourceContext?.sourceDocumentId||'']);const performanceCatalog=await loadQuestionPerformanceCatalog(repo);
    for(const c of job.candidates){
      await applyContentQa(job,c,existing);
      await runAnswerOracleGate(c);
      await runJapaneseNaturalnessGate(c,{category:job.request.category,topic:job.request.topic,canDo:job.request.canDo});
      await applyCurriculumGroundingQa(job,c,curriculumCatalog);
      await applyJftAlignmentQa(job,c);
      await applyDifficultyCalibrationQa(job,c,performanceCatalog);
      await applyOriginalityDuplicateQa(job,c,existing);
    }
    job.status='review'; job.provider=provider.name; job.updatedAt=new Date().toISOString();
  }catch(e){ job.status='failed'; job.error=e instanceof Error?e.message:String(e); job.updatedAt=new Date().toISOString(); }
  return repo.saveFactoryJob(job);
}

export async function renderFactoryCandidateAudio(jobId:string,candidateId:string){
  const repo=getRepository(); const job=await repo.getFactoryJob(jobId); if(!job) throw new Error('Factory job not found');
  const c=job.candidates.find(x=>x.id===candidateId); if(!c) throw new Error('Factory candidate not found');
  if(c.question.type!=='audio_choice') throw new Error('Audio rendering is only available for listening candidates.');
  if(!c.audioScript?.trim()) throw new Error('Audio script is required before TTS rendering.');
  const tts=getTtsProvider(); c.audio={status:'pending',provider:tts.name,voice:tts.voice}; await repo.saveFactoryJob(job);
  try{
    const rendered=await tts.synthesize(c.audioScript); const stored=await persistGeneratedAudio(rendered,job.id,c.id); const now=new Date().toISOString();
    c.question.audioSrc=stored.src; c.question.updatedAt=now; c.audio={status:'ready',provider:rendered.provider,voice:rendered.voice,storage:stored.storage,renderedAt:now};
    const bare={id:c.id,question:c.question,audioScript:c.audioScript,generation:c.generation,semanticQa:c.semanticQa,audio:c.audio,approvedAt:c.approvedAt}; c.qa=runFactoryQa(bare);
    const existing=await repo.listQuestions();
    await applyContentQa(job,c,existing);
    await runAnswerOracleGate(c);
    await runJapaneseNaturalnessGate(c,{category:job.request.category,topic:job.request.topic,canDo:job.request.canDo});
    await applyCurriculumGroundingQa(job,c,await loadCurriculumCatalog(repo,[job.sourceContext?.sourceDocumentId||'']));
    await applyJftAlignmentQa(job,c);
    await applyDifficultyCalibrationQa(job,c,await loadQuestionPerformanceCatalog(repo));
    await applyOriginalityDuplicateQa(job,c,existing);
  }catch(e){c.audio={status:'failed',provider:tts.name,voice:tts.voice,error:e instanceof Error?e.message:String(e)}; throw e;}
  finally{job.updatedAt=new Date().toISOString();await repo.saveFactoryJob(job);}
  return {job,candidate:c};
}

export async function approveFactoryCandidates(jobId:string,candidateIds:string[]){
  const repo=getRepository(); const job=await repo.getFactoryJob(jobId); if(!job) throw new Error('Factory job not found');
  let approved=0; const now=new Date().toISOString(); const existingQuestions=await repo.listQuestions(); const existingIds=new Set(existingQuestions.map(q=>q.id));const curriculumCatalog=await loadCurriculumCatalog(repo,[job.sourceContext?.sourceDocumentId||'']);const performanceCatalog=await loadQuestionPerformanceCatalog(repo);
  for(const c of job.candidates){
    if(!candidateIds.includes(c.id) || c.approvedAt) continue;
    const bare={id:c.id,question:c.question,audioScript:c.audioScript,generation:c.generation,semanticQa:c.semanticQa,audio:c.audio,approvedAt:c.approvedAt}; c.qa=runFactoryQa(bare);
    await applyContentQa(job,c,existingQuestions);
    if(c.contentQa?.verdict==='FAIL'||c.contentQa?.hardFail)continue;
    await runAnswerOracleGate(c);
    if(c.answerOracleQa?.verdict==='FAIL'||c.answerOracleQa?.hardFail)continue;
    await runJapaneseNaturalnessGate(c,{category:job.request.category,topic:job.request.topic,canDo:job.request.canDo});
    if(c.japaneseNaturalnessQa?.verdict==='FAIL'||c.japaneseNaturalnessQa?.hardFail)continue;
    await applyCurriculumGroundingQa(job,c,curriculumCatalog);
    if(c.curriculumGroundingQa?.verdict==='FAIL'||c.curriculumGroundingQa?.hardFail)continue;
    const previouslyReviewedAlignment=c.jftAlignmentQa;
    await applyJftAlignmentQa(job,c);
    if(c.jftAlignmentQa?.verdict==='FAIL'||c.jftAlignmentQa?.hardFail)continue;
    if(c.jftAlignmentQa?.verdict==='REVIEW'&&(!previouslyReviewedAlignment||previouslyReviewedAlignment.verdict!=='REVIEW'||alignmentReviewFingerprint(previouslyReviewedAlignment)!==alignmentReviewFingerprint(c.jftAlignmentQa)))continue;
    const previouslyReviewedDifficulty=c.difficultyCalibrationQa;
    await applyDifficultyCalibrationQa(job,c,performanceCatalog);
    if(c.difficultyCalibrationQa?.verdict==='FAIL'||c.difficultyCalibrationQa?.hardFail)continue;
    if(c.difficultyCalibrationQa?.verdict==='REVIEW'&&(!previouslyReviewedDifficulty||previouslyReviewedDifficulty.verdict!=='REVIEW'||difficultyReviewFingerprint(previouslyReviewedDifficulty)!==difficultyReviewFingerprint(c.difficultyCalibrationQa)))continue;
    const previouslyReviewedOriginality=c.originalityDuplicateQa;
    await applyOriginalityDuplicateQa(job,c,existingQuestions);
    if(c.originalityDuplicateQa?.verdict==='FAIL'||c.originalityDuplicateQa?.hardFail)continue;
    if(c.originalityDuplicateQa?.verdict==='REVIEW'&&(!previouslyReviewedOriginality||previouslyReviewedOriginality.verdict!=='REVIEW'||originalityReviewFingerprint(previouslyReviewedOriginality)!==originalityReviewFingerprint(c.originalityDuplicateQa)))continue;
    if(hasQuestionIdCollision(existingQuestions,c.question.id) || existingIds.has(c.question.id)){
      c.qa.issues.push({code:'question_id_collision',severity:'error',category:'schema',message:`Question id ${c.question.id} already exists in Question Bank.`});
      c.qa.passed=false; c.qa.score=Math.max(0,c.qa.score-50); continue;
    }
    if(!c.qa.passed) continue;
    const finalQa=runQuestionQa(c.question); if(!finalQa.passed) continue;
    c.question.status='approved'; c.question.updatedAt=now; c.approvedAt=now; await repo.upsertQuestion(c.question); existingIds.add(c.question.id); approved++;
  }
  if(job.candidates.every(c=>c.approvedAt || !c.qa.passed)) job.status='completed';
  job.updatedAt=now; await repo.saveFactoryJob(job); return {job,approved};
}
