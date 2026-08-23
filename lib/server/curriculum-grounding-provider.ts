import {CURRICULUM_GROUNDING_PROMPT_VERSION,CURRICULUM_GROUNDING_SYSTEM_PROMPT_V1,CurriculumGroundingError,validateCurriculumGroundingAnalysis,type ApprovedKnowledgeUnitEvidence,type CurriculumGroundingAnalysis,type CurriculumGroundingInput,type CurriculumKnowledgeAnalysisItem,type CurriculumKnowledgeSource,type CurriculumKnowledgeType,type CurriculumSupport} from './curriculum-grounding';

export interface CurriculumGroundingProvider{name:string;model?:string;evaluate(input:CurriculumGroundingInput):Promise<CurriculumGroundingAnalysis>}

const normalize=(value:string)=>value.normalize('NFKC').replace(/[〜～]/g,'~').replace(/\s+/g,'').toLowerCase();
function fields(unit:ApprovedKnowledgeUnitEvidence,type:CurriculumKnowledgeType){return type==='GRAMMAR'?unit.grammar:type==='VOCABULARY'?unit.vocabulary:type==='KANJI'?unit.kanji:type==='EXPRESSION'?unit.expressions:type==='PRAGMATIC_FUNCTION'||type==='TASK_STRATEGY'?[unit.canDo,...unit.keyKnowledge]:[unit.canDo,...unit.keyKnowledge,...unit.vocabulary,...unit.grammar,...unit.expressions]}
function supportFor(value:string,type:CurriculumKnowledgeType,units:ApprovedKnowledgeUnitEvidence[]):{support:CurriculumSupport;units:ApprovedKnowledgeUnitEvidence[]}{const target=normalize(value);const matches=units.filter(unit=>fields(unit,type).some(entry=>{const candidate=normalize(entry);return candidate===target||candidate.includes(target)||target.includes(candidate)}));return {support:matches.length?'SUPPORTED':'UNSUPPORTED',units:matches}}
function locate(value:string,input:CurriculumGroundingInput):{source:CurriculumKnowledgeSource;choiceIndex?:number}{if(input.audioScript?.includes(value))return {source:'AUDIO_SCRIPT'};if(input.stem.includes(value))return {source:input.section==='reading'?'PASSAGE':'STEM'};const choiceIndex=input.choices.findIndex(choice=>choice.includes(value));return choiceIndex>=0?{source:'CHOICE',choiceIndex}:{source:'TASK'}}
const externalKnowledgePattern=/道路交通法|労働基準法|日本の法律では|法令により/;
function hiddenExternalKnowledge(input:CurriculumGroundingInput):string|undefined{
  let detected:string|undefined;
  for(const context of [input.instruction,input.stem,input.audioScript||'']){
    const marker=context.match(externalKnowledgePattern)?.[0];if(!marker)continue;
    detected=detected||marker;
    const sentence=context.split(/[。！？?!]/).find(part=>part.includes(marker))?.trim()||'';
    const asksForRule=/(?:どれ|何|どちら|正しい|知っていますか|できますか|ですか|ますか|でしょうか)/.test(sentence);
    const suppliesRule=!asksForRule&&/(?:です|ます|ません|ない|禁止|必要|義務|決まって|定め)/.test(sentence);
    if(suppliesRule)return undefined;
  }
  return detected;
}

export class MockCurriculumGroundingProvider implements CurriculumGroundingProvider{
  name='mock-curriculum-grounding';model='deterministic-knowledge-boundary-v2';
  async evaluate(input:CurriculumGroundingInput):Promise<CurriculumGroundingAnalysis>{
    const text=[input.instruction,input.stem,input.audioScript||'',...input.choices].join('\n');const items:CurriculumKnowledgeAnalysisItem[]=[];const seen=new Set<string>();
    const add=(type:CurriculumKnowledgeType,value:string,role:'REQUIRED'|'SUPPORTING'|'INCIDENTAL',location=locate(value,input),forcedSupport?:CurriculumSupport)=>{const key=`${type}\u0000${normalize(value)}\u0000${role}\u0000${location.source}\u0000${location.choiceIndex??''}`;if(seen.has(key))return;seen.add(key);const mapped=supportFor(value,type,input.approvedKnowledgeUnits);const support=forcedSupport||mapped.support;const units=support==='UNSUPPORTED'?[]:mapped.units;items.push({type,value,role,source:location.source,...(location.choiceIndex!==undefined?{choiceIndex:location.choiceIndex}:{}),support,knowledgeUnitIds:units.map(unit=>unit.id),sourceChunkIds:Array.from(new Set(units.flatMap(unit=>unit.sourceChunkIds))).filter(id=>input.sourceChunks.some(chunk=>chunk.id===id)),evidence:units.length?`Approved curriculum support: ${units.map(unit=>unit.id).join(', ')}.`:role==='INCIDENTAL'?'Novel surface detail does not determine the answer.':'No supplied approved KnowledgeUnit supports this item.',reason:units.length?'A matching or semantically containing curriculum entry was supplied.':role==='INCIDENTAL'?'Names, numbers, and dates are allowed when they are not required to solve.':'The knowledge is present in learner-visible content but no approved support was found.',contradictedByCurriculum:false});};
    const grammarPatterns=[{value:'～ざるを得ない',pattern:/ざるを得(?:ない|ません|なかった)/},{value:'～てもいい',pattern:/てもいい/},{value:'～ながら',pattern:/ながら/},{value:'～なければならない',pattern:/なければならない/},{value:'～ません',pattern:/ません/},{value:'～ます',pattern:/ます/}];for(const grammar of grammarPatterns){const matched=text.match(grammar.pattern)?.[0];if(matched){const location=locate(matched,input);add('GRAMMAR',grammar.value,location.source==='CHOICE'?'SUPPORTING':'REQUIRED',location);}}
    for(const unit of input.approvedKnowledgeUnits){for(const [type,values] of [['VOCABULARY',unit.vocabulary],['KANJI',unit.kanji],['EXPRESSION',unit.expressions],['GRAMMAR',unit.grammar]] as Array<[CurriculumKnowledgeType,string[]]>)for(const value of values)if(value&&text.includes(value)){const location=locate(value,input);add(type,value,location.source==='CHOICE'?'SUPPORTING':'REQUIRED',location);}}
    for(const match of text.matchAll(/「([^」]{2,})」/gu)){const value=match[1];const type:CurriculumKnowledgeType=/読み方|どう読み|何と読み/.test(text)&&/[\p{Script=Han}]/u.test(value)?'KANJI':'EXPRESSION';if(supportFor(value,type,input.approvedKnowledgeUnits).support==='UNSUPPORTED'){const location=locate(value,input);add(type,value,location.source==='CHOICE'?'SUPPORTING':'REQUIRED',location,'AMBIGUOUS_SUPPORT');}}
    for(const match of text.matchAll(/[\p{Script=Han}]{2,}/gu)){const value=match[0];if(text.includes(`${value}さん`)||text.includes(`${value}さま`))continue;const exact=input.approvedKnowledgeUnits.some(unit=>[...unit.vocabulary,...unit.kanji].some(entry=>normalize(entry)===normalize(value)));if(!exact){const location=locate(value,input);add('VOCABULARY',value,location.source==='CHOICE'?'SUPPORTING':'REQUIRED',location,'AMBIGUOUS_SUPPORT');}}
    for(const match of text.matchAll(/([\p{Script=Han}]{1,4})(?:さん|さま)/gu))add('OTHER',`${match[1]}さん`,'INCIDENTAL',{source:'STEM'},'UNSUPPORTED');
    for(const match of text.matchAll(/(?:\d{1,4}|[一二三四五六七八九十百千]+)(?:時|分|円|個|つ|月|日|年)/gu))add('OTHER',match[0],'INCIDENTAL',locate(match[0],input),'UNSUPPORTED');
    const external=hiddenExternalKnowledge(input);if(external)add('CULTURAL_BACKGROUND',external,'REQUIRED',{source:'BACKGROUND'},'UNSUPPORTED');
    if(!items.some(item=>item.role==='REQUIRED')){const value=input.targetCanDo?.trim()||`Understand the learner-visible ${input.section} task`;const mapped=supportFor(value,'TASK_STRATEGY',input.approvedKnowledgeUnits);add('TASK_STRATEGY',value,'REQUIRED',{source:'TASK'},mapped.support);}
    return validateCurriculumGroundingAnalysis({qaVersion:CURRICULUM_GROUNDING_PROMPT_VERSION,questionId:input.questionId,confidence:'LOW',knowledgeAnalysis:items},input);
  }
}

export class HttpCurriculumGroundingProvider implements CurriculumGroundingProvider{
  name='http-curriculum-grounding';model=process.env.CURRICULUM_GROUNDING_MODEL||process.env.AI_QA_MODEL||'external';
  async evaluate(input:CurriculumGroundingInput):Promise<CurriculumGroundingAnalysis>{
    const endpoint=process.env.CURRICULUM_GROUNDING_ENDPOINT||process.env.AI_QA_ENDPOINT;if(!endpoint)throw new CurriculumGroundingError('CURRICULUM_GROUNDING_PROVIDER_FAILURE','CURRICULUM_GROUNDING_ENDPOINT or AI_QA_ENDPOINT is required.');
    let response:Response;try{response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',...(process.env.CURRICULUM_GROUNDING_API_KEY||process.env.AI_QA_API_KEY?{authorization:`Bearer ${process.env.CURRICULUM_GROUNDING_API_KEY||process.env.AI_QA_API_KEY}`}:{})},body:JSON.stringify({task:'jft_curriculum_grounding',promptVersion:CURRICULUM_GROUNDING_PROMPT_VERSION,systemInstruction:CURRICULUM_GROUNDING_SYSTEM_PROMPT_V1,input})});}catch(error){throw new CurriculumGroundingError('CURRICULUM_GROUNDING_PROVIDER_FAILURE',error instanceof Error?error.message:String(error));}
    if(!response.ok)throw new CurriculumGroundingError('CURRICULUM_GROUNDING_PROVIDER_FAILURE',`Curriculum Grounding provider failed: ${response.status}`);let json:unknown;try{json=await response.json()}catch{throw new CurriculumGroundingError('CURRICULUM_GROUNDING_INVALID_OUTPUT','Curriculum Grounding response is not valid JSON.')};return validateCurriculumGroundingAnalysis(json,input);
  }
}

export function getCurriculumGroundingProvider():CurriculumGroundingProvider{return process.env.CURRICULUM_GROUNDING_PROVIDER==='http'?new HttpCurriculumGroundingProvider():new MockCurriculumGroundingProvider()}
