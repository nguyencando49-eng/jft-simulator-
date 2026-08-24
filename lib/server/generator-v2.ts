import type {QuestionRecord} from '@/lib/admin-types';
import type {Question,SectionId} from '@/lib/types';
import {isCategoryForSection} from './content-taxonomy';
import type {KnowledgeUnit,QuestionPlanItem} from './source-domain';

export const QUESTION_GENERATOR_V2_VERSION='JFT_QUESTION_GENERATOR_V2' as const;
export const ITEM_BLUEPRINT_VERSION='JFT_ITEM_BLUEPRINT_V1' as const;
export const GENERATOR_PREFLIGHT_VERSION='JFT_GENERATOR_PREFLIGHT_V1' as const;
export const GENERATOR_MAX_ATTEMPTS=3;

export type ReasoningPattern='direct-recognition'|'single-information-retrieval'|'single-step-comprehension'|'appropriate-response';
export type StimulusFormat='isolated-term'|'sentence'|'dialogue'|'announcement'|'notice'|'message'|'schedule';

export interface LevelGenerationContract{
  level:Question['level'];maxStimulusChars:number;maxSentences:number;maxFacts:number;
  allowedReasoning:ReasoningPattern[];distractorSimilarity:'low'|'moderate'|'high';
}
export const LEVEL_GENERATION_CONTRACTS:Record<Question['level'],LevelGenerationContract>={
  A1:{level:'A1',maxStimulusChars:180,maxSentences:4,maxFacts:3,allowedReasoning:['direct-recognition','single-information-retrieval','single-step-comprehension','appropriate-response'],distractorSimilarity:'moderate'},
  'A2.1':{level:'A2.1',maxStimulusChars:320,maxSentences:7,maxFacts:5,allowedReasoning:['single-information-retrieval','single-step-comprehension','appropriate-response'],distractorSimilarity:'moderate'},
  'A2.2':{level:'A2.2',maxStimulusChars:480,maxSentences:10,maxFacts:7,allowedReasoning:['single-information-retrieval','single-step-comprehension','appropriate-response'],distractorSimilarity:'high'},
};

export interface ItemBlueprint{
  blueprintVersion:typeof ITEM_BLUEPRINT_VERSION;id:string;level:Question['level'];section:SectionId;category:string;
  canDo:string;topic:string;knowledgeUnitIds:string[];targetKnowledge:string[];taskIntent:string;
  stimulusRequirements:{format:StimulusFormat;maxLength:number;requiredFacts:string[];learnerVisibleContext:string[]};
  reasoningPattern:ReasoningPattern;
  answerContract:{oneCorrectAnswer:true;answerSource:'explicit_fact'|'target_knowledge'|'communicative_intent';correctValue:string;evidenceKey:string};
  distractorContract:{count:3;sameSemanticType:true;source:'nearby_or_plausible_information'|'learner_error';forbidNonsense:true;misconceptions:string[]};
  templateId:string;generationSeed:string;
}

export interface CoreItemDraft{
  instruction:string;stimulus?:string;audioScript?:string;prompt:string;correctAnswer:string;
  answerEvidence:string;explanationVi:string;tags:string[];
}
export interface DistractorDraft{choices:string[];correctAnswer:string;}
export interface BlueprintGenerationProvider{
  name:string;model?:string;promptVersion:string;
  generateCore(blueprint:ItemBlueprint,attempt:number):Promise<CoreItemDraft>;
  generateDistractors(blueprint:ItemBlueprint,core:CoreItemDraft,attempt:number):Promise<DistractorDraft>;
}
export type GeneratorPreflightCode=
  'BLUEPRINT_METADATA_MUTATION'|'INVALID_LEVEL_CATEGORY'|'MISSING_REQUIRED_METADATA'|'MISSING_ANSWER'|'INVALID_ANSWER_INDEX'|
  'DUPLICATE_CHOICE'|'ANSWER_DUPLICATED'|'NEAR_IDENTICAL_OPTIONS'|'ANSWER_LEAKAGE'|'LISTENING_SCRIPT_MISSING'|
  'LISTENING_ANSWER_NOT_IN_SCRIPT'|'READING_STIMULUS_MISSING'|'STIMULUS_TOO_LONG'|'INVALID_QUESTION_TYPE'|'MALFORMED_JAPANESE_STRUCTURE';
export interface GeneratorPreflightResult{version:typeof GENERATOR_PREFLIGHT_VERSION;passed:boolean;issues:Array<{code:GeneratorPreflightCode;evidence:string}>;}
export interface GeneratedBlueprintItem{blueprint:ItemBlueprint;question:QuestionRecord;audioScript?:string;generation:{architecture:typeof QUESTION_GENERATOR_V2_VERSION;provider:string;model?:string;promptVersion:string;attempts:number};preflight:GeneratorPreflightResult;status:'REVIEW';}
export class GenerationFailedError extends Error{constructor(public blueprintId:string,public attempts:number,public failures:GeneratorPreflightResult[]){super(`GENERATION_FAILED: ${blueprintId} failed preflight after ${attempts} attempts.`);this.name='GenerationFailedError';}}

const normalize=(value:string)=>value.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'').toLowerCase();
const unique=(values:string[])=>new Set(values.map(normalize)).size===values.length;
function overlap(a:string,b:string){const aa=new Set([...normalize(a)]),bb=new Set([...normalize(b)]);const union=new Set([...aa,...bb]);return union.size?[...aa].filter(x=>bb.has(x)).length/union.size:1;}
function sentenceCount(text:string){return text.split(/[。！？?!\n]+/u).filter(Boolean).length;}

export function rotateChoices(choices:string[],answer:number,shift:number){
  const safe=((shift%choices.length)+choices.length)%choices.length;
  const rotated=choices.map((_,index)=>choices[(index-safe+choices.length)%choices.length]);
  return {choices:rotated,answer:(answer+safe)%choices.length};
}

export function runGeneratorPreflight(blueprint:ItemBlueprint,question:QuestionRecord,audioScript?:string):GeneratorPreflightResult{
  const issues:GeneratorPreflightResult['issues']=[];const add=(code:GeneratorPreflightCode,evidence:string)=>issues.push({code,evidence});
  if(question.level!==blueprint.level||question.section!==blueprint.section||!question.tags.includes(`category:${blueprint.category}`)||!question.tags.includes(`can-do:${blueprint.canDo}`))add('BLUEPRINT_METADATA_MUTATION','Question metadata differs from the immutable blueprint.');
  if(!isCategoryForSection(blueprint.section,blueprint.category))add('INVALID_LEVEL_CATEGORY',`${blueprint.section}/${blueprint.category}`);
  if(!blueprint.canDo.trim()||!blueprint.topic.trim()||!blueprint.knowledgeUnitIds.length||!blueprint.targetKnowledge.length)add('MISSING_REQUIRED_METADATA','Blueprint lacks Can-do, topic, KnowledgeUnit, or target knowledge.');
  if(question.choices.length!==4||!Number.isInteger(question.answer)||question.answer<0||question.answer>=question.choices.length)add('INVALID_ANSWER_INDEX',String(question.answer));
  const answer=question.choices[question.answer];if(!answer?.trim())add('MISSING_ANSWER','Declared answer is empty or absent.');
  if(!unique(question.choices))add('DUPLICATE_CHOICE','Two normalized choices are identical.');
  if(answer&&question.choices.filter(choice=>normalize(choice)===normalize(answer)).length!==1)add('ANSWER_DUPLICATED','The keyed answer occurs more than once.');
  for(let i=0;i<question.choices.length;i++)for(let j=i+1;j<question.choices.length;j++)if(Math.min(normalize(question.choices[i]).length,normalize(question.choices[j]).length)>=8&&normalize(question.choices[i])!==normalize(question.choices[j])&&overlap(question.choices[i],question.choices[j])>.94)add('NEAR_IDENTICAL_OPTIONS',`Choices ${i} and ${j} are near-identical.`);
  const expectedType=blueprint.section==='listening'?'audio_choice':'choice';if(question.type!==expectedType)add('INVALID_QUESTION_TYPE',`${question.type} != ${expectedType}`);
  if(blueprint.section==='listening'){
    if(!audioScript?.trim())add('LISTENING_SCRIPT_MISSING','Listening has no script.');
    if(answer&&audioScript&&!audioScript.includes(blueprint.answerContract.evidenceKey)&&!audioScript.includes(answer))add('LISTENING_ANSWER_NOT_IN_SCRIPT','Neither the evidence key nor answer occurs in the script.');
    if(answer&&question.prompt.includes(answer))add('ANSWER_LEAKAGE','The visible listening prompt contains the keyed answer.');
  }
  if(blueprint.section==='reading'&&!question.prompt.includes('\n\n'))add('READING_STIMULUS_MISSING','Reading requires a separated stimulus and question.');
  const stimulus=audioScript||(blueprint.section==='reading'?question.prompt.split('\n\n')[0]:question.prompt);if(stimulus.length>blueprint.stimulusRequirements.maxLength||stimulus.length>LEVEL_GENERATION_CONTRACTS[blueprint.level].maxStimulusChars)add('STIMULUS_TOO_LONG',`${stimulus.length} characters.`);
  if(sentenceCount(stimulus)>LEVEL_GENERATION_CONTRACTS[blueprint.level].maxSentences)add('STIMULUS_TOO_LONG',`${sentenceCount(stimulus)} sentence/line segments.`);
  if(/私がは|をを|にを|食べるを|ますでした/.test([question.prompt,...question.choices,audioScript||''].join('\n')))add('MALFORMED_JAPANESE_STRUCTURE','Known malformed Japanese pattern detected.');
  return {version:GENERATOR_PREFLIGHT_VERSION,passed:issues.length===0,issues};
}

export async function generateBlueprintItem(blueprint:ItemBlueprint,provider:BlueprintGenerationProvider,options:{maxAttempts?:number;choiceRotation?:number;id?:string}={}):Promise<GeneratedBlueprintItem>{
  const maxAttempts=Math.max(1,Math.min(GENERATOR_MAX_ATTEMPTS,options.maxAttempts??GENERATOR_MAX_ATTEMPTS));const failures:GeneratorPreflightResult[]=[];
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    const core=await provider.generateCore(structuredClone(blueprint),attempt);
    if(core.correctAnswer!==blueprint.answerContract.correctValue)failures.push({version:GENERATOR_PREFLIGHT_VERSION,passed:false,issues:[{code:'BLUEPRINT_METADATA_MUTATION',evidence:'Provider changed the blueprint answer contract.'}]});
    else{
      const distractors=await provider.generateDistractors(structuredClone(blueprint),structuredClone(core),attempt);
      const raw=[distractors.correctAnswer,...distractors.choices];const rotated=rotateChoices(raw,0,options.choiceRotation??(Number.parseInt(blueprint.generationSeed,36)||0));
      const now=new Date().toISOString();const prompt=blueprint.section==='reading'?`${core.stimulus||''}\n\n${core.prompt}`:core.prompt;
      const question:QuestionRecord={id:options.id||`V2-${blueprint.id}`,section:blueprint.section,type:blueprint.section==='listening'?'audio_choice':'choice',level:blueprint.level,instruction:core.instruction,prompt,choices:rotated.choices,answer:rotated.answer,explanationVi:core.explanationVi,tags:[`generator:${QUESTION_GENERATOR_V2_VERSION}`,`blueprint:${blueprint.id}`,`category:${blueprint.category}`,`can-do:${blueprint.canDo}`,`topic:${blueprint.topic}`,...blueprint.knowledgeUnitIds.map(id=>`knowledge:${id}`),...core.tags],version:1,status:'review',source:'ai',createdAt:now,updatedAt:now};
      const preflight=runGeneratorPreflight(blueprint,question,core.audioScript);
      if(preflight.passed)return {blueprint:structuredClone(blueprint),question,audioScript:core.audioScript,generation:{architecture:QUESTION_GENERATOR_V2_VERSION,provider:provider.name,model:provider.model,promptVersion:provider.promptVersion,attempts:attempt},preflight,status:'REVIEW'};
      failures.push(preflight);
    }
  }
  throw new GenerationFailedError(blueprint.id,maxAttempts,failures);
}

export function buildItemBlueprintFromPlan(item:QuestionPlanItem,units:KnowledgeUnit[],ordinal=0):ItemBlueprint{
  const ids=item.knowledgeUnitIds||[item.knowledgeUnitId];const selected=units.filter(unit=>ids.includes(unit.id));
  if(selected.length!==ids.length||selected.some(unit=>unit.status!=='approved'))throw new Error('KNOWLEDGE_NOT_APPROVED');
  const knowledge=Array.from(new Set(selected.flatMap(unit=>[...unit.vocabulary,...(unit.kanji||[]),...unit.grammar,...unit.expressions,...unit.keyKnowledge]).filter(Boolean)));
  const format:StimulusFormat=item.section==='listening'?(item.category==='announcement_instruction'?'announcement':'dialogue'):item.section==='reading'?(item.category==='information_search'?'schedule':'notice'):item.section==='conversation_expression'?'dialogue':item.category==='word_usage'?'sentence':'isolated-term';
  const reasoningPattern:ReasoningPattern=item.section==='conversation_expression'?'appropriate-response':item.section==='reading'?'single-information-retrieval':item.section==='listening'?'single-step-comprehension':'direct-recognition';
  const contract=LEVEL_GENERATION_CONTRACTS[item.level];const correctValue=knowledge[ordinal%Math.max(1,knowledge.length)]||selected[0].canDo;
  const misconceptions=Array.from(new Set([...knowledge.filter(value=>value!==correctValue),'別の答えA','別の答えB','別の答えC'])).slice(0,6);
  return {blueprintVersion:ITEM_BLUEPRINT_VERSION,id:`${item.id}-BP-${ordinal+1}`,level:item.level,section:item.section,category:item.category,canDo:item.canDo,topic:item.topic,knowledgeUnitIds:ids,targetKnowledge:knowledge.slice(0,12),taskIntent:item.objective,stimulusRequirements:{format,maxLength:contract.maxStimulusChars,requiredFacts:[`target=${correctValue}`],learnerVisibleContext:[selected.map(unit=>unit.situation).filter(Boolean).join(' / ')]},reasoningPattern,answerContract:{oneCorrectAnswer:true,answerSource:item.section==='conversation_expression'?'communicative_intent':item.section==='script_vocabulary'?'target_knowledge':'explicit_fact',correctValue,evidenceKey:correctValue},distractorContract:{count:3,sameSemanticType:true,source:item.section==='script_vocabulary'||item.section==='conversation_expression'?'learner_error':'nearby_or_plausible_information',forbidNonsense:true,misconceptions},templateId:`${item.section}:${item.category}`,generationSeed:`${item.id}:${ordinal}`};
}
