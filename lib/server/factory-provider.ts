import { FactoryRequest, GeneratedQuestionDraft } from './factory-domain';

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

export function getFactoryProvider():FactoryProvider {
  return process.env.AI_FACTORY_PROVIDER==='http' ? new HttpFactoryProvider() : new MockFactoryProvider();
}
export function factoryProviderMode(){ return process.env.AI_FACTORY_PROVIDER==='http' ? 'http' : 'mock'; }
