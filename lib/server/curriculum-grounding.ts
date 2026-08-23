import type {QuestionRecord} from '@/lib/admin-types';

export const CURRICULUM_GROUNDING_PROMPT_VERSION='JFT_CURRICULUM_GROUNDING_V1' as const;
export const CURRICULUM_GROUNDING_SYSTEM_PROMPT_V1=`You are an independent Curriculum Grounding Judge. Extract the exact knowledge a learner needs to solve the question, then map each item only to supplied APPROVED KnowledgeUnit evidence. Distinguish REQUIRED, SUPPORTING, and INCIDENTAL knowledge. New names, dates, times, numbers, prices, simple places, and fictional names are normally incidental unless their meaning is needed to solve. Passage/audio facts need not be memorized, but the vocabulary, kanji, grammar, and expressions needed to understand them must be supported. Inspect distractors too. Never infer support from topic similarity alone, invent IDs, use unsupplied curriculum, solve the answer, judge Japanese naturalness/difficulty/JFT format, or rewrite the question.

Return JSON only: {qaVersion:"JFT_CURRICULUM_GROUNDING_V1",questionId,confidence:"HIGH|MEDIUM|LOW",knowledgeAnalysis:[{type:"VOCABULARY|KANJI|GRAMMAR|EXPRESSION|PRAGMATIC_FUNCTION|CULTURAL_BACKGROUND|TASK_STRATEGY|OTHER",value,role:"REQUIRED|SUPPORTING|INCIDENTAL",source:"STEM|PASSAGE|AUDIO_SCRIPT|CHOICE|TASK|BACKGROUND",choiceIndex?,support:"SUPPORTED|PARTIALLY_SUPPORTED|UNSUPPORTED|AMBIGUOUS_SUPPORT",knowledgeUnitIds:[],sourceChunkIds:[],evidence,reason,contradictedByCurriculum:false}]}. Analyze at least one REQUIRED item. SUPPORTED claims require real supplied approved KnowledgeUnit IDs. UNSUPPORTED claims must not invent IDs. If supplied retrieval is incomplete, still report semantic mapping honestly; application policy will convert negative evidence to REVIEW rather than false FAIL.`;

export type CurriculumKnowledgeType='VOCABULARY'|'KANJI'|'GRAMMAR'|'EXPRESSION'|'PRAGMATIC_FUNCTION'|'CULTURAL_BACKGROUND'|'TASK_STRATEGY'|'OTHER';
export type CurriculumKnowledgeRole='REQUIRED'|'SUPPORTING'|'INCIDENTAL';
export type CurriculumSupport='SUPPORTED'|'PARTIALLY_SUPPORTED'|'UNSUPPORTED'|'AMBIGUOUS_SUPPORT';
export type CurriculumKnowledgeSource='STEM'|'PASSAGE'|'AUDIO_SCRIPT'|'CHOICE'|'TASK'|'BACKGROUND';
export type CurriculumGroundingConfidence='HIGH'|'MEDIUM'|'LOW';
export type CurriculumGroundingSeverity='INFO'|'WARNING'|'MAJOR'|'CRITICAL';
export type CurriculumGroundingIssueCode=
  'REQUIRED_GRAMMAR_UNSUPPORTED'|'REQUIRED_VOCABULARY_UNSUPPORTED'|'REQUIRED_KANJI_UNSUPPORTED'|'REQUIRED_EXPRESSION_UNSUPPORTED'|
  'EXTERNAL_KNOWLEDGE_REQUIRED'|'CURRICULUM_CONTRADICTION'|'OUT_OF_CURRICULUM'|'DISTRACTOR_OUT_OF_CURRICULUM'|
  'AMBIGUOUS_SUPPORT'|'PARTIALLY_SUPPORTED'|'PROVENANCE_INCOMPLETE'|'CURRICULUM_EVIDENCE_MISSING'|
  'INSUFFICIENT_CURRICULUM_EVIDENCE'|'UNCERTAIN_KNOWLEDGE_MAPPING'|'LOW_CONFIDENCE'|'CURRICULUM_SEARCH_INCOMPLETE'|
  'CURRICULUM_GROUNDING_INVALID_OUTPUT'|'CURRICULUM_GROUNDING_PROVIDER_FAILURE';

export interface ApprovedKnowledgeUnitEvidence {
  id:string;sourceDocumentId:string;sourceChunkIds:string[];status:'approved';chapter?:string;lesson?:string;topic:string;situation:string;
  level:QuestionRecord['level'];canDo:string;grammar:string[];vocabulary:string[];kanji:string[];expressions:string[];keyKnowledge:string[];skills:string[];
}
export interface CurriculumChunkEvidence {id:string;sourceDocumentId:string;chapter?:string;section?:string;normalizedText:string}
export interface CurriculumRetrievalEvidence {
  complete:boolean;strategy:'FULL_APPROVED_CATALOG'|'INTENDED_PLUS_RELEVANT'|'UNAVAILABLE';totalApprovedUnits:number;returnedUnitCount:number;
  searchedSourceDocumentIds:string[];intendedKnowledgeUnitIds:string[];missingIntendedKnowledgeUnitIds:string[];reason?:string;
}
export interface CurriculumGroundingInput {
  questionId:string;instruction:string;stem:string;choices:string[];audioScript?:string;section:QuestionRecord['section'];category?:string;
  targetLevel:QuestionRecord['level'];targetCanDo?:string;topic?:string;approvedKnowledgeUnits:ApprovedKnowledgeUnitEvidence[];
  sourceChunks:CurriculumChunkEvidence[];retrieval:CurriculumRetrievalEvidence;
}
export interface CurriculumKnowledgeAnalysisItem {
  type:CurriculumKnowledgeType;value:string;role:CurriculumKnowledgeRole;source:CurriculumKnowledgeSource;choiceIndex?:number;
  support:CurriculumSupport;knowledgeUnitIds:string[];sourceChunkIds:string[];evidence:string;reason:string;contradictedByCurriculum:boolean;
}
export interface CurriculumGroundingAnalysis {qaVersion:typeof CURRICULUM_GROUNDING_PROMPT_VERSION;questionId:string;confidence:CurriculumGroundingConfidence;knowledgeAnalysis:CurriculumKnowledgeAnalysisItem[]}
export interface CurriculumGroundingIssue {code:CurriculumGroundingIssueCode;severity:CurriculumGroundingSeverity;evidence:string;reason:string;suggestedAction:string}
export interface CurriculumGroundingResult extends CurriculumGroundingAnalysis {
  verdict:'PASS'|'REVIEW'|'FAIL';hardFail:boolean;
  coverage:{requiredCount:number;supportedCount:number;partialCount:number;unsupportedCount:number;coverageRatio:number};
  outsideKnowledge:Array<{type:CurriculumKnowledgeType;value:string;requiredToSolve:boolean;reason:string}>;
  provenance:{complete:boolean;missingEvidence:string[]};issues:CurriculumGroundingIssue[];
  release:{eligibleToProceed:boolean;requiresHumanReview:boolean;blockReason:CurriculumGroundingIssueCode[]};
  retrieval:CurriculumRetrievalEvidence;evaluatedKnowledgeUnitIds:string[];
}
export interface CurriculumGroundingGateResult extends CurriculumGroundingResult {provider:string;model?:string;promptVersion:typeof CURRICULUM_GROUNDING_PROMPT_VERSION;checkedAt:string}

export class CurriculumGroundingError extends Error{
  constructor(public readonly code:'CURRICULUM_GROUNDING_INVALID_OUTPUT'|'CURRICULUM_GROUNDING_PROVIDER_FAILURE',message:string){super(message);this.name='CurriculumGroundingError'}
}

const types=new Set<CurriculumKnowledgeType>(['VOCABULARY','KANJI','GRAMMAR','EXPRESSION','PRAGMATIC_FUNCTION','CULTURAL_BACKGROUND','TASK_STRATEGY','OTHER']);
const roles=new Set<CurriculumKnowledgeRole>(['REQUIRED','SUPPORTING','INCIDENTAL']);
const supports=new Set<CurriculumSupport>(['SUPPORTED','PARTIALLY_SUPPORTED','UNSUPPORTED','AMBIGUOUS_SUPPORT']);
const sources=new Set<CurriculumKnowledgeSource>(['STEM','PASSAGE','AUDIO_SCRIPT','CHOICE','TASK','BACKGROUND']);
const confidences=new Set<CurriculumGroundingConfidence>(['HIGH','MEDIUM','LOW']);

export function validateCurriculumGroundingAnalysis(value:unknown,input:CurriculumGroundingInput):CurriculumGroundingAnalysis{
  const fail=(message:string):never=>{throw new CurriculumGroundingError('CURRICULUM_GROUNDING_INVALID_OUTPUT',message)};
  if(!value||typeof value!=='object'||Array.isArray(value))fail('Curriculum analysis must be an object.');const v=value as Record<string,unknown>;
  if(v.qaVersion!==CURRICULUM_GROUNDING_PROMPT_VERSION||v.questionId!==input.questionId||!confidences.has(v.confidence as CurriculumGroundingConfidence)||!Array.isArray(v.knowledgeAnalysis))fail('Curriculum analysis header is invalid.');
  const unitMap=new Map(input.approvedKnowledgeUnits.map(unit=>[unit.id,unit]));const chunkMap=new Map(input.sourceChunks.map(chunk=>[chunk.id,chunk]));
  const knowledgeAnalysis=(v.knowledgeAnalysis as unknown[]).map((raw,index)=>{
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail(`knowledgeAnalysis[${index}] is invalid.`);const x=raw as Record<string,unknown>;
    if(!types.has(x.type as CurriculumKnowledgeType)||typeof x.value!=='string'||!x.value.trim()||!roles.has(x.role as CurriculumKnowledgeRole)||!sources.has(x.source as CurriculumKnowledgeSource)||!supports.has(x.support as CurriculumSupport)||!Array.isArray(x.knowledgeUnitIds)||!Array.isArray(x.sourceChunkIds)||typeof x.evidence!=='string'||!x.evidence.trim()||typeof x.reason!=='string'||!x.reason.trim()||typeof x.contradictedByCurriculum!=='boolean')return fail(`knowledgeAnalysis[${index}] is invalid.`);
    const unitIds=x.knowledgeUnitIds as string[],sourceChunkIds=x.sourceChunkIds as string[];
    if(new Set(unitIds).size!==unitIds.length||new Set(sourceChunkIds).size!==sourceChunkIds.length||unitIds.some(id=>!unitMap.has(id))||sourceChunkIds.some(id=>!chunkMap.has(id)))return fail(`knowledgeAnalysis[${index}] references unavailable curriculum evidence.`);
    if(x.support==='SUPPORTED'&&unitIds.length===0)return fail(`knowledgeAnalysis[${index}] claims support without a KnowledgeUnit.`);
    if(x.support==='UNSUPPORTED'&&(unitIds.length||sourceChunkIds.length))return fail(`knowledgeAnalysis[${index}] claims unsupported knowledge with support IDs.`);
    const ownsChunk=(chunkId:string)=>{const chunk=chunkMap.get(chunkId);return !!chunk&&unitIds.some(id=>{const unit=unitMap.get(id);return !!unit&&unit.sourceDocumentId===chunk.sourceDocumentId&&unit.sourceChunkIds.includes(chunkId)});};if(sourceChunkIds.some(id=>!ownsChunk(id)))return fail(`knowledgeAnalysis[${index}] has a SourceChunk outside its KnowledgeUnits or source document.`);
    if(x.source==='CHOICE'){if(!Number.isInteger(x.choiceIndex)||Number(x.choiceIndex)<0||Number(x.choiceIndex)>=input.choices.length)return fail(`knowledgeAnalysis[${index}] requires a valid choiceIndex.`);}else if(x.choiceIndex!==undefined)return fail(`knowledgeAnalysis[${index}] has an unexpected choiceIndex.`);
    return {type:x.type as CurriculumKnowledgeType,value:x.value,role:x.role as CurriculumKnowledgeRole,source:x.source as CurriculumKnowledgeSource,...(x.choiceIndex!==undefined?{choiceIndex:Number(x.choiceIndex)}:{}),support:x.support as CurriculumSupport,knowledgeUnitIds:[...unitIds],sourceChunkIds:[...sourceChunkIds],evidence:x.evidence,reason:x.reason,contradictedByCurriculum:x.contradictedByCurriculum as boolean};
  });
  if(!knowledgeAnalysis.some(item=>item.role==='REQUIRED'))fail('At least one REQUIRED knowledge item must be extracted.');
  const keys=knowledgeAnalysis.map(item=>`${item.type}\u0000${item.value.normalize('NFKC')}\u0000${item.role}\u0000${item.source}\u0000${item.choiceIndex??''}`);if(new Set(keys).size!==keys.length)fail('Duplicate knowledge analysis items are not allowed.');
  return {qaVersion:CURRICULUM_GROUNDING_PROMPT_VERSION,questionId:input.questionId,confidence:v.confidence as CurriculumGroundingConfidence,knowledgeAnalysis};
}

function issue(code:CurriculumGroundingIssueCode,severity:CurriculumGroundingSeverity,evidence:string,reason:string):CurriculumGroundingIssue{return {code,severity,evidence,reason,suggestedAction:'Review the curriculum mapping or revise the question before another QA run.'}}
function unsupportedCode(type:CurriculumKnowledgeType):CurriculumGroundingIssueCode{return type==='GRAMMAR'?'REQUIRED_GRAMMAR_UNSUPPORTED':type==='VOCABULARY'?'REQUIRED_VOCABULARY_UNSUPPORTED':type==='KANJI'?'REQUIRED_KANJI_UNSUPPORTED':type==='EXPRESSION'||type==='PRAGMATIC_FUNCTION'?'REQUIRED_EXPRESSION_UNSUPPORTED':type==='CULTURAL_BACKGROUND'?'EXTERNAL_KNOWLEDGE_REQUIRED':'OUT_OF_CURRICULUM'}

export function finalizeCurriculumGrounding(analysis:CurriculumGroundingAnalysis,input:CurriculumGroundingInput):CurriculumGroundingResult{
  const required=analysis.knowledgeAnalysis.filter(item=>item.role==='REQUIRED');const supported=required.filter(item=>item.support==='SUPPORTED');const partial=required.filter(item=>item.support==='PARTIALLY_SUPPORTED'||item.support==='AMBIGUOUS_SUPPORT');const unsupported=required.filter(item=>item.support==='UNSUPPORTED');
  const coverage={requiredCount:required.length,supportedCount:supported.length,partialCount:partial.length,unsupportedCount:unsupported.length,coverageRatio:required.length?supported.length/required.length:0};
  const issues:CurriculumGroundingIssue[]=[];const add=(entry:CurriculumGroundingIssue)=>{if(!issues.some(current=>current.code===entry.code&&current.evidence===entry.evidence))issues.push(entry)};
  const authoritative=input.approvedKnowledgeUnits.length>0;
  if(!authoritative)add(issue('CURRICULUM_EVIDENCE_MISSING','WARNING','No approved KnowledgeUnits were supplied.','QA4 cannot establish a curriculum boundary without approved evidence.'));
  if(input.retrieval.missingIntendedKnowledgeUnitIds.length)add(issue('INSUFFICIENT_CURRICULUM_EVIDENCE','WARNING',input.retrieval.missingIntendedKnowledgeUnitIds.join(', '),'One or more intended KnowledgeUnits are missing or not approved.'));
  if(!input.retrieval.complete)add(issue('CURRICULUM_SEARCH_INCOMPLETE','WARNING',input.retrieval.reason||input.retrieval.strategy,'Absence from an incomplete retrieved subset cannot prove that knowledge is outside the curriculum.'));
  if(analysis.confidence==='LOW')add(issue('LOW_CONFIDENCE','WARNING','Provider confidence is LOW.','Low-confidence curriculum mapping cannot pass automatically.'));
  for(const item of analysis.knowledgeAnalysis){
    if(item.contradictedByCurriculum)add(issue('CURRICULUM_CONTRADICTION','CRITICAL',item.value,item.reason));
    if(item.role==='REQUIRED'&&item.support==='PARTIALLY_SUPPORTED')add(issue('PARTIALLY_SUPPORTED','MAJOR',item.value,item.reason));
    if(item.role==='REQUIRED'&&item.support==='AMBIGUOUS_SUPPORT')add(issue('AMBIGUOUS_SUPPORT','MAJOR',item.value,item.reason));
    if(item.support==='UNSUPPORTED'&&item.source==='CHOICE'&&item.role!=='INCIDENTAL')add(issue('DISTRACTOR_OUT_OF_CURRICULUM',item.role==='REQUIRED'?'CRITICAL':'MAJOR',item.value,'An option introduces unsupported knowledge that may affect elimination or solvability.'));
    if(item.role==='REQUIRED'&&item.support==='UNSUPPORTED'&&authoritative&&input.retrieval.complete){add(issue(unsupportedCode(item.type),'CRITICAL',item.value,item.reason));add(issue('OUT_OF_CURRICULUM','CRITICAL',item.value,'Essential knowledge has no support in the completely searched approved curriculum.'));}
    else if(item.role==='REQUIRED'&&item.support==='UNSUPPORTED')add(issue('UNCERTAIN_KNOWLEDGE_MAPPING','MAJOR',item.value,'The item appears unsupported, but available curriculum evidence is insufficient for a hard failure.'));
  }
  const chunkMap=new Map(input.sourceChunks.map(chunk=>[chunk.id,chunk]));const unitMap=new Map(input.approvedKnowledgeUnits.map(unit=>[unit.id,unit]));const missingEvidence:string[]=[];
  if(!authoritative)missingEvidence.push('No approved KnowledgeUnit authority was supplied');
  for(const item of analysis.knowledgeAnalysis.filter(value=>value.support!=='UNSUPPORTED')){
    if((item.support==='PARTIALLY_SUPPORTED'||item.support==='AMBIGUOUS_SUPPORT')&&!item.knowledgeUnitIds.length)missingEvidence.push(`Knowledge mapping ${item.type}:${item.value} has no traceable KnowledgeUnit support`);
    if(!item.knowledgeUnitIds.length)continue;
    if(!item.sourceChunkIds.length)missingEvidence.push(`Knowledge mapping ${item.type}:${item.value} has no SourceChunk evidence`);
    for(const unitId of item.knowledgeUnitIds){const unit=unitMap.get(unitId);if(!unit){missingEvidence.push(`KnowledgeUnit ${unitId} unavailable`);continue;}if(!unit.sourceChunkIds.length)missingEvidence.push(`KnowledgeUnit ${unitId} has no SourceChunk IDs`);for(const chunkId of unit.sourceChunkIds){const chunk=chunkMap.get(chunkId);if(!chunk)missingEvidence.push(`SourceChunk ${chunkId} unavailable for ${unitId}`);else if(chunk.sourceDocumentId!==unit.sourceDocumentId)missingEvidence.push(`SourceChunk ${chunkId} belongs to a different source document than ${unitId}`);}}
  }
  if(missingEvidence.length)add(issue('PROVENANCE_INCOMPLETE','WARNING',Array.from(new Set(missingEvidence)).join('; '),'A support claim cannot be traced completely from KnowledgeUnit to SourceChunk.'));
  const outsideKnowledge=unsupported.map(item=>({type:item.type,value:item.value,requiredToSolve:true,reason:item.reason}));
  const hardCodes=new Set<CurriculumGroundingIssueCode>(['REQUIRED_GRAMMAR_UNSUPPORTED','REQUIRED_VOCABULARY_UNSUPPORTED','REQUIRED_KANJI_UNSUPPORTED','REQUIRED_EXPRESSION_UNSUPPORTED','EXTERNAL_KNOWLEDGE_REQUIRED','CURRICULUM_CONTRADICTION','OUT_OF_CURRICULUM']);const hardFail=issues.some(entry=>hardCodes.has(entry.code));
  const verdict:'PASS'|'REVIEW'|'FAIL'=hardFail?'FAIL':issues.length?'REVIEW':'PASS';const blockReason=Array.from(new Set(issues.filter(entry=>entry.severity==='CRITICAL').map(entry=>entry.code)));
  return {...analysis,verdict,hardFail,coverage,outsideKnowledge,provenance:{complete:missingEvidence.length===0,missingEvidence:Array.from(new Set(missingEvidence))},issues,release:{eligibleToProceed:verdict==='PASS',requiresHumanReview:verdict!=='PASS',blockReason},retrieval:input.retrieval,evaluatedKnowledgeUnitIds:input.approvedKnowledgeUnits.map(unit=>unit.id)};
}

export function withCurriculumGroundingAudit(result:CurriculumGroundingResult,metadata:{provider:string;model?:string;checkedAt?:string}):CurriculumGroundingGateResult{return {...result,provider:metadata.provider,...(metadata.model?{model:metadata.model}:{}),promptVersion:CURRICULUM_GROUNDING_PROMPT_VERSION,checkedAt:metadata.checkedAt||new Date().toISOString()}}

export function technicalCurriculumGroundingResult(input:CurriculumGroundingInput,code:'CURRICULUM_GROUNDING_INVALID_OUTPUT'|'CURRICULUM_GROUNDING_PROVIDER_FAILURE',provider:string,model?:string):CurriculumGroundingGateResult{
  return {qaVersion:CURRICULUM_GROUNDING_PROMPT_VERSION,questionId:input.questionId,confidence:'LOW',knowledgeAnalysis:[],verdict:'REVIEW',hardFail:false,coverage:{requiredCount:0,supportedCount:0,partialCount:0,unsupportedCount:0,coverageRatio:0},outsideKnowledge:[],provenance:{complete:false,missingEvidence:[code]},issues:[issue(code,'MAJOR','Provider evidence unavailable.',code)],release:{eligibleToProceed:false,requiresHumanReview:true,blockReason:[code]},retrieval:input.retrieval,evaluatedKnowledgeUnitIds:input.approvedKnowledgeUnits.map(unit=>unit.id),provider,...(model?{model}:{}),promptVersion:CURRICULUM_GROUNDING_PROMPT_VERSION,checkedAt:new Date().toISOString()};
}
