import {azureOpenAiConfig,requestAzureOpenAiJson} from '../lib/server/azure-openai';

const config=azureOpenAiConfig('factory');
const result=await requestAzureOpenAiJson<{ok?:boolean}>({
  ...config,
  systemPrompt:'Return valid JSON only.',
  input:{task:'configuration_check',expected:{ok:true}},
  maxOutputTokens:512,
});
if(result.ok!==true)throw new Error('Azure OpenAI configuration check returned unexpected JSON.');
console.log(JSON.stringify({provider:'azure-openai',model:config.deployment,ok:true}));
