import {afterEach,describe,expect,it,vi} from 'vitest';
import {AzureOpenAiError,requestAzureOpenAiJson} from '@/lib/server/azure-openai';
import {AzureOpenAiFactoryProvider,factoryProviderMode,getFactoryProvider} from '@/lib/server/factory-provider';
import {AzureOpenAiSemanticQaProvider,getSemanticQaProvider,semanticQaProviderMode} from '@/lib/server/semantic-qa-provider';
import type {FactoryRequest} from '@/lib/server/factory-domain';

const request:FactoryRequest={section:'reading',level:'A1',topic:'SHOPPING',canDo:'営業時間を探す',category:'information_search',count:1,difficulty:'easy',includeExplanation:true,generateAudioScript:false};
const generated={questions:[{instruction:'文章を読んで、答えてください。',prompt:'店は9時からです。何時からですか。',choices:['8時','9時','10時','11時'],answer:1,explanationVi:'Cửa hàng mở từ 9 giờ.',tags:['shopping','A1']}]};

function azureEnvelope(value:unknown){return {choices:[{message:{content:JSON.stringify(value)}}]}}
function configure(){
  vi.stubEnv('AI_FACTORY_PROVIDER','azure-openai');vi.stubEnv('AI_QA_PROVIDER','azure-openai');
  vi.stubEnv('AOAI_ENDPOINT','https://unit-test.openai.azure.com');vi.stubEnv('API_KEY','secret-key');vi.stubEnv('AZURE_OPENAI_DEPLOYMENT','jft-model');
}

afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()});

describe('Azure OpenAI provider adapter',()=>{
  it('sends Azure API-key auth and parses the chat-completions JSON envelope',async()=>{
    configure();let url='';let init:RequestInit|undefined;
    vi.stubGlobal('fetch',vi.fn(async(input,requestInit)=>{url=String(input);init=requestInit;return Response.json(azureEnvelope(generated))}));
    const result=await new AzureOpenAiFactoryProvider().generate(request);
    expect(result).toHaveLength(1);expect(result[0].answer).toBe(1);
    expect(url).toBe('https://unit-test.openai.azure.com/openai/v1/chat/completions');
    const headers=init?.headers as Record<string,string>;expect(headers['api-key']).toBe('secret-key');expect(headers).not.toHaveProperty('authorization');
    const body=JSON.parse(String(init?.body));expect(body.model).toBe('jft-model');expect(body.response_format).toEqual({type:'json_object'});expect(body.messages[0].content).toContain('unofficial JFT-Basic practice simulator');
  });

  it('selects native Azure providers without changing the provider-neutral HTTP mode',()=>{
    configure();
    expect(getFactoryProvider()).toBeInstanceOf(AzureOpenAiFactoryProvider);expect(factoryProviderMode()).toBe('azure-openai');
    expect(getSemanticQaProvider()).toBeInstanceOf(AzureOpenAiSemanticQaProvider);expect(semanticQaProviderMode()).toBe('azure-openai');
  });

  it('normalizes semantic QA and refuses an error issue as a pass',async()=>{
    configure();
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json(azureEnvelope({score:91,passed:true,summary:'Audio is missing.',issues:[{code:'audio_required',severity:'error',category:'audio',message:'Listening script is missing.'}]}))));
    const provider=new AzureOpenAiSemanticQaProvider();
    const result=await provider.review({id:'candidate',question:{id:'q1',section:'listening',type:'audio_choice',level:'A1',instruction:'音声を聞いてください。',prompt:'何時ですか。',choices:['8時','9時','10時','11時'],answer:1,explanationVi:'',tags:[],version:1,status:'review',source:'ai',createdAt:'2026-01-01',updatedAt:'2026-01-01'},generation:{provider:'azure-openai',promptVersion:'v1',createdAt:'2026-01-01'}},{...request,section:'listening',category:'conversation',generateAudioScript:true});
    expect(result.passed).toBe(false);expect(result.provider).toBe('azure-openai-semantic');expect(result.issues[0].code).toBe('audio_required');
  });

  it('reports a missing Azure deployment explicitly',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:{code:'DeploymentNotFound',message:'The deployment does not exist.'}},{status:404})));
    await expect(requestAzureOpenAiJson({endpoint:'https://unit-test.openai.azure.com',apiKey:'key',deployment:'missing',systemPrompt:'Return JSON.',input:{}})).rejects.toMatchObject({code:'AZURE_OPENAI_DEPLOYMENT_NOT_FOUND'} satisfies Partial<AzureOpenAiError>);
  });

  it('validates generated question structure before the Factory pipeline accepts it',async()=>{
    configure();vi.stubGlobal('fetch',vi.fn(async()=>Response.json(azureEnvelope({questions:[{...generated.questions[0],choices:['9時'],answer:0}]}))));
    await expect(new AzureOpenAiFactoryProvider().generate(request)).rejects.toThrow('four non-empty choices');
  });
});
