import type { FactoryCandidate, FactoryQaIssue, FactoryRequest } from './factory-domain';
import { AZURE_OPENAI_PROVIDER, azureOpenAiConfig, requestAzureOpenAiJson } from './azure-openai';

export const JFT_SEMANTIC_QA_AZURE_OPENAI_PROMPT_VERSION='JFT_SEMANTIC_QA_AZURE_OPENAI_V1';
const AZURE_SEMANTIC_SYSTEM_PROMPT=`You are an independent semantic reviewer for an unofficial JFT-Basic practice question factory.
Judge whether the candidate is coherent and aligned with the requested topic and Can-do. This is a general semantic screen, not a substitute for the specialized answer, naturalness, curriculum, alignment, difficulty, or originality judges.
Return JSON only: {"score":0-100,"passed":boolean,"summary":"...","issues":[{"code":"semantic_alignment|audio_required|schema","severity":"error|warning","category":"pedagogy|language|jft_style|audio|schema","message":"..."}]}.
Use passed=false for a semantic defect that blocks further use. Do not rewrite the question.`;

export interface SemanticQaResult {
  score: number;
  passed: boolean;
  summary: string;
  issues: FactoryQaIssue[];
  provider: string;
  model?: string;
}

export interface SemanticQaProvider {
  name: string;
  model?: string;
  review(candidate: Omit<FactoryCandidate,'qa'>, request: FactoryRequest): Promise<SemanticQaResult>;
}

function keywordScore(text:string, topic:string, canDo?:string){
  const terms=[topic,...(canDo||'').split(/[\s、。・,/]+/)].map(x=>x.trim()).filter(x=>x.length>=2);
  if(!terms.length) return 1;
  const hits=terms.filter(t=>text.includes(t)).length;
  return Math.min(1,0.45+hits/Math.max(terms.length,1));
}

class MockSemanticQaProvider implements SemanticQaProvider {
  name='mock-semantic'; model='heuristic-v1';
  async review(candidate:Omit<FactoryCandidate,'qa'>, request:FactoryRequest):Promise<SemanticQaResult>{
    const q=candidate.question;
    const text=[q.instruction,q.prompt,q.choices.join(' '),candidate.audioScript||''].join(' ');
    const issues:FactoryQaIssue[]=[];
    const relevance=keywordScore(text,request.topic,request.canDo);
    if(relevance<0.7) issues.push({code:'semantic_alignment',severity:'warning',category:'pedagogy',message:'Topic/Can-do alignment appears weak.'});
    if(q.choices[q.answer]?.trim().length===0) issues.push({code:'semantic_alignment',severity:'error',category:'pedagogy',message:'Correct answer is empty.'});
    if(request.section==='listening' && !candidate.audioScript?.trim()) issues.push({code:'audio_required',severity:'error',category:'audio',message:'Listening candidate has no audio script for semantic review.'});
    const score=Math.max(0,Math.round(92-(1-relevance)*35-issues.filter(i=>i.severity==='error').length*30-issues.filter(i=>i.severity==='warning').length*8));
    return {score,passed:issues.every(i=>i.severity!=='error')&&score>=65,summary:score>=85?'Strong alignment':score>=65?'Usable with review':'Needs revision',issues,provider:this.name,model:this.model};
  }
}

class HttpSemanticQaProvider implements SemanticQaProvider {
  name='http-semantic'; model=process.env.AI_QA_MODEL || process.env.AI_FACTORY_MODEL || 'external';
  async review(candidate:Omit<FactoryCandidate,'qa'>, request:FactoryRequest):Promise<SemanticQaResult>{
    const endpoint=process.env.AI_QA_ENDPOINT || process.env.AI_FACTORY_ENDPOINT;
    if(!endpoint) throw new Error('AI_QA_ENDPOINT or AI_FACTORY_ENDPOINT is required for semantic QA.');
    const res=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',...(process.env.AI_QA_API_KEY||process.env.AI_FACTORY_API_KEY?{authorization:`Bearer ${process.env.AI_QA_API_KEY||process.env.AI_FACTORY_API_KEY}`}:{})},body:JSON.stringify({task:'jft_semantic_qa',promptVersion:'v5.1-semantic',request,candidate:{question:candidate.question,audioScript:candidate.audioScript}})});
    if(!res.ok) throw new Error(`Semantic QA provider failed: ${res.status}`);
    const json=await res.json() as Partial<SemanticQaResult>;
    const score=Number(json.score);
    if(!Number.isFinite(score)) throw new Error('Semantic QA response requires numeric score.');
    return {score:Math.max(0,Math.min(100,Math.round(score))),passed:json.passed!==false && score>=65,summary:String(json.summary||''),issues:Array.isArray(json.issues)?json.issues:[],provider:this.name,model:this.model};
  }
}

export class AzureOpenAiSemanticQaProvider implements SemanticQaProvider {
  name='azure-openai-semantic';
  model=azureOpenAiConfig('qa').deployment || 'not-configured';
  async review(candidate:Omit<FactoryCandidate,'qa'>,request:FactoryRequest):Promise<SemanticQaResult>{
    const config=azureOpenAiConfig('qa');
    const json=await requestAzureOpenAiJson<Partial<SemanticQaResult>>({...config,systemPrompt:AZURE_SEMANTIC_SYSTEM_PROMPT,input:{task:'jft_semantic_qa',promptVersion:JFT_SEMANTIC_QA_AZURE_OPENAI_PROMPT_VERSION,request,candidate:{question:candidate.question,audioScript:candidate.audioScript}},maxOutputTokens:1800});
    const score=Number(json.score);
    if(!Number.isFinite(score)||score<0||score>100)throw new Error('Azure OpenAI Semantic QA response requires a score from 0 to 100.');
    if(!Array.isArray(json.issues))throw new Error('Azure OpenAI Semantic QA response requires issues[].');
    const issues=json.issues.map((raw,index)=>validateSemanticIssue(raw,index));
    const normalized=Math.round(score);
    return {score:normalized,passed:json.passed===true&&normalized>=65&&issues.every(issue=>issue.severity!=='error'),summary:typeof json.summary==='string'?json.summary:'',issues,provider:this.name,model:this.model};
  }
}

function validateSemanticIssue(value:unknown,index:number):FactoryQaIssue{
  if(!value||typeof value!=='object')throw new Error(`Azure OpenAI Semantic QA issue ${index+1} is invalid.`);
  const issue=value as Partial<FactoryQaIssue>;
  if(!['semantic_alignment','audio_required','schema'].includes(String(issue.code))||!['error','warning'].includes(String(issue.severity))||typeof issue.message!=='string'||!issue.message.trim())throw new Error(`Azure OpenAI Semantic QA issue ${index+1} has an invalid contract.`);
  const categories=['pedagogy','language','jft_style','audio','schema'];
  return {code:issue.code as FactoryQaIssue['code'],severity:issue.severity as FactoryQaIssue['severity'],message:issue.message,category:categories.includes(String(issue.category))?issue.category:undefined};
}

export function getSemanticQaProvider():SemanticQaProvider {
  return process.env.AI_QA_PROVIDER===AZURE_OPENAI_PROVIDER ? new AzureOpenAiSemanticQaProvider() : process.env.AI_QA_PROVIDER==='http' ? new HttpSemanticQaProvider() : new MockSemanticQaProvider();
}
export function semanticQaProviderMode(){return process.env.AI_QA_PROVIDER===AZURE_OPENAI_PROVIDER?AZURE_OPENAI_PROVIDER:process.env.AI_QA_PROVIDER==='http'?'http':'mock';}
