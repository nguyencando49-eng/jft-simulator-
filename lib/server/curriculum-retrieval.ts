import type {Repository} from './domain';
import type {FactoryCandidate,FactoryJob} from './factory-domain';
import type {KnowledgeUnit} from './source-domain';
import {getRepository} from './repository';
import type {ApprovedKnowledgeUnitEvidence,CurriculumChunkEvidence,CurriculumGroundingInput,CurriculumRetrievalEvidence} from './curriculum-grounding';

export interface CurriculumCatalog {units:KnowledgeUnit[];searchedSourceDocumentIds:string[];complete:boolean;failedSourceDocumentIds:string[];chunkCache?:Map<string,CurriculumChunkEvidence[]>}

export async function loadCurriculumCatalog(repo:Repository=getRepository(),additionalSourceDocumentIds:string[]=[]):Promise<CurriculumCatalog>{
  let documents:Awaited<ReturnType<Repository['listSourceDocuments']>>=[];let documentsComplete=true;try{documents=await repo.listSourceDocuments()}catch{documentsComplete=false}
  const sourceIds=Array.from(new Set([...documents.map(document=>document.id),...additionalSourceDocumentIds.filter(Boolean)]));const units:KnowledgeUnit[]=[];const failedSourceDocumentIds:string[]=[];
  for(const sourceId of sourceIds)try{units.push(...await repo.listKnowledgeUnits(sourceId))}catch{failedSourceDocumentIds.push(sourceId)}
  return {units,searchedSourceDocumentIds:sourceIds,complete:documentsComplete&&failedSourceDocumentIds.length===0,failedSourceDocumentIds,chunkCache:new Map()};
}

const normalize=(value:string)=>value.normalize('NFKC').replace(/\s+/g,'').toLowerCase();
const levelRank:Record<FactoryCandidate['question']['level'],number>={'A1':0,'A2.1':1,'A2.2':2};
function queryTerms(candidate:FactoryCandidate,job:FactoryJob){return Array.from(new Set([candidate.question.prompt,candidate.audioScript||'',job.request.topic,job.request.canDo||'',...candidate.question.choices].join(' ').match(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]{2,}|[a-z0-9]{3,}/giu)||[])).map(normalize)}
function relevance(unit:KnowledgeUnit,terms:string[],intended:Set<string>,sourceId?:string){if(intended.has(unit.id))return 10_000;const corpus=normalize([unit.topic,unit.situation,unit.canDo,...unit.vocabulary,...(unit.kanji||[]),...unit.grammar,...unit.expressions,...unit.keyKnowledge].join(' '));return (unit.sourceDocumentId===sourceId?20:0)+terms.reduce((score,term)=>score+(corpus.includes(term)||term.includes(corpus)?5:0),0)}
function toEvidence(unit:KnowledgeUnit):ApprovedKnowledgeUnitEvidence{return {id:unit.id,sourceDocumentId:unit.sourceDocumentId,sourceChunkIds:[...unit.sourceChunkIds],status:'approved',chapter:unit.chapter,lesson:unit.lesson,topic:unit.topic,situation:unit.situation,level:unit.level,canDo:unit.canDo,grammar:[...unit.grammar],vocabulary:[...unit.vocabulary],kanji:[...(unit.kanji||[])],expressions:[...unit.expressions],keyKnowledge:[...unit.keyKnowledge],skills:[...unit.skills]}}

export function selectCurriculumUnits(catalog:CurriculumCatalog,candidate:FactoryCandidate,job:FactoryJob,maxUnits=Number(process.env.CURRICULUM_GROUNDING_MAX_UNITS||100)):{units:KnowledgeUnit[];retrieval:CurriculumRetrievalEvidence}{
  const safeMax=Number.isInteger(maxUnits)&&maxUnits>=10&&maxUnits<=500?maxUnits:100;const intendedIds=job.sourceContext?.knowledgeUnitIds||[job.sourceContext?.knowledgeUnitId].filter((id):id is string=>!!id);const intended=new Set(intendedIds);const targetRank=levelRank[candidate.question.level];const approved=catalog.units.filter(unit=>unit.status==='approved'&&levelRank[unit.level]<=targetRank);const approvedIds=new Set(approved.map(unit=>unit.id));const missingIntendedKnowledgeUnitIds=intendedIds.filter(id=>!approvedIds.has(id));const complete=catalog.complete&&approved.length<=safeMax;const terms=queryTerms(candidate,job);
  const sorted=[...approved].sort((a,b)=>relevance(b,terms,intended,job.sourceContext?.sourceDocumentId)-relevance(a,terms,intended,job.sourceContext?.sourceDocumentId)||a.id.localeCompare(b.id));const intendedApproved=sorted.filter(unit=>intended.has(unit.id));const selected=complete?sorted:[...intendedApproved,...sorted.filter(unit=>!intended.has(unit.id)).slice(0,Math.max(0,safeMax-intendedApproved.length))];
  const retrieval:CurriculumRetrievalEvidence={complete,strategy:catalog.searchedSourceDocumentIds.length===0?'UNAVAILABLE':complete?'FULL_APPROVED_CATALOG':'INTENDED_PLUS_RELEVANT',totalApprovedUnits:approved.length,returnedUnitCount:selected.length,searchedSourceDocumentIds:[...catalog.searchedSourceDocumentIds],intendedKnowledgeUnitIds:intendedIds,missingIntendedKnowledgeUnitIds,...(!complete?{reason:catalog.failedSourceDocumentIds.length?`KnowledgeUnit retrieval failed for: ${catalog.failedSourceDocumentIds.join(', ')}`:approved.length>safeMax?`Approved catalog exceeds evidence cap ${safeMax}.`:'Curriculum catalog enumeration is incomplete.'}:{})};
  return {units:selected,retrieval};
}

export async function buildCurriculumGroundingInput(job:FactoryJob,candidate:FactoryCandidate,catalog?:CurriculumCatalog,repo:Repository=getRepository()):Promise<CurriculumGroundingInput>{
  const resolvedCatalog=catalog||await loadCurriculumCatalog(repo,[job.sourceContext?.sourceDocumentId||'']);const selected=selectCurriculumUnits(resolvedCatalog,candidate,job);const expectedChunkIds=new Set(selected.units.flatMap(unit=>unit.sourceChunkIds));const chunks:CurriculumChunkEvidence[]=[];
  for(const sourceId of Array.from(new Set(selected.units.map(unit=>unit.sourceDocumentId))))try{let available=resolvedCatalog.chunkCache?.get(sourceId);if(!available){available=(await repo.listSourceChunks(sourceId)).map(chunk=>({id:chunk.id,sourceDocumentId:chunk.sourceDocumentId,chapter:chunk.chapter,section:chunk.section,normalizedText:chunk.normalizedText}));resolvedCatalog.chunkCache?.set(sourceId,available);}for(const chunk of available)if(expectedChunkIds.has(chunk.id))chunks.push(chunk)}catch{resolvedCatalog.chunkCache?.set(sourceId,[]);/* Missing chunks are recorded later as incomplete provenance. */}
  const question=candidate.question;return {questionId:question.id,instruction:question.instruction,stem:question.prompt,choices:[...question.choices],...(question.section==='listening'&&candidate.audioScript?.trim()?{audioScript:candidate.audioScript}:{}),section:question.section,...(job.request.category?{category:job.request.category}:{}),targetLevel:question.level,...(job.request.canDo?{targetCanDo:job.request.canDo}:{}),topic:job.request.topic,approvedKnowledgeUnits:selected.units.map(toEvidence),sourceChunks:chunks,retrieval:selected.retrieval};
}
