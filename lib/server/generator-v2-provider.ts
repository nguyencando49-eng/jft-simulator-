import {AZURE_OPENAI_PROVIDER,azureOpenAiConfig,requestAzureOpenAiJson} from './azure-openai';
import type {BlueprintGenerationProvider,CoreItemDraft,DistractorDraft,ItemBlueprint} from './generator-v2';

export const GENERATOR_V2_CORE_PROMPT_VERSION='JFT_GENERATOR_V2_CORE_V1';
export const GENERATOR_V2_DISTRACTOR_PROMPT_VERSION='JFT_GENERATOR_V2_DISTRACTOR_V1';
export const GENERATOR_V2_PROMPT_VERSION=`${GENERATOR_V2_CORE_PROMPT_VERSION}+${GENERATOR_V2_DISTRACTOR_PROMPT_VERSION}`;

const CORE_SYSTEM_PROMPT=`You are the stimulus-and-question stage of a curriculum-grounded Japanese practice generator. The ItemBlueprint is immutable. Create only the learner-visible stimulus/script, prompt, exact contracted correct answer, evidence, Vietnamese explanation and tags. Do not create distractors. Do not change level, section, category, Can-do, task type, target knowledge or correctValue. Use natural practical Japanese and obey the level and length contract. Return JSON only.`;
const DISTRACTOR_SYSTEM_PROMPT=`You are the independent distractor stage of a Japanese practice generator. The ItemBlueprint and accepted core are immutable. Return exactly three distractors plus the unchanged correct answer. Every distractor must be natural, the same semantic/grammatical answer type, plausible as a learner error, wrong in this context, distinct in meaning, and free of answer leakage. Do not rewrite the stimulus, prompt or correct answer. Return JSON only.`;

function facts(blueprint:ItemBlueprint){return Object.fromEntries(blueprint.stimulusRequirements.requiredFacts.map(entry=>{const at=entry.indexOf('=');return at<0?[entry,'']:[entry.slice(0,at),entry.slice(at+1)];}));}
function required(value:Record<string,string>,key:string,blueprint:ItemBlueprint){const found=value[key]?.trim();if(!found)throw new Error(`Blueprint ${blueprint.id} requires fact ${key}.`);return found;}

export class DeterministicBlueprintGenerationProvider implements BlueprintGenerationProvider{
  name='deterministic-blueprint-v2';model='contract-compiler-v1';promptVersion=GENERATOR_V2_PROMPT_VERSION;
  async generateCore(blueprint:ItemBlueprint):Promise<CoreItemDraft>{
    const f=facts(blueprint);const tags=[blueprint.templateId,blueprint.reasoningPattern];const target=blueprint.targetKnowledge[0]||blueprint.answerContract.correctValue;
    if(blueprint.section==='script_vocabulary'){
      const term=f.term?.trim()||target;
      if(blueprint.category==='kanji_reading')return {instruction:'ことばの よみかたを えらんでください。',prompt:`「${term}」の よみかたは どれですか。`,correctAnswer:blueprint.answerContract.correctValue,answerEvidence:`${term}=${blueprint.answerContract.correctValue}`,explanationVi:`「${term}」 được đọc là 「${blueprint.answerContract.correctValue}」.`,tags};
      if(blueprint.category==='word_meaning')return {instruction:'ことばの いみを えらんでください。',prompt:`「${term}」は どんな いみですか。`,correctAnswer:blueprint.answerContract.correctValue,answerEvidence:`${term}=${blueprint.answerContract.correctValue}`,explanationVi:`Trong ngữ cảnh này, 「${term}」 có nghĩa là “${blueprint.answerContract.correctValue}”.`,tags};
      const sentence=required(f,'sentence',blueprint);
      const instruction=blueprint.category==='kanji_meaning_usage'?'＿＿＿に 入る 漢字を えらんでください。':'＿＿＿に 入る ことばを えらんでください。';
      return {instruction,prompt:sentence,correctAnswer:blueprint.answerContract.correctValue,answerEvidence:f.rule||blueprint.taskIntent,explanationVi:f.explanationVi||`Trong câu này, 「${blueprint.answerContract.correctValue}」 phù hợp nhất với chỗ trống.`,tags};
    }
    if(blueprint.section==='conversation_expression')return {instruction:'会話を完成させるために、いちばんいいものを一つ選んでください。',prompt:`${f.context||'職場で話しています。'}\n${f.turnA||`A：すみません。${target}について教えてください。`}\n${f.turnBPrefix||'B：＿＿＿＿＿＿。'}`,correctAnswer:blueprint.answerContract.correctValue,answerEvidence:blueprint.taskIntent,explanationVi:f.explanationVi||'Đáp án thực hiện đúng ý định giao tiếp được quy định trong blueprint.',tags};
    if(blueprint.section==='listening')return {instruction:'音声を聞いて、いちばんいい答えを一つ選んでください。',prompt:f.question||'話している人は、何をしますか。',audioScript:f.script||`${blueprint.answerContract.evidenceKey}。`,correctAnswer:blueprint.answerContract.correctValue,answerEvidence:blueprint.answerContract.evidenceKey,explanationVi:f.explanationVi||'Thông tin quyết định đáp án xuất hiện trực tiếp trong phần nghe.',tags};
    return {instruction:'文章を読んで、質問に答えてください。',stimulus:f.stimulus||`【お知らせ】\n${blueprint.answerContract.evidenceKey}。`,prompt:f.question||'正しいものはどれですか。',correctAnswer:blueprint.answerContract.correctValue,answerEvidence:blueprint.answerContract.evidenceKey,explanationVi:f.explanationVi||'Thông tin quyết định đáp án xuất hiện trực tiếp trong văn bản.',tags};
  }
  async generateDistractors(blueprint:ItemBlueprint,core:CoreItemDraft):Promise<DistractorDraft>{
    if(core.correctAnswer!==blueprint.answerContract.correctValue)throw new Error('Core changed the contracted answer.');
    if(blueprint.distractorContract.misconceptions.length<3)throw new Error(`Blueprint ${blueprint.id} requires at least three named misconceptions.`);
    return {correctAnswer:core.correctAnswer,choices:blueprint.distractorContract.misconceptions.slice(0,3)};
  }
}

function validateCore(value:unknown,blueprint:ItemBlueprint):CoreItemDraft{
  if(!value||typeof value!=='object')throw new Error('Generator V2 core output is not an object.');const x=value as Partial<CoreItemDraft>;
  if(typeof x.instruction!=='string'||typeof x.prompt!=='string'||typeof x.correctAnswer!=='string'||typeof x.answerEvidence!=='string'||typeof x.explanationVi!=='string'||!Array.isArray(x.tags)||x.tags.some(tag=>typeof tag!=='string'))throw new Error('Generator V2 core output is invalid.');
  if(x.correctAnswer!==blueprint.answerContract.correctValue)throw new Error('Generator V2 attempted to mutate correctValue.');
  if(blueprint.section==='listening'&&typeof x.audioScript!=='string')throw new Error('Generator V2 listening core is missing audioScript.');
  if(blueprint.section==='reading'&&typeof x.stimulus!=='string')throw new Error('Generator V2 reading core is missing stimulus.');
  return x as CoreItemDraft;
}
function validateDistractors(value:unknown,blueprint:ItemBlueprint):DistractorDraft{
  if(!value||typeof value!=='object')throw new Error('Generator V2 distractor output is not an object.');const x=value as Partial<DistractorDraft>;
  if(x.correctAnswer!==blueprint.answerContract.correctValue||!Array.isArray(x.choices)||x.choices.length!==3||x.choices.some(choice=>typeof choice!=='string'||!choice.trim()))throw new Error('Generator V2 distractor output violates the answer/distractor contract.');
  return x as DistractorDraft;
}

export class AzureBlueprintGenerationProvider implements BlueprintGenerationProvider{
  name=AZURE_OPENAI_PROVIDER;model=azureOpenAiConfig('factory').deployment||'not-configured';promptVersion=GENERATOR_V2_PROMPT_VERSION;
  async generateCore(blueprint:ItemBlueprint,attempt:number){const config=azureOpenAiConfig('factory');const value=await requestAzureOpenAiJson<unknown>({...config,systemPrompt:CORE_SYSTEM_PROMPT,input:{task:'jft_generator_v2_core',promptVersion:GENERATOR_V2_CORE_PROMPT_VERSION,attempt,blueprint},maxOutputTokens:2200});return validateCore(value,blueprint);}
  async generateDistractors(blueprint:ItemBlueprint,core:CoreItemDraft,attempt:number){const config=azureOpenAiConfig('factory');const value=await requestAzureOpenAiJson<unknown>({...config,systemPrompt:DISTRACTOR_SYSTEM_PROMPT,input:{task:'jft_generator_v2_distractors',promptVersion:GENERATOR_V2_DISTRACTOR_PROMPT_VERSION,attempt,blueprint,core},maxOutputTokens:1600});return validateDistractors(value,blueprint);}
}

export function getBlueprintGenerationProvider():BlueprintGenerationProvider{return process.env.AI_FACTORY_PROVIDER===AZURE_OPENAI_PROVIDER?new AzureBlueprintGenerationProvider():new DeterministicBlueprintGenerationProvider();}
