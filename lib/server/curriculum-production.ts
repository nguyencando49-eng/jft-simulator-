import type { QuestionRecord } from '@/lib/admin-types';
import type { SectionId } from '@/lib/types';
import { CONTENT_LEVELS, DEFAULT_DIFFICULTY_DISTRIBUTION, JFT_CATEGORIES, type ContentDifficulty, type ContentLevel } from './content-taxonomy';
import type { KnowledgeUnit, QuestionProvenance } from './source-domain';
import { SourceFactoryError } from './source-domain';

export type CurriculumQaResult = {
  curriculumGrounded:boolean; knowledgeUnitIds:string[]; requiredVocabularyCovered:boolean;
  requiredGrammarCovered:boolean; requiredKanjiCovered:boolean; requiredExpressionsCovered:boolean;
  outsideKnowledge:string[]; score:number; hardFail:boolean;
};

export function runCurriculumQa(question:QuestionRecord,units:KnowledgeUnit[]):CurriculumQaResult{
  const approved=units.filter(u=>u.status==='approved');
  if(!approved.length) return {curriculumGrounded:false,knowledgeUnitIds:[],requiredVocabularyCovered:false,requiredGrammarCovered:false,requiredKanjiCovered:false,requiredExpressionsCovered:false,outsideKnowledge:['NO_APPROVED_KNOWLEDGE_UNIT'],score:0,hardFail:true};
  const boundary=new Set(approved.flatMap(u=>[...u.vocabulary,...u.grammar,...(u.kanji||[]),...u.expressions,...u.keyKnowledge]).flatMap(x=>x.normalize('NFKC').toLowerCase().split(/[\s、。・,!?！？「」『』（）()]+/)).filter(Boolean));
  const required=[question.prompt,...question.choices].join(' ').normalize('NFKC').toLowerCase();
  const japanese=Array.from(new Set(required.match(/[\u3040-\u30ff\u3400-\u9fff]{2,}/g)||[]));
  const outside=japanese.filter(token=>![...boundary].some(k=>k.includes(token)||token.includes(k))).slice(0,20);
  const covered=(values:string[])=>values.length===0||values.some(v=>required.includes(v.normalize('NFKC').toLowerCase()));
  const result={curriculumGrounded:outside.length===0,knowledgeUnitIds:approved.map(u=>u.id),requiredVocabularyCovered:covered(approved.flatMap(u=>u.vocabulary)),requiredGrammarCovered:covered(approved.flatMap(u=>u.grammar)),requiredKanjiCovered:covered(approved.flatMap(u=>u.kanji||[])),requiredExpressionsCovered:covered(approved.flatMap(u=>u.expressions)),outsideKnowledge:outside,score:Math.max(0,100-outside.length*20),hardFail:outside.length>0};
  return result;
}

export type CoverageCell={level:ContentLevel;sourceDocumentId:string;chapter?:string;knowledgeUnitId:string;section:SectionId;category:string;canDo:string;topic:string;difficulty:ContentDifficulty;required:number;available:number;approved:number;used:number;deficit:number};
export function calculateCoverage(units:KnowledgeUnit[],questions:QuestionRecord[],provenance:QuestionProvenance[],requiredPerCell=1):CoverageCell[]{
  return units.filter(u=>u.status==='approved').flatMap(u=>u.skills.map(skill=>{
    const section:SectionId=skill==='vocabulary'?'script_vocabulary':skill==='conversation'?'conversation_expression':skill;
    const category=JFT_CATEGORIES[section][0]; const linked=provenance.filter(p=>(p.knowledgeUnitIds||[p.knowledgeUnitId]).includes(u.id));
    const linkedIds=new Set(linked.map(p=>p.questionId)); const matching=questions.filter(q=>linkedIds.has(q.id)); const approved=matching.filter(q=>q.status==='approved').length;
    return {level:u.level,sourceDocumentId:u.sourceDocumentId,chapter:u.chapter||u.lesson,knowledgeUnitId:u.id,section,category,canDo:u.canDo,topic:u.topic,difficulty:'medium' as const,required:requiredPerCell,available:matching.length,approved,used:0,deficit:Math.max(0,requiredPerCell-approved)};
  }));
}
export const rankDeficits=(cells:CoverageCell[])=>cells.filter(x=>x.deficit>0).sort((a,b)=>b.deficit-a.deficit||a.level.localeCompare(b.level));

export type ExamBlueprintVersion={version:string;level:ContentLevel;totalQuestions:number;sectionQuotas:Record<SectionId,number>;categoryQuotas?:Partial<Record<string,number>>;difficultyTargets:Record<ContentDifficulty,number>;minTopics:number;minCanDos:number;maxReuse:number;maxOverlap:number;status:'draft'|'active'|'retired'};
export type ReadinessResult={status:'READY'|'NOT_READY';deficits:string[];approved:number;required:number};
export function checkExamReadiness(level:ContentLevel,questions:QuestionRecord[],blueprint:ExamBlueprintVersion,examCount=20):ReadinessResult{
  const pool=questions.filter(q=>q.level===level&&q.status==='approved'); const deficits:string[]=[];
  const required=Math.ceil(blueprint.totalQuestions*examCount/blueprint.maxReuse);
  if(pool.length<required) deficits.push(`approved question bank: ${pool.length}/${required}`);
  for(const [section,quota] of Object.entries(blueprint.sectionQuotas) as [SectionId,number][]){const need=Math.ceil(quota*examCount/blueprint.maxReuse),have=pool.filter(q=>q.section===section).length;if(have<need)deficits.push(`${section}: ${have}/${need}`);}
  if(pool.filter(q=>q.type==='audio_choice').some(q=>!q.audioSrc)) deficits.push('Listening audio missing');
  if(new Set(pool.flatMap(q=>q.tags||[])).size<blueprint.minTopics) deficits.push('Topic diversity insufficient');
  return {status:deficits.length?'NOT_READY':'READY',deficits,approved:pool.length,required};
}

function hashSeed(seed:string){let h=2166136261;for(const c of seed){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function seeded<T>(items:T[],seed:string){let state=hashSeed(seed);return items.map(value=>({value,key:(state=(Math.imul(state,1664525)+1013904223)>>>0)})).sort((a,b)=>a.key-b.key).map(x=>x.value);}
export type FrozenExamVersion={id:string;name:string;level:ContentLevel;seed:string;blueprintVersion:string;questionIds:string[];coverage:{sections:Record<string,number>;topics:number;canDos:number};createdAt:string};
export function assembleExam(input:{level:ContentLevel;blueprint:ExamBlueprintVersion;seed:string;questions:QuestionRecord[];usage?:Map<string,number>;name?:string}):FrozenExamVersion{
  const {level,blueprint,seed}=input; const usage=input.usage||new Map<string,number>(); const selected:QuestionRecord[]=[];
  for(const [section,quota] of Object.entries(blueprint.sectionQuotas) as [SectionId,number][]){const pool=seeded(input.questions.filter(q=>q.level===level&&q.status==='approved'&&q.section===section&&(usage.get(q.id)||0)<blueprint.maxReuse&&(!q.type.includes('audio')||!!q.audioSrc)),`${seed}:${section}`);if(pool.length<quota)throw new SourceFactoryError('INSUFFICIENT_QUESTION_BANK',`${section} requires ${quota}, available ${pool.length}.`);selected.push(...pool.slice(0,quota));}
  if(selected.length!==blueprint.totalQuestions)throw new SourceFactoryError('INSUFFICIENT_QUESTION_BANK','Blueprint section quotas do not equal totalQuestions.');
  const topics=new Set(selected.flatMap(q=>q.tags?.slice(0,1)||[])),canDos=new Set(selected.flatMap(q=>q.tags?.slice(1,2)||[]));
  if(topics.size<blueprint.minTopics||canDos.size<blueprint.minCanDos)throw new SourceFactoryError('INSUFFICIENT_QUESTION_BANK','Diversity constraints cannot be satisfied.');
  selected.forEach(q=>usage.set(q.id,(usage.get(q.id)||0)+1)); const sections=Object.fromEntries(Object.keys(blueprint.sectionQuotas).map(s=>[s,selected.filter(q=>q.section===s).length]));
  return {id:`${level.replaceAll('.','_')}-${hashSeed(seed).toString(16)}`,name:input.name||level,level,seed,blueprintVersion:blueprint.version,questionIds:selected.map(q=>q.id),coverage:{sections,topics:topics.size,canDos:canDos.size},createdAt:new Date().toISOString()};
}
export function pairwiseOverlap(a:FrozenExamVersion,b:FrozenExamVersion){const ids=new Set(a.questionIds);return a.questionIds.length?b.questionIds.filter(id=>ids.has(id)).length/Math.min(a.questionIds.length,b.questionIds.length):0;}
export function generateExamSet(input:{level:ContentLevel;examCount:number;blueprint:ExamBlueprintVersion;seed:string;questions:QuestionRecord[]}){const usage=new Map<string,number>(),exams:FrozenExamVersion[]=[];for(let i=1;i<=input.examCount;i++)exams.push(assembleExam({level:input.level,blueprint:input.blueprint,seed:`${input.seed}:${i}`,questions:input.questions,usage,name:`${input.level}-${String(i).padStart(2,'0')}`}));const violations=[] as Array<{a:string;b:string;overlap:number}>;for(let i=0;i<exams.length;i++)for(let j=i+1;j<exams.length;j++){const overlap=pairwiseOverlap(exams[i],exams[j]);if(overlap>=input.blueprint.maxOverlap)violations.push({a:exams[i].name,b:exams[j].name,overlap});}return {status:violations.length?'DRAFT':'QA_PASSED',exams,violations,seed:input.seed,blueprintVersion:input.blueprint.version};}

export const DEFAULT_BLUEPRINTS:Record<ContentLevel,ExamBlueprintVersion>=Object.fromEntries(CONTENT_LEVELS.map(level=>[level,{version:'JFT_SIM_BLUEPRINT_V1',level,totalQuestions:48,sectionQuotas:{script_vocabulary:12,conversation_expression:12,listening:12,reading:12},difficultyTargets:{easy:14,medium:24,hard:10},minTopics:8,minCanDos:8,maxReuse:2,maxOverlap:.15,status:'active'}])) as Record<ContentLevel,ExamBlueprintVersion>;
void DEFAULT_DIFFICULTY_DISTRIBUTION;
