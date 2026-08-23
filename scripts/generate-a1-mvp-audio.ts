import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { questions } from '../data/questions';
import { A1_MVP_BLUEPRINT_VERSION, A1_MVP_LISTENING_SCRIPTS } from '../lib/server/a1-mvp-release';
import { AzureTtsProvider } from '../lib/server/tts-provider';

process.loadEnvFile('.env.local');
if(!process.env.AZURE_SPEECH_KEY||!process.env.AZURE_SPEECH_REGION)throw new Error('AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are required.');
const provider=new AzureTtsProvider();
const rate=process.env.AZURE_SPEECH_RATE||'-5%';
const entries=[] as Array<{questionId:string;audioSrc:string;bytes:number;sha256:string}>;
for(const [questionId,script] of Object.entries(A1_MVP_LISTENING_SCRIPTS)){
  const question=questions.find(item=>item.id===questionId);
  if(!question?.audioSrc)throw new Error(`${questionId} has no audioSrc.`);
  const result=await provider.synthesize(script);
  if(!result.bytes)throw new Error(`${questionId}: Azure did not return audio bytes.`);
  const output=join(process.cwd(),'public',question.audioSrc.replace(/^\//,''));
  await writeFile(output,result.bytes);
  entries.push({questionId,audioSrc:question.audioSrc,bytes:result.bytes.byteLength,sha256:createHash('sha256').update(result.bytes).digest('hex')});
}
const manifest={blueprintVersion:A1_MVP_BLUEPRINT_VERSION,provider:'azure',voice:provider.voice,rate,format:'riff-48khz-16bit-mono-pcm',generatedAt:new Date().toISOString(),entries};
await writeFile(join(process.cwd(),'data','production','a1-mvp-audio-manifest.json'),`${JSON.stringify(manifest,null,2)}\n`,'utf8');
console.log(JSON.stringify({provider:manifest.provider,voice:manifest.voice,rate,files:entries.map(entry=>({questionId:entry.questionId,bytes:entry.bytes,sha256:entry.sha256}))},null,2));
