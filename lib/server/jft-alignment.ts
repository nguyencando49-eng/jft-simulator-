import type { QuestionRecord } from '@/lib/admin-types';
import type { SectionId } from '@/lib/types';
import { JFT_CATEGORIES, JFT_OFFICIAL_REFERENCE_VERSION, JFT_REFERENCE_RUBRIC, JFT_SIMULATOR_TAXONOMY_VERSION, isCategoryForSection, type JftCategory } from './content-taxonomy';

export const JFT_ALIGNMENT_PROMPT_VERSION='JFT_ALIGNMENT_V1' as const;
export const JFT_ALIGNMENT_REFERENCE_VERSION=JFT_OFFICIAL_REFERENCE_VERSION;
export const JFT_ALIGNMENT_TAXONOMY_VERSION=JFT_SIMULATOR_TAXONOMY_VERSION;

export const JFT_ALIGNMENT_SYSTEM_PROMPT_V1=`You are QA5, an independent JFT alignment classifier. Determine what learner ability the supplied learner-visible content actually requires. Do not solve the answer, judge Japanese naturalness, curriculum coverage, difficulty, or originality. Do not rewrite the item. You are deliberately blind to the declared section, category, Can-do, task objective, topic, answer key, explanation, generator reasoning, and all earlier QA evidence.

Classify from content only using the supplied canonical simulator taxonomy. Treat referenceRubric.supportedFacts as OFFICIAL_REFERENCE evidence and its limitations as binding; detailed operational boundaries remain SIMULATOR_DESIGN_DECISION. Do not claim complete reference evidence outside that rubric. Topic or location alone is never competency evidence. State the learner operation and direction explicitly in actualCanDo and actualTaskType: understanding/recognizing language is receptive, producing/giving language is productive, and participating in an exchange is interactive. Never collapse "understand instructions" and "give instructions" into the same competency. Listening requires answer-discriminating information from audio; Reading requires answer-discriminating information from a written passage or practical artifact. An isolated reading-of-kanji task is script_vocabulary/kanji_reading even if its topic is work or its instruction says to read. Classify a two-person station exchange by the interaction it measures, not by the station location. Classify a one-way public/shop announcement by its announcement task, not merely its location.

Return JSON only with exactly this analysis-only shape:
{"qaVersion":"JFT_ALIGNMENT_V1","questionId":"...","confidence":"HIGH|MEDIUM|LOW","independentAssessment":{"actualSection":"script_vocabulary|conversation_expression|listening|reading|UNDETERMINED","actualCategory":"word_meaning|word_usage|kanji_reading|kanji_meaning_usage|grammar|expression|conversation|shop_public|announcement_instruction|content_comprehension|information_search|UNDETERMINED","actualCanDo":"...","actualAssessmentTarget":"...","actualTaskType":"...","requiredModality":"TEXT|AUDIO|VISUAL|TEXT_AUDIO|TEXT_VISUAL|OTHER","communicativePurpose":"..."},"modalityDependency":"STRONG|MODERATE|WEAK|NONE","taskValidity":{"realWorldValidity":"AUTHENTIC|PLAUSIBLE|ARTIFICIAL|INVALID","constructUnderrepresented":false,"constructIrrelevantClues":[]},"classificationEvidence":{"section":"...","category":"...","canDo":"...","taskType":"...","modalityDependency":"..."},"uncertainty":{"referenceEvidenceComplete":true,"categoryCertain":true,"multiplePlausibleCategories":[]}}.

Use UNDETERMINED instead of inventing evidence. Every evidence string and assessment description must be concise and non-empty. multiplePlausibleCategories may contain only canonical category IDs. Do not include declared metadata, verdict, scores, issues, release policy, an answer, an explanation, or replacement content.`;

export type JftAlignmentConfidence='HIGH'|'MEDIUM'|'LOW';
export type JftAlignmentRequiredModality='TEXT'|'AUDIO'|'VISUAL'|'TEXT_AUDIO'|'TEXT_VISUAL'|'OTHER';
export type JftAlignmentDependency='STRONG'|'MODERATE'|'WEAK'|'NONE';
export type JftAlignmentRealWorldValidity='AUTHENTIC'|'PLAUSIBLE'|'ARTIFICIAL'|'INVALID';
export type JftAlignmentSection=SectionId|'UNDETERMINED';
export type JftAlignmentCategory=JftCategory|'UNDETERMINED';
export type JftAlignmentState='STRONG_MATCH'|'PARTIAL_MATCH'|'MISMATCH'|'INSUFFICIENT_EVIDENCE';
export type JftAlignmentCanDoState=JftAlignmentState|'WEAK_MATCH';
export type JftAlignmentSeverity='INFO'|'WARNING'|'MAJOR'|'CRITICAL';
export type JftAlignmentIssueCode=
  'SECTION_MISMATCH_CRITICAL'|'CATEGORY_MISMATCH_CRITICAL'|'LISTENING_NOT_REQUIRED'|'READING_NOT_REQUIRED'|
  'CAN_DO_MISMATCH_CRITICAL'|'INVALID_ASSESSMENT_TARGET'|'QUESTION_DOES_NOT_MEASURE_DECLARED_SKILL'|
  'TASK_TYPE_MISMATCH'|'TASK_TYPE_PARTIAL_MATCH'|'TASK_TYPE_EVIDENCE_INCOMPLETE'|
  'PARTIAL_CAN_DO_MATCH'|'WEAK_CAN_DO_MATCH'|'WEAK_MODALITY_DEPENDENCY'|'LISTENING_DEPENDENCY_WEAK'|
  'READING_DEPENDENCY_WEAK'|'REFERENCE_EVIDENCE_INCOMPLETE'|'UNCERTAIN_CATEGORY'|'MULTIPLE_PLAUSIBLE_CATEGORIES'|
  'CONSTRUCT_UNDERREPRESENTED'|'CONSTRUCT_IRRELEVANT_CLUE'|'ALIGNMENT_UNASSESSABLE_MISSING_VISUAL'|
  'DECLARED_CATEGORY_MISSING'|'DECLARED_CATEGORY_INVALID'|'DECLARED_CAN_DO_MISSING'|'DECLARED_TASK_TYPE_MISSING'|
  'LOW_CONFIDENCE'|'JFT_ALIGNMENT_INVALID_OUTPUT'|'JFT_ALIGNMENT_PROVIDER_FAILURE';

export interface JftAlignmentClassificationInput {
  questionId:string;
  instruction:string;
  stem:string;
  choices:string[];
  audioScript?:string;
  visualEvidence?:{present:boolean;description?:string};
  referenceVersion:typeof JFT_ALIGNMENT_REFERENCE_VERSION;
  taxonomyVersion:typeof JFT_ALIGNMENT_TAXONOMY_VERSION;
  referenceRubric:typeof JFT_REFERENCE_RUBRIC;
  taxonomy:Record<SectionId,readonly string[]>;
}

export interface DeclaredAlignmentTarget {
  section:SectionId;
  category:string;
  canDo:string;
  taskType:string;
}

export interface JftAlignmentIndependentAssessment {
  actualSection:JftAlignmentSection;
  actualCategory:JftAlignmentCategory;
  actualCanDo:string;
  actualAssessmentTarget:string;
  actualTaskType:string;
  requiredModality:JftAlignmentRequiredModality;
  communicativePurpose:string;
}

export interface JftAlignmentAnalysis {
  qaVersion:typeof JFT_ALIGNMENT_PROMPT_VERSION;
  questionId:string;
  confidence:JftAlignmentConfidence;
  independentAssessment:JftAlignmentIndependentAssessment;
  modalityDependency:JftAlignmentDependency;
  taskValidity:{realWorldValidity:JftAlignmentRealWorldValidity;constructUnderrepresented:boolean;constructIrrelevantClues:string[]};
  classificationEvidence:{section:string;category:string;canDo:string;taskType:string;modalityDependency:string};
  uncertainty:{referenceEvidenceComplete:boolean;categoryCertain:boolean;multiplePlausibleCategories:JftCategory[]};
}

export interface JftAlignmentIssue {code:JftAlignmentIssueCode;severity:JftAlignmentSeverity;evidence:string;reason:string;suggestedAction:string}
export interface JftAlignmentScores {sectionAlignment:number;categoryAlignment:number;canDoAlignment:number;taskValidity:number;modalityDependency:number;communicativeAuthenticity:number;metadataConsistency:number;total:number}
export interface JftAlignmentResult {
  qaVersion:typeof JFT_ALIGNMENT_PROMPT_VERSION;
  questionId:string;
  verdict:'PASS'|'REVIEW'|'FAIL';
  hardFail:boolean;
  confidence:JftAlignmentConfidence;
  declared:DeclaredAlignmentTarget;
  independentAssessment:JftAlignmentIndependentAssessment;
  alignment:{section:JftAlignmentState;category:JftAlignmentState;canDo:JftAlignmentCanDoState;taskType:JftAlignmentState;modalityDependency:JftAlignmentDependency};
  taskValidity:JftAlignmentAnalysis['taskValidity'];
  scores:JftAlignmentScores;
  issues:JftAlignmentIssue[];
  release:{eligibleToProceed:boolean;requiresHumanReview:boolean;blockReason:JftAlignmentIssueCode[]};
}
export interface JftAlignmentGateResult extends JftAlignmentResult {
  provider:string;
  model?:string;
  promptVersion:typeof JFT_ALIGNMENT_PROMPT_VERSION;
  referenceVersion:typeof JFT_ALIGNMENT_REFERENCE_VERSION;
  taxonomyVersion:typeof JFT_ALIGNMENT_TAXONOMY_VERSION;
  checkedAt:string;
}

export interface JftAlignmentMetrics {
  alignmentSampleCount:number;
  alignmentEvaluableSampleCount:number;
  alignmentTechnicalReviewCount:number;
  listeningAlignmentSampleCount:number;
  readingAlignmentSampleCount:number;
  sectionMismatchRate:number|null;
  categoryMismatchRate:number|null;
  canDoMismatchRate:number|null;
  listeningDependencyFailureRate:number|null;
  readingDependencyFailureRate:number|null;
  constructUnderrepresentationRate:number|null;
  alignmentReviewRate:number|null;
}

export function summarizeJftAlignmentMetrics(results:JftAlignmentGateResult[]):JftAlignmentMetrics {
  const isTechnical=(result:JftAlignmentGateResult)=>result.issues.some(issue=>issue.code==='JFT_ALIGNMENT_INVALID_OUTPUT'||issue.code==='JFT_ALIGNMENT_PROVIDER_FAILURE');
  const evaluable=results.filter(result=>!isTechnical(result)),listening=evaluable.filter(result=>result.declared.section==='listening'),reading=evaluable.filter(result=>result.declared.section==='reading');
  const rate=(count:number,total:number)=>total?count/total:null;
  return {
    alignmentSampleCount:results.length,
    alignmentEvaluableSampleCount:evaluable.length,
    alignmentTechnicalReviewCount:results.length-evaluable.length,
    listeningAlignmentSampleCount:listening.length,
    readingAlignmentSampleCount:reading.length,
    sectionMismatchRate:rate(evaluable.filter(result=>result.alignment.section==='MISMATCH').length,evaluable.length),
    categoryMismatchRate:rate(evaluable.filter(result=>result.alignment.category==='MISMATCH').length,evaluable.length),
    canDoMismatchRate:rate(evaluable.filter(result=>result.alignment.canDo==='MISMATCH').length,evaluable.length),
    listeningDependencyFailureRate:rate(listening.filter(result=>result.alignment.modalityDependency==='NONE').length,listening.length),
    readingDependencyFailureRate:rate(reading.filter(result=>result.alignment.modalityDependency==='NONE').length,reading.length),
    constructUnderrepresentationRate:rate(evaluable.filter(result=>result.taskValidity.constructUnderrepresented).length,evaluable.length),
    alignmentReviewRate:rate(results.filter(result=>result.verdict==='REVIEW').length,results.length),
  };
}

export class JftAlignmentError extends Error {
  constructor(public readonly code:'JFT_ALIGNMENT_INVALID_OUTPUT'|'JFT_ALIGNMENT_PROVIDER_FAILURE',message:string){super(message);this.name='JftAlignmentError'}
}

const sections=new Set<SectionId>(['script_vocabulary','conversation_expression','listening','reading']);
const categories=new Set<JftCategory>(Object.values(JFT_CATEGORIES).flat() as JftCategory[]);
const confidences=new Set<JftAlignmentConfidence>(['HIGH','MEDIUM','LOW']);
const modalities=new Set<JftAlignmentRequiredModality>(['TEXT','AUDIO','VISUAL','TEXT_AUDIO','TEXT_VISUAL','OTHER']);
const dependencies=new Set<JftAlignmentDependency>(['STRONG','MODERATE','WEAK','NONE']);
const validities=new Set<JftAlignmentRealWorldValidity>(['AUTHENTIC','PLAUSIBLE','ARTIFICIAL','INVALID']);

function exactKeys(value:Record<string,unknown>,allowed:readonly string[],label:string,fail:(message:string)=>never){
  const keys=Object.keys(value);if(keys.some(key=>!allowed.includes(key))||allowed.some(key=>!(key in value)))fail(`${label} has an invalid shape.`);
}
function boundedString(value:unknown,label:string,fail:(message:string)=>never,max=600){if(typeof value!=='string'||!value.trim()||value.length>max)fail(`${label} must be a non-empty bounded string.`);return value.trim()}

export function buildJftAlignmentClassificationInput(question:QuestionRecord,audioScript?:string,visualEvidence?:JftAlignmentClassificationInput['visualEvidence']):JftAlignmentClassificationInput {
  return {
    questionId:opaqueRequestId(question.id),
    instruction:question.instruction,
    stem:question.prompt,
    choices:[...question.choices],
    ...(audioScript?.trim()?{audioScript:audioScript.trim()}:{}),
    ...(visualEvidence?{visualEvidence:{present:visualEvidence.present,...(visualEvidence.description?.trim()?{description:visualEvidence.description.trim()}: {})}}:{}),
    referenceVersion:JFT_ALIGNMENT_REFERENCE_VERSION,
    taxonomyVersion:JFT_ALIGNMENT_TAXONOMY_VERSION,
    referenceRubric:JFT_REFERENCE_RUBRIC,
    taxonomy:JFT_CATEGORIES,
  };
}

function opaqueRequestId(questionId:string){let hash=2166136261;for(let index=0;index<questionId.length;index++){hash^=questionId.charCodeAt(index);hash=Math.imul(hash,16777619)}return `QA5-${(hash>>>0).toString(16).padStart(8,'0')}`}

export function buildDeclaredAlignmentTarget(question:QuestionRecord,context:{category?:string;canDo?:string;taskType?:string}={}):DeclaredAlignmentTarget {
  return {section:question.section,category:context.category?.trim()||'',canDo:context.canDo?.trim()||'',taskType:context.taskType?.trim()||''};
}

export function validateJftAlignmentAnalysis(value:unknown,input:JftAlignmentClassificationInput):JftAlignmentAnalysis {
  const fail=(message:string):never=>{throw new JftAlignmentError('JFT_ALIGNMENT_INVALID_OUTPUT',message)};
  if(!value||typeof value!=='object'||Array.isArray(value))fail('Alignment analysis must be an object.');
  const root=value as Record<string,unknown>;
  exactKeys(root,['qaVersion','questionId','confidence','independentAssessment','modalityDependency','taskValidity','classificationEvidence','uncertainty'],'analysis',fail);
  if(root.qaVersion!==JFT_ALIGNMENT_PROMPT_VERSION||root.questionId!==input.questionId||!confidences.has(root.confidence as JftAlignmentConfidence)||!dependencies.has(root.modalityDependency as JftAlignmentDependency))fail('Alignment analysis header is invalid.');

  if(!root.independentAssessment||typeof root.independentAssessment!=='object'||Array.isArray(root.independentAssessment))fail('independentAssessment is invalid.');
  const assessment=root.independentAssessment as Record<string,unknown>;
  exactKeys(assessment,['actualSection','actualCategory','actualCanDo','actualAssessmentTarget','actualTaskType','requiredModality','communicativePurpose'],'independentAssessment',fail);
  const actualSection=assessment.actualSection as JftAlignmentSection,actualCategory=assessment.actualCategory as JftAlignmentCategory;
  if(actualSection!=='UNDETERMINED'&&!sections.has(actualSection)||actualCategory!=='UNDETERMINED'&&!categories.has(actualCategory)||!modalities.has(assessment.requiredModality as JftAlignmentRequiredModality))fail('Independent classification enums are invalid.');
  if(actualSection==='UNDETERMINED'&&actualCategory!=='UNDETERMINED')fail('An undetermined section cannot have a determined category.');
  if(actualSection!=='UNDETERMINED'&&actualCategory!=='UNDETERMINED'&&!isCategoryForSection(actualSection,actualCategory))fail('Actual category does not belong to actual section.');
  const independentAssessment:JftAlignmentIndependentAssessment={actualSection,actualCategory,actualCanDo:boundedString(assessment.actualCanDo,'actualCanDo',fail),actualAssessmentTarget:boundedString(assessment.actualAssessmentTarget,'actualAssessmentTarget',fail),actualTaskType:boundedString(assessment.actualTaskType,'actualTaskType',fail),requiredModality:assessment.requiredModality as JftAlignmentRequiredModality,communicativePurpose:boundedString(assessment.communicativePurpose,'communicativePurpose',fail)};

  if(!root.taskValidity||typeof root.taskValidity!=='object'||Array.isArray(root.taskValidity))fail('taskValidity is invalid.');
  const validity=root.taskValidity as Record<string,unknown>;
  exactKeys(validity,['realWorldValidity','constructUnderrepresented','constructIrrelevantClues'],'taskValidity',fail);
  if(!validities.has(validity.realWorldValidity as JftAlignmentRealWorldValidity)||typeof validity.constructUnderrepresented!=='boolean'||!Array.isArray(validity.constructIrrelevantClues))fail('taskValidity values are invalid.');
  const clues=(validity.constructIrrelevantClues as unknown[]).map((clue,index)=>boundedString(clue,`constructIrrelevantClues[${index}]`,fail,300));
  if(clues.length>12||new Set(clues).size!==clues.length)fail('Construct-irrelevant clues must be unique and bounded.');

  if(!root.classificationEvidence||typeof root.classificationEvidence!=='object'||Array.isArray(root.classificationEvidence))fail('classificationEvidence is invalid.');
  const rawEvidence=root.classificationEvidence as Record<string,unknown>;
  exactKeys(rawEvidence,['section','category','canDo','taskType','modalityDependency'],'classificationEvidence',fail);
  const classificationEvidence={section:boundedString(rawEvidence.section,'classificationEvidence.section',fail),category:boundedString(rawEvidence.category,'classificationEvidence.category',fail),canDo:boundedString(rawEvidence.canDo,'classificationEvidence.canDo',fail),taskType:boundedString(rawEvidence.taskType,'classificationEvidence.taskType',fail),modalityDependency:boundedString(rawEvidence.modalityDependency,'classificationEvidence.modalityDependency',fail)};

  if(!root.uncertainty||typeof root.uncertainty!=='object'||Array.isArray(root.uncertainty))fail('uncertainty is invalid.');
  const uncertainty=root.uncertainty as Record<string,unknown>;
  exactKeys(uncertainty,['referenceEvidenceComplete','categoryCertain','multiplePlausibleCategories'],'uncertainty',fail);
  if(typeof uncertainty.referenceEvidenceComplete!=='boolean'||typeof uncertainty.categoryCertain!=='boolean'||!Array.isArray(uncertainty.multiplePlausibleCategories))fail('uncertainty values are invalid.');
  const multiple=(uncertainty.multiplePlausibleCategories as unknown[]).map(value=>{if(typeof value!=='string'||!categories.has(value as JftCategory))return fail('multiplePlausibleCategories contains an invalid category.');return value as JftCategory});
  if(new Set(multiple).size!==multiple.length||multiple.length>6||uncertainty.categoryCertain===true&&multiple.length)fail('Category uncertainty is inconsistent.');
  if(root.confidence==='HIGH'&&actualSection==='UNDETERMINED')fail('HIGH confidence cannot accompany an undetermined section.');
  const requiredModality=independentAssessment.requiredModality;
  if((requiredModality==='AUDIO'||requiredModality==='TEXT_AUDIO')&&!input.audioScript?.trim()&&(root.modalityDependency==='STRONG'||root.modalityDependency==='MODERATE'))fail('Strong audio dependency requires supplied audio-script evidence.');
  if(actualSection==='listening'&&requiredModality!=='AUDIO'&&requiredModality!=='TEXT_AUDIO')fail('A Listening classification must require audio.');
  if(actualSection==='listening'&&root.modalityDependency==='NONE')fail('A Listening classification cannot have no audio dependency.');
  // Canonical QA5 sections are single-primary-modality constructs: any item
  // requiring answer-discriminating audio is Listening, including TEXT_AUDIO.
  // Reading may combine text with a visual, but not with required audio.
  if(actualSection==='reading'&&!['TEXT','TEXT_VISUAL'].includes(requiredModality))fail('A Reading classification cannot require answer-discriminating audio.');
  if((requiredModality==='AUDIO'||requiredModality==='TEXT_AUDIO')&&actualSection!=='listening')fail('Audio-dependent assessment must be classified in Listening.');

  return {qaVersion:JFT_ALIGNMENT_PROMPT_VERSION,questionId:input.questionId,confidence:root.confidence as JftAlignmentConfidence,independentAssessment,modalityDependency:root.modalityDependency as JftAlignmentDependency,taskValidity:{realWorldValidity:validity.realWorldValidity as JftAlignmentRealWorldValidity,constructUnderrepresented:validity.constructUnderrepresented as boolean,constructIrrelevantClues:clues},classificationEvidence,uncertainty:{referenceEvidenceComplete:uncertainty.referenceEvidenceComplete as boolean,categoryCertain:uncertainty.categoryCertain as boolean,multiplePlausibleCategories:multiple}};
}

function semanticText(value:string){return value.normalize('NFKC').toLocaleLowerCase().replace(/[\p{P}\p{S}_]+/gu,' ').replace(/\s+/g,' ').trim()}
function normalizedText(value:string){return semanticText(value).replace(/\s+/g,'')}
function wordTokens(value:string){return new Set((semanticText(value).match(/[a-z0-9]+|[\u3040-\u30ff\u3400-\u9fff]{1,4}/gu)||[]).filter(token=>token.length>1))}
function overlap(a:string,b:string){const x=wordTokens(a),y=wordTokens(b);if(!x.size||!y.size)return 0;let shared=0;for(const token of x)if(y.has(token))shared++;return shared/Math.max(x.size,y.size)}

type CompetencyFunction=
  'SOCIAL_GREETING'|'PERMISSION'|'APOLOGY'|'CONFIRMATION'|'REQUEST'|'KANJI_READING'|
  'INFORMATION_SEARCH'|'INSTRUCTION'|'LISTENING_COMPREHENSION'|'EXPRESSION_RESPONSE'|'GRAMMAR'|
  'WORD_MEANING'|'WORD_USAGE'|'READING_COMPREHENSION'|'SHOPPING'|'';
type CompetencyDirection='RECEPTIVE'|'PRODUCTIVE'|'INTERACTIVE'|'UNSPECIFIED';
type CompetencyOperation='LOCATE'|'SELECT'|'RECOGNIZE'|'COMPREHEND'|'PRODUCE'|'INTERACT'|'UNSPECIFIED';
type CompetencyModality='LISTENING'|'READING'|'SPEAKING'|'WRITING'|'LANGUAGE_FORM'|'UNSPECIFIED';
interface CompetencyDimensions {function:CompetencyFunction;direction:CompetencyDirection;operation:CompetencyOperation;modality:CompetencyModality}

function competencyFunction(compact:string):CompetencyFunction {
  if(/kanjireading|kanjipronunciation|pronunciation.*kanji|reading.*kanji|kanji.*reading|漢字.*読|読み方|よみかた/.test(compact))return 'KANJI_READING';
  if(/informationsearch|informationretriev|locate|openinghours|closingtime|schedule|timetable|営業時間|開店時刻|閉店時刻|時間.*(探|見つ)|予定表|時刻表|何時|情報.*(探|見つ)/.test(compact))return 'INFORMATION_SEARCH';
  if(/appropriat(?:e)?(?:expression|response)|responseselection|select.*response|choose.*response|correctresponse|正しい.*(返答|返事|応答)|適切.*(表現|返答|返事|応答)|(返答|返事|応答).*選|表現.*選|expression|response/.test(compact))return 'EXPRESSION_RESPONSE';
  if(/greeting|socialgreeting|挨拶|あいさつ|おはよう|こんにちは/.test(compact))return 'SOCIAL_GREETING';
  if(/permission|許可|てもいい|てもよい/.test(compact))return 'PERMISSION';
  if(/apolog|謝罪|あやま|すみません|申し訳/.test(compact))return 'APOLOGY';
  if(/confirmation|confirm|確認/.test(compact))return 'CONFIRMATION';
  if(/request|依頼|お願い|てください/.test(compact))return 'REQUEST';
  if(/instruction|direction|announcement|指示|案内|放送/.test(compact))return 'INSTRUCTION';
  if(/listen|audio|spoken|聞.*(理解|取)|聴/.test(compact))return 'LISTENING_COMPREHENSION';
  if(/grammar|grammatical|particle|文法|助詞|活用/.test(compact))return 'GRAMMAR';
  if(/wordusage|vocabularyusage|使い方|語の使用/.test(compact))return 'WORD_USAGE';
  if(/wordmeaning|vocabulary|意味|語彙|単語/.test(compact))return 'WORD_MEANING';
  if(/readingcomprehension|writtencontent|writtentext|文章|文を読|読んで|読む|読解/.test(compact))return 'READING_COMPREHENSION';
  if(/price|shopping|値段|いくら|買い物/.test(compact))return 'SHOPPING';
  return '';
}

function competencyDimensions(value:string):CompetencyDimensions {
  const text=semanticText(value),compact=text.replace(/\s+/g,'');
  const selection=/\b(?:select|choose|identify|recognize|locate|find|match)\b/u.test(text)||/(選ぶ|選べ|選択|探す|探せ|見つけ|識別|認識)/u.test(text);
  const locating=/\b(?:locate|find|search|retrieve)\b/u.test(text)||/(探す|探せ|見つけ|検索)/u.test(text);
  const interactive=/\b(?:interact|conversation|converse|exchange|ask and answer)\b/u.test(text)||/(やりとり|会話でき|受け答え)/u.test(text);
  const productive=/\b(?:give|provide|produce|say|speak|write|tell|issue|deliver|formulate|compose|instruct|respond|answer)\b/u.test(text)||/(指示を(?:出す?|する)|指示でき|伝え|言う|話す|書く|説明する|依頼する|返答する|応答する|答える)/u.test(text);
  const receptive=/\b(?:understand|comprehend|listen|hear|read|follow|interpret|recognize|locate|find|select|choose|identify|match)\b/u.test(text)||/(理解|分か|聞き取|聞く|聴く|読み取|読む|読め|従う|探す|探せ|見つけ|選ぶ|選べ|選択|識別|認識)/u.test(text);
  const direction:CompetencyDirection=selection?'RECEPTIVE':interactive?'INTERACTIVE':productive?'PRODUCTIVE':receptive?'RECEPTIVE':'UNSPECIFIED';
  const operation:CompetencyOperation=locating?'LOCATE':selection?'SELECT':interactive?'INTERACT':productive?'PRODUCE':receptive?/recognize|識別|認識/u.test(text)?'RECOGNIZE':'COMPREHEND':'UNSPECIFIED';
  const modality:CompetencyModality=/\b(?:listen|audio|spoken|hear)\b/u.test(text)||/(聞き取|聞く|聴く|音声)/u.test(text)?'LISTENING':/\b(?:read|reading|written|text|notice|schedule)\b/u.test(text)||/(読み取|読む|読め|文章|書かれ)/u.test(text)?'READING':/\b(?:speak|say)\b/u.test(text)||/(話す|言う)/u.test(text)?'SPEAKING':/\b(?:write|writing)\b/u.test(text)||/書く/u.test(text)?'WRITING':/(kanji|grammar|particle|vocabulary|漢字|文法|助詞|語彙)/u.test(text)?'LANGUAGE_FORM':'UNSPECIFIED';
  return {function:competencyFunction(compact),direction,operation,modality};
}

function operationAlignment(left:CompetencyOperation,right:CompetencyOperation):'STRONG_MATCH'|'PARTIAL_MATCH'|'MISMATCH' {
  if(left===right)return left==='UNSPECIFIED'?'PARTIAL_MATCH':'STRONG_MATCH';
  if(left==='UNSPECIFIED'||right==='UNSPECIFIED')return 'PARTIAL_MATCH';
  const pair=`${left}:${right}`;
  const receptiveEquivalents=new Set(['SELECT:RECOGNIZE','RECOGNIZE:SELECT','SELECT:COMPREHEND','COMPREHEND:SELECT','RECOGNIZE:COMPREHEND','COMPREHEND:RECOGNIZE','LOCATE:SELECT','SELECT:LOCATE','LOCATE:RECOGNIZE','RECOGNIZE:LOCATE']);
  if(receptiveEquivalents.has(pair))return 'STRONG_MATCH';
  if(pair==='LOCATE:COMPREHEND'||pair==='COMPREHEND:LOCATE')return 'PARTIAL_MATCH';
  if(left==='PRODUCE'||right==='PRODUCE')return 'MISMATCH';
  if(left==='INTERACT'||right==='INTERACT')return 'PARTIAL_MATCH';
  return 'PARTIAL_MATCH';
}

function semanticAlignment(declared:string,actual:string,allowWeak=true):JftAlignmentCanDoState {
  if(!declared.trim()||!actual.trim()||actual==='UNDETERMINED')return 'INSUFFICIENT_EVIDENCE';
  const leftDimensions=competencyDimensions(declared),rightDimensions=competencyDimensions(actual);
  const directionsConflict=leftDimensions.direction!=='UNSPECIFIED'&&rightDimensions.direction!=='UNSPECIFIED'&&leftDimensions.direction!==rightDimensions.direction;
  if(directionsConflict){
    if(leftDimensions.direction==='INTERACTIVE'||rightDimensions.direction==='INTERACTIVE')return 'PARTIAL_MATCH';
    return 'MISMATCH';
  }
  const modalitiesConflict=leftDimensions.modality!=='UNSPECIFIED'&&rightDimensions.modality!=='UNSPECIFIED'&&leftDimensions.modality!==rightDimensions.modality&&leftDimensions.modality!=='LANGUAGE_FORM'&&rightDimensions.modality!=='LANGUAGE_FORM';
  if(modalitiesConflict)return 'MISMATCH';

  const left=normalizedText(declared),right=normalizedText(actual);
  if(left===right)return 'STRONG_MATCH';
  const directionIncomplete=(leftDimensions.direction==='UNSPECIFIED')!==(rightDimensions.direction==='UNSPECIFIED');
  const operationIncomplete=(leftDimensions.operation==='UNSPECIFIED')!==(rightDimensions.operation==='UNSPECIFIED');
  if(left.includes(right)||right.includes(left))return directionIncomplete||operationIncomplete?'PARTIAL_MATCH':'STRONG_MATCH';
  if(leftDimensions.function&&rightDimensions.function){
    if(leftDimensions.function===rightDimensions.function){
      if(directionIncomplete||operationIncomplete)return 'PARTIAL_MATCH';
      return operationAlignment(leftDimensions.operation,rightDimensions.operation);
    }
    const compatible=new Set([
      'INFORMATION_SEARCH:READING_COMPREHENSION','READING_COMPREHENSION:INFORMATION_SEARCH',
      'INSTRUCTION:LISTENING_COMPREHENSION','LISTENING_COMPREHENSION:INSTRUCTION',
      'EXPRESSION_RESPONSE:REQUEST','REQUEST:EXPRESSION_RESPONSE',
      'EXPRESSION_RESPONSE:PERMISSION','PERMISSION:EXPRESSION_RESPONSE',
      'EXPRESSION_RESPONSE:APOLOGY','APOLOGY:EXPRESSION_RESPONSE',
      'EXPRESSION_RESPONSE:CONFIRMATION','CONFIRMATION:EXPRESSION_RESPONSE',
      'EXPRESSION_RESPONSE:SOCIAL_GREETING','SOCIAL_GREETING:EXPRESSION_RESPONSE',
    ]);
    if(compatible.has(`${leftDimensions.function}:${rightDimensions.function}`))return 'PARTIAL_MATCH';
    return 'MISMATCH';
  }
  const score=overlap(declared,actual);if(score>=.55)return 'STRONG_MATCH';if(score>=.28)return 'PARTIAL_MATCH';if(allowWeak&&score>=.12)return 'WEAK_MATCH';
  return 'INSUFFICIENT_EVIDENCE';
}
function issue(code:JftAlignmentIssueCode,severity:JftAlignmentSeverity,evidence:string,reason:string):JftAlignmentIssue{return {code,severity,evidence,reason,suggestedAction:'Review the declared assessment target or revise the item before another QA run.'}}
function alignmentScore(value:JftAlignmentState|JftAlignmentCanDoState,max:number){return value==='STRONG_MATCH'?max:value==='PARTIAL_MATCH'?Math.round(max*.7):value==='WEAK_MATCH'?Math.round(max*.4):value==='INSUFFICIENT_EVIDENCE'?Math.round(max*.4):0}

export function finalizeJftAlignment(analysis:JftAlignmentAnalysis,declared:DeclaredAlignmentTarget,input:JftAlignmentClassificationInput,persistedQuestionId=input.questionId):JftAlignmentResult {
  const actual=analysis.independentAssessment;
  const declaredCategoryValid=!!declared.category&&isCategoryForSection(declared.section,declared.category);
  const sectionAlignment:JftAlignmentState=actual.actualSection==='UNDETERMINED'?'INSUFFICIENT_EVIDENCE':actual.actualSection===declared.section?'STRONG_MATCH':'MISMATCH';
  const categoryAlignment:JftAlignmentState=!declared.category||!declaredCategoryValid||actual.actualCategory==='UNDETERMINED'?'INSUFFICIENT_EVIDENCE':actual.actualCategory===declared.category?'STRONG_MATCH':'MISMATCH';
  const canDoAlignment=semanticAlignment(declared.canDo,actual.actualCanDo);
  const taskTypeAlignment=semanticAlignment(declared.taskType,actual.actualTaskType,false) as JftAlignmentState;
  const issues:JftAlignmentIssue[]=[];const add=(entry:JftAlignmentIssue)=>{if(!issues.some(current=>current.code===entry.code&&current.evidence===entry.evidence))issues.push(entry)};
  const decisive=analysis.confidence==='HIGH';

  if(!declared.category)add(issue('DECLARED_CATEGORY_MISSING','WARNING','No declared category was supplied.','Category alignment cannot be certified without canonical declared metadata.'));
  else if(!declaredCategoryValid)add(issue('DECLARED_CATEGORY_INVALID','MAJOR',`${declared.section}/${declared.category}`,'The declared category does not belong to the canonical declared section.'));
  if(!declared.canDo)add(issue('DECLARED_CAN_DO_MISSING','WARNING','No declared Can-do was supplied.','Semantic Can-do alignment cannot be assessed.'));
  if(!declared.taskType)add(issue('DECLARED_TASK_TYPE_MISSING','WARNING','No declared task purpose was supplied.','The repository has no first-class taskType and no objective was available.'));
  if(!analysis.uncertainty.referenceEvidenceComplete)add(issue('REFERENCE_EVIDENCE_INCOMPLETE','WARNING',input.referenceVersion,'The repository reference does not fully resolve this alignment boundary.'));
  if(!analysis.uncertainty.categoryCertain)add(issue('UNCERTAIN_CATEGORY','WARNING',analysis.classificationEvidence.category,'The independent classifier could not select one category confidently.'));
  if(analysis.uncertainty.multiplePlausibleCategories.length)add(issue('MULTIPLE_PLAUSIBLE_CATEGORIES','WARNING',analysis.uncertainty.multiplePlausibleCategories.join(', '),'Multiple canonical categories remain defensible.'));
  if(analysis.confidence==='LOW')add(issue('LOW_CONFIDENCE','WARNING','Independent classifier confidence is LOW.','Low-confidence alignment evidence cannot pass automatically.'));

  if(sectionAlignment==='MISMATCH')add(issue('SECTION_MISMATCH_CRITICAL',decisive?'CRITICAL':'MAJOR',`${declared.section} -> ${actual.actualSection}`,`The learner must use ${actual.actualSection}, not the declared section.`));
  if(categoryAlignment==='MISMATCH')add(issue('CATEGORY_MISMATCH_CRITICAL',decisive?'CRITICAL':'MAJOR',`${declared.category} -> ${actual.actualCategory}`,`The item measures ${actual.actualCategory}, not the declared category.`));
  if(canDoAlignment==='MISMATCH')add(issue('CAN_DO_MISMATCH_CRITICAL',decisive?'CRITICAL':'MAJOR',`${declared.canDo} -> ${actual.actualCanDo}`,'Topic overlap does not establish the declared competency.'));
  else if(canDoAlignment==='PARTIAL_MATCH')add(issue('PARTIAL_CAN_DO_MATCH','MAJOR',`${declared.canDo} -> ${actual.actualCanDo}`,'The item measures only part of the declared Can-do.'));
  else if(canDoAlignment==='WEAK_MATCH')add(issue('WEAK_CAN_DO_MATCH','MAJOR',`${declared.canDo} -> ${actual.actualCanDo}`,'The measured learner operation is too narrow or indirect.'));
  if(taskTypeAlignment==='MISMATCH')add(issue('TASK_TYPE_MISMATCH',decisive?'CRITICAL':'MAJOR',`${declared.taskType} -> ${actual.actualTaskType}`,'The actual learner task differs from the declared task type or production objective.'));
  else if(taskTypeAlignment==='PARTIAL_MATCH')add(issue('TASK_TYPE_PARTIAL_MATCH','MAJOR',`${declared.taskType} -> ${actual.actualTaskType}`,'The item represents only part of the declared task type.'));
  else if(taskTypeAlignment==='INSUFFICIENT_EVIDENCE'&&declared.taskType)add(issue('TASK_TYPE_EVIDENCE_INCOMPLETE','WARNING',`${declared.taskType} -> ${actual.actualTaskType}`,'Task-type semantic evidence is insufficient for an automatic match.'));

  const missingVisual=(actual.requiredModality==='VISUAL'||actual.requiredModality==='TEXT_VISUAL')&&!input.visualEvidence?.present;
  if(declared.section==='listening'&&analysis.modalityDependency==='NONE'&&!missingVisual)add(issue('LISTENING_NOT_REQUIRED',decisive?'CRITICAL':'MAJOR',analysis.classificationEvidence.modalityDependency,'Visible evidence is sufficient; listening is decorative rather than required.'));
  else if(declared.section==='listening'&&analysis.modalityDependency==='WEAK'){add(issue('LISTENING_DEPENDENCY_WEAK','MAJOR',analysis.classificationEvidence.modalityDependency,'Audio only confirms an answer strongly suggested by visible evidence.'));add(issue('WEAK_MODALITY_DEPENDENCY','MAJOR',analysis.classificationEvidence.modalityDependency,'The intended modality is not strongly required.'));}
  if(declared.section==='reading'&&analysis.modalityDependency==='NONE'&&!missingVisual)add(issue('READING_NOT_REQUIRED',decisive?'CRITICAL':'MAJOR',analysis.classificationEvidence.modalityDependency,'The supplied written material is decorative rather than necessary.'));
  else if(declared.section==='reading'&&analysis.modalityDependency==='WEAK'){add(issue('READING_DEPENDENCY_WEAK','MAJOR',analysis.classificationEvidence.modalityDependency,'The answer can be obtained with little or no processing of the written material.'));add(issue('WEAK_MODALITY_DEPENDENCY','MAJOR',analysis.classificationEvidence.modalityDependency,'The intended modality is not strongly required.'));}
  if(missingVisual)add(issue('ALIGNMENT_UNASSESSABLE_MISSING_VISUAL','MAJOR',analysis.classificationEvidence.modalityDependency,'The classifier reports a required visual, but no visual evidence was supplied.'));
  if(analysis.taskValidity.constructUnderrepresented)add(issue('CONSTRUCT_UNDERREPRESENTED','MAJOR',actual.actualAssessmentTarget,'The item touches but does not adequately represent the intended construct.'));
  for(const clue of analysis.taskValidity.constructIrrelevantClues)add(issue('CONSTRUCT_IRRELEVANT_CLUE','MAJOR',clue,'The learner may answer through a shortcut unrelated to the intended competency.'));
  if(analysis.taskValidity.realWorldValidity==='INVALID'||actual.actualAssessmentTarget==='UNDETERMINED')add(issue('INVALID_ASSESSMENT_TARGET',decisive?'CRITICAL':'MAJOR',actual.actualAssessmentTarget,'The learner operation cannot support a valid assessment target.'));
  if(decisive&&(sectionAlignment==='MISMATCH'||canDoAlignment==='MISMATCH'||taskTypeAlignment==='MISMATCH'||analysis.taskValidity.constructUnderrepresented))add(issue('QUESTION_DOES_NOT_MEASURE_DECLARED_SKILL','CRITICAL',actual.actualAssessmentTarget,'Independent classification shows that the item does not measure the declared learner skill.'));

  const taskValidityBase=analysis.taskValidity.realWorldValidity==='AUTHENTIC'?15:analysis.taskValidity.realWorldValidity==='PLAUSIBLE'?13:analysis.taskValidity.realWorldValidity==='ARTIFICIAL'?10:0;
  const taskValidity=Math.max(0,taskValidityBase-(analysis.taskValidity.constructUnderrepresented?4:0)-Math.min(3,analysis.taskValidity.constructIrrelevantClues.length)-(taskTypeAlignment==='MISMATCH'?5:taskTypeAlignment==='PARTIAL_MATCH'?2:0));
  const modalityDependency=analysis.modalityDependency==='STRONG'?10:analysis.modalityDependency==='MODERATE'?8:analysis.modalityDependency==='WEAK'?4:0;
  const communicativeAuthenticity=analysis.taskValidity.realWorldValidity==='AUTHENTIC'?10:analysis.taskValidity.realWorldValidity==='PLAUSIBLE'?9:analysis.taskValidity.realWorldValidity==='ARTIFICIAL'?6:0;
  const metadataConsistency=(declaredCategoryValid?2:0)+(declared.canDo?2:0)+(taskTypeAlignment==='STRONG_MATCH'?1:0);
  const scores:JftAlignmentScores={sectionAlignment:alignmentScore(sectionAlignment,20),categoryAlignment:alignmentScore(categoryAlignment,20),canDoAlignment:alignmentScore(canDoAlignment,20),taskValidity,modalityDependency,communicativeAuthenticity,metadataConsistency,total:0};scores.total=scores.sectionAlignment+scores.categoryAlignment+scores.canDoAlignment+scores.taskValidity+scores.modalityDependency+scores.communicativeAuthenticity+scores.metadataConsistency;
  const hardCodes=new Set<JftAlignmentIssueCode>(['SECTION_MISMATCH_CRITICAL','CATEGORY_MISMATCH_CRITICAL','LISTENING_NOT_REQUIRED','READING_NOT_REQUIRED','CAN_DO_MISMATCH_CRITICAL','TASK_TYPE_MISMATCH','INVALID_ASSESSMENT_TARGET','QUESTION_DOES_NOT_MEASURE_DECLARED_SKILL']);
  const hardFail=issues.some(entry=>entry.severity==='CRITICAL'&&hardCodes.has(entry.code));
  const reviewCodes=new Set<JftAlignmentIssueCode>(['SECTION_MISMATCH_CRITICAL','CATEGORY_MISMATCH_CRITICAL','LISTENING_NOT_REQUIRED','READING_NOT_REQUIRED','CAN_DO_MISMATCH_CRITICAL','TASK_TYPE_MISMATCH','TASK_TYPE_PARTIAL_MATCH','TASK_TYPE_EVIDENCE_INCOMPLETE','INVALID_ASSESSMENT_TARGET','PARTIAL_CAN_DO_MATCH','WEAK_CAN_DO_MATCH','WEAK_MODALITY_DEPENDENCY','LISTENING_DEPENDENCY_WEAK','READING_DEPENDENCY_WEAK','REFERENCE_EVIDENCE_INCOMPLETE','UNCERTAIN_CATEGORY','MULTIPLE_PLAUSIBLE_CATEGORIES','CONSTRUCT_UNDERREPRESENTED','CONSTRUCT_IRRELEVANT_CLUE','ALIGNMENT_UNASSESSABLE_MISSING_VISUAL','DECLARED_CATEGORY_MISSING','DECLARED_CATEGORY_INVALID','DECLARED_CAN_DO_MISSING','DECLARED_TASK_TYPE_MISSING','LOW_CONFIDENCE']);
  let verdict:'PASS'|'REVIEW'|'FAIL'=hardFail||scores.total<80?'FAIL':scores.total<90?'REVIEW':'PASS';
  if(!hardFail&&issues.some(entry=>reviewCodes.has(entry.code)))verdict='REVIEW';
  const blockReason=Array.from(new Set(issues.filter(entry=>verdict==='FAIL'?entry.severity==='CRITICAL':entry.severity!=='INFO').map(entry=>entry.code)));
  return {qaVersion:JFT_ALIGNMENT_PROMPT_VERSION,questionId:persistedQuestionId,verdict,hardFail,confidence:analysis.confidence,declared:{...declared},independentAssessment:{...actual},alignment:{section:sectionAlignment,category:categoryAlignment,canDo:canDoAlignment,taskType:taskTypeAlignment,modalityDependency:analysis.modalityDependency},taskValidity:{...analysis.taskValidity,constructIrrelevantClues:[...analysis.taskValidity.constructIrrelevantClues]},scores,issues,release:{eligibleToProceed:verdict==='PASS',requiresHumanReview:verdict!=='PASS',blockReason}};
}

export function withJftAlignmentAudit(result:JftAlignmentResult,metadata:{provider:string;model?:string;checkedAt?:string}):JftAlignmentGateResult {
  return {...result,provider:metadata.provider,...(metadata.model?{model:metadata.model}:{}),promptVersion:JFT_ALIGNMENT_PROMPT_VERSION,referenceVersion:JFT_ALIGNMENT_REFERENCE_VERSION,taxonomyVersion:JFT_ALIGNMENT_TAXONOMY_VERSION,checkedAt:metadata.checkedAt||new Date().toISOString()};
}

export function technicalJftAlignmentResult(input:JftAlignmentClassificationInput,declared:DeclaredAlignmentTarget,code:'JFT_ALIGNMENT_INVALID_OUTPUT'|'JFT_ALIGNMENT_PROVIDER_FAILURE',provider:string,model?:string,persistedQuestionId=input.questionId):JftAlignmentGateResult {
  const evidence=code==='JFT_ALIGNMENT_INVALID_OUTPUT'?'The provider returned data outside the validated analysis-only contract.':'The independent provider did not return usable classification evidence.';
  return {qaVersion:JFT_ALIGNMENT_PROMPT_VERSION,questionId:persistedQuestionId,verdict:'REVIEW',hardFail:false,confidence:'LOW',declared:{...declared},independentAssessment:{actualSection:'UNDETERMINED',actualCategory:'UNDETERMINED',actualCanDo:'UNDETERMINED',actualAssessmentTarget:'UNDETERMINED',actualTaskType:'UNDETERMINED',requiredModality:'OTHER',communicativePurpose:'UNDETERMINED'},alignment:{section:'INSUFFICIENT_EVIDENCE',category:'INSUFFICIENT_EVIDENCE',canDo:'INSUFFICIENT_EVIDENCE',taskType:'INSUFFICIENT_EVIDENCE',modalityDependency:'NONE'},taskValidity:{realWorldValidity:'ARTIFICIAL',constructUnderrepresented:false,constructIrrelevantClues:[]},scores:{sectionAlignment:0,categoryAlignment:0,canDoAlignment:0,taskValidity:0,modalityDependency:0,communicativeAuthenticity:0,metadataConsistency:0,total:0},issues:[issue(code,'MAJOR',evidence,'Technical uncertainty cannot be converted into an alignment pass.')],release:{eligibleToProceed:false,requiresHumanReview:true,blockReason:[code]},provider,...(model?{model}:{}),promptVersion:JFT_ALIGNMENT_PROMPT_VERSION,referenceVersion:JFT_ALIGNMENT_REFERENCE_VERSION,taxonomyVersion:JFT_ALIGNMENT_TAXONOMY_VERSION,checkedAt:new Date().toISOString()};
}
