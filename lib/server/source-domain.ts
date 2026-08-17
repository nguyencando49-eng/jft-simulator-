import type { FactoryDifficulty } from './factory-domain';
import type { Question, SectionId } from '@/lib/types';

export const SOURCE_EXTRACTION_PROMPT_V1='source-extraction-v1';
export const QUESTION_PLANNER_PROMPT_V1='question-planner-v1';
export const SOURCE_ORIGINALITY_QA_V1='source-originality-v1';
export const CURRICULUM_QA_PROMPT_V1='curriculum-qa-v1';
export const ORIGINALITY_QA_PROMPT_V1='originality-qa-v1';
export type SourceErrorCode='PARSE_FAILED'|'SOURCE_EMPTY'|'EXTRACTION_FAILED'|'INVALID_MODEL_OUTPUT'|'KNOWLEDGE_NOT_APPROVED'|'KNOWLEDGE_REJECTED'|'OUT_OF_CURRICULUM'|'PLAN_FAILED'|'FACTORY_FAILED'|'ORIGINALITY_FAILED'|'INSUFFICIENT_QUESTION_BANK'|'LISTENING_AUDIO_MISSING'|'EXAM_SET_CURRICULUM_GAP';
export class SourceFactoryError extends Error { constructor(public code:SourceErrorCode,message:string){super(message);this.name='SourceFactoryError';} }
export type SourceStatus='draft'|'parsed'|'chunked'|'extracting'|'review'|'ready'|'failed';
export type KnowledgeStatus='draft'|'review'|'approved'|'rejected';
export interface SourceDocument { id:string;title:string;sourceType:'txt'|'md'|'pdf'|'text';originalFileName?:string;language:string;createdAt:string;updatedAt?:string;createdBy:string;status:SourceStatus;metadata:{author?:string;publisher?:string;edition?:string;notes?:string;[key:string]:unknown};rawText?:string;error?:{code:SourceErrorCode;message:string}; }
export interface SourceChunk { id:string;sourceDocumentId:string;chapter?:string;section?:string;pageStart?:number;pageEnd?:number;rawText:string;normalizedText:string;sequence:number;createdAt:string; }
export type KnowledgeSkill='vocabulary'|'conversation'|'listening'|'reading';
export interface KnowledgeUnit { id:string;sourceDocumentId:string;sourceChunkIds:string[];chapter?:string;lesson?:string;topic:string;situation:string;level:Question['level'];canDo:string;grammar:string[];vocabulary:string[];kanji?:string[];expressions:string[];keyKnowledge:string[];skills:KnowledgeSkill[];notes?:string;confidence:number;status:KnowledgeStatus;createdAt:string;updatedAt?:string;provider:string;model?:string;promptVersion:string; }
export interface SourceExtractionInput { document:SourceDocument;chunks:SourceChunk[];maxKnowledgeUnits:number; }
export interface KnowledgeExtractionResult { units:Array<Omit<KnowledgeUnit,'id'|'createdAt'|'status'|'sourceDocumentId'|'provider'|'model'|'promptVersion'>>;provider:string;model?:string;promptVersion:string; }
export interface QuestionPlanItem { id:string;section:SectionId;category:string;level:Question['level'];topic:string;canDo:string;difficulty:FactoryDifficulty;objective:string;knowledgeUnitId:string;knowledgeUnitIds?:string[];count:number; }
export interface QuestionPlan { id:string;sourceDocumentId:string;knowledgeUnitIds:string[];items:QuestionPlanItem[];requestedCount:number;status:'draft'|'ready'|'generated'|'failed';createdAt:string;createdBy:string;provider:string;model?:string;promptVersion:string;factoryJobIds:string[];error?:{code:SourceErrorCode;message:string}; }
export interface PlanningInput { units:KnowledgeUnit[];requestedCount:number;coveragePreferences?:Partial<Record<KnowledgeSkill,number>>; }
export interface QuestionPlanningResult { items:Array<Omit<QuestionPlanItem,'id'>>;provider:string;model?:string;promptVersion:string; }
export interface QuestionProvenance { id:string;questionId:string;sourceDocumentId:string;sourceChunkIds:string[];knowledgeUnitId:string;knowledgeUnitIds?:string[];questionPlanId:string;factoryJobId:string;generatorProvider:string;generatorModel?:string;generatorPromptVersion:string;qaProvider:string;qaModel?:string;createdAt:string;reviewedBy?:string;approvedAt?:string; }
export function assertKnowledgeUnit(value:unknown):asserts value is KnowledgeExtractionResult['units'][number]{
  const x=value as any; const levels=['A1','A2.1','A2.2']; const skills=['vocabulary','conversation','listening','reading'];
  if(!x||typeof x.topic!=='string'||!x.topic.trim()||typeof x.situation!=='string'||!levels.includes(x.level)||typeof x.canDo!=='string'||![x.grammar,x.vocabulary,x.kanji,x.expressions,x.keyKnowledge,x.skills,x.sourceChunkIds].every(Array.isArray)||!x.skills.every((s:string)=>skills.includes(s))||typeof x.confidence!=='number'||x.confidence<0||x.confidence>1) throw new SourceFactoryError('INVALID_MODEL_OUTPUT','Knowledge provider returned data outside the required schema.');
}
