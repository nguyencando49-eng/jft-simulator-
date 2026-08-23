import { FactoryRequest, GeneratedQuestionDraft } from './factory-domain';
import { AZURE_OPENAI_PROVIDER, azureOpenAiConfig, requestAzureOpenAiJson } from './azure-openai';

export const JFT_FACTORY_AZURE_OPENAI_PROMPT_VERSION='JFT_FACTORY_AZURE_OPENAI_V1';
const AZURE_FACTORY_SYSTEM_PROMPT=`You are a Japanese-language assessment author for an unofficial JFT-Basic practice simulator.
Create original, practical A1/A2.1/A2.2 multiple-choice questions from the supplied brief. Never copy official questions or claim official calibration.
Return JSON only with this exact top-level shape: {"questions":[...]}. Each question must contain:
instruction (Japanese string), prompt (Japanese string), choices (exactly four Japanese strings), answer (zero-based integer index), explanationVi (concise Vietnamese explanation), tags (string array), and optional audioScript (Japanese string).
There must be exactly one defensible answer. Distractors must be plausible and the same semantic or grammatical type. For listening, the answer-discriminating information must occur in audioScript and must not be revealed by visible text. For non-listening items, omit audioScript. Obey the requested count, level, section, category, Can-do, topic, difficulty and source originality rules.`;

export interface FactoryProvider {
  name: string;
  model?: string;
  generate(input: FactoryRequest): Promise<GeneratedQuestionDraft[]>;
}

function mockBySection(input: FactoryRequest, i:number): GeneratedQuestionDraft {
  const topic=input.topic.trim() || '生活';
  const suffix=i+1;
  const verbs=[['聞きました','聞きます','聞いて','聞く'],['話しました','話します','話して','話す'],['書きました','書きます','書いて','書く'],['読みました','読みます','読んで','読む']];
  const v=verbs[i%verbs.length];
  if(input.section==='listening') {
    const scenes=[
      {prompt:`${topic}について、話している人はまず何をしますか。`,choices:['電話をします','メモを書きます','家に帰ります','少し待ちます'],answer:1,script:`すみません。${topic}のことですが、まずメモを書いてから、担当の人に電話してください。`},
      {prompt:`${topic}の予定は何時からですか。`,choices:['9時','10時','11時','12時'],answer:1,script:`${topic}の予定ですが、朝10時から始めます。9時50分までに来てください。`},
      {prompt:`${topic}のあと、女の人はどこへ行きますか。`,choices:['駅','事務所','食堂','病院'],answer:2,script:`${topic}が終わったら、食堂で田中さんと昼ご飯を食べます。`},
      {prompt:`${topic}について、男の人は何を持ってきますか。`,choices:['かさ','資料','薬','かばん'],answer:1,script:`明日の${topic}には、昨日渡した資料を持ってきてください。`}
    ]; const x=scenes[i%scenes.length]; return {instruction:'音声を聞いて、いちばんいい答えを一つ選んでください。',prompt:`${x.prompt}（${suffix}）`,choices:x.choices,answer:x.answer,explanationVi:`Audio script cho biết trực tiếp thông tin cần chọn trong câu nghe mẫu #${suffix}.`,tags:[topic,input.canDo||'listening',input.level].filter(Boolean),audioScript:x.script};
  }
  if(input.section==='reading') return {
    instruction:'文章を読んで、質問に答えてください。',
    prompt:`【お知らせ ${suffix}】${topic}は午後3時からです。10分前までに来てください。何時までに行きますか。`,
    choices:['2時40分','2時50分','3時00分','3時10分'],
    answer:1,
    explanationVi:'Thông báo yêu cầu đến trước 10 phút so với 3 giờ, nên đáp án là 2:50.',
    tags:[topic,input.canDo||'notice',input.level].filter(Boolean)
  };
  if(input.section==='conversation_expression') return {
    instruction:'会話を完成させるために、いちばんいいものを一つ選んでください。',
    prompt:`A: ${topic}について教えてもらえますか。\nB: ＿＿＿＿＿＿。（会話 ${suffix}）`,
    choices:['はい、いいですよ','いいえ、食べました','三時です','雨でした'],
    answer:0,
    explanationVi:'Người B phản hồi một lời nhờ giải thích, nên 「はい、いいですよ」 phù hợp nhất.',
    tags:[topic,input.canDo||'kaiwa',input.level].filter(Boolean)
  };
  return {
    instruction:'（　）に入るいちばんいいものを一つ選んでください。',
    prompt:`きのう、${topic}について先生に（　）。（${suffix}）`,
    choices:v,
    answer:0,
    explanationVi:`「きのう」 cho biết hành động trong quá khứ, vì vậy dùng dạng quá khứ 「${v[0]}」.`,
    tags:[topic,input.canDo||'vocabulary',input.level].filter(Boolean)
  };
}

class MockFactoryProvider implements FactoryProvider {
  name='mock'; model='deterministic-v1';
  async generate(input:FactoryRequest){ return Array.from({length:input.count},(_,i)=>mockBySection(input,i)); }
}

class HttpFactoryProvider implements FactoryProvider {
  name='http'; model=process.env.AI_FACTORY_MODEL || 'external';
  async generate(input:FactoryRequest){
    const endpoint=process.env.AI_FACTORY_ENDPOINT;
    if(!endpoint) throw new Error('AI_FACTORY_ENDPOINT is required for http provider.');
    const res=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',...(process.env.AI_FACTORY_API_KEY?{authorization:`Bearer ${process.env.AI_FACTORY_API_KEY}`}:{})},body:JSON.stringify({task:'jft_question_generation',promptVersion:'v5.1',input})});
    if(!res.ok) throw new Error(`Factory provider failed: ${res.status}`);
    const json=await res.json() as {questions?:GeneratedQuestionDraft[]};
    if(!Array.isArray(json.questions)) throw new Error('Factory provider response must contain questions[].');
    return json.questions.slice(0,input.count);
  }
}

export class AzureOpenAiFactoryProvider implements FactoryProvider {
  name=AZURE_OPENAI_PROVIDER;
  model=azureOpenAiConfig('factory').deployment || 'not-configured';
  async generate(input:FactoryRequest){
    const config=azureOpenAiConfig('factory');
    const json=await requestAzureOpenAiJson<{questions?:unknown[]}>({...config,systemPrompt:AZURE_FACTORY_SYSTEM_PROMPT,input:{task:'jft_question_generation',promptVersion:JFT_FACTORY_AZURE_OPENAI_PROMPT_VERSION,input},maxOutputTokens:Math.min(12000,Math.max(2500,input.count*900))});
    if(!Array.isArray(json.questions)) throw new Error('Azure OpenAI Factory response must contain questions[].');
    const questions=json.questions.slice(0,input.count).map((value,index)=>validateDraft(value,index,input));
    if(questions.length!==input.count) throw new Error(`Azure OpenAI Factory returned ${questions.length}/${input.count} requested questions.`);
    return questions;
  }
}

function validateDraft(value:unknown,index:number,input:FactoryRequest):GeneratedQuestionDraft{
  if(!value||typeof value!=='object')throw new Error(`Azure OpenAI question ${index+1} is not an object.`);
  const item=value as Partial<GeneratedQuestionDraft>;
  if(typeof item.instruction!=='string'||!item.instruction.trim()||typeof item.prompt!=='string'||!item.prompt.trim())throw new Error(`Azure OpenAI question ${index+1} is missing instruction or prompt.`);
  if(!Array.isArray(item.choices)||item.choices.length!==4||item.choices.some(choice=>typeof choice!=='string'||!choice.trim()))throw new Error(`Azure OpenAI question ${index+1} must contain four non-empty choices.`);
  if(!Number.isInteger(item.answer)||Number(item.answer)<0||Number(item.answer)>=item.choices.length)throw new Error(`Azure OpenAI question ${index+1} has an invalid answer index.`);
  if(typeof item.explanationVi!=='string'||!Array.isArray(item.tags)||item.tags.some(tag=>typeof tag!=='string'))throw new Error(`Azure OpenAI question ${index+1} has invalid explanation or tags.`);
  if(input.section==='listening'&&input.generateAudioScript&&(!item.audioScript||typeof item.audioScript!=='string'))throw new Error(`Azure OpenAI listening question ${index+1} is missing audioScript.`);
  return {instruction:item.instruction,prompt:item.prompt,choices:item.choices,answer:Number(item.answer),explanationVi:item.explanationVi,tags:item.tags,audioScript:typeof item.audioScript==='string'?item.audioScript:undefined};
}

export function getFactoryProvider():FactoryProvider {
  return process.env.AI_FACTORY_PROVIDER===AZURE_OPENAI_PROVIDER ? new AzureOpenAiFactoryProvider() : process.env.AI_FACTORY_PROVIDER==='http' ? new HttpFactoryProvider() : new MockFactoryProvider();
}
export function factoryProviderMode(){ return process.env.AI_FACTORY_PROVIDER===AZURE_OPENAI_PROVIDER ? AZURE_OPENAI_PROVIDER : process.env.AI_FACTORY_PROVIDER==='http' ? 'http' : 'mock'; }
