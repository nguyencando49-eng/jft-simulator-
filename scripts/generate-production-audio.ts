import { mkdir,writeFile,stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { massQuestionCandidates } from '../data/production/mass-question-candidates';

process.loadEnvFile('.env.local');
const key=process.env.AZURE_SPEECH_KEY;
const region=process.env.AZURE_SPEECH_REGION;
const voice=process.env.AZURE_SPEECH_VOICE||'ja-JP-NanamiNeural';
const rate=process.env.AZURE_SPEECH_RATE||'-5%';
if(!key||!region)throw new Error('AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are required.');

const escapeXml=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]!));
const listening=massQuestionCandidates.filter(q=>q.section==='listening'&&q.audioScript&&q.audioSrc);
const outputRoot=join(process.cwd(),'public','audio','production');
await mkdir(outputRoot,{recursive:true});

async function synthesize(question:typeof listening[number]){
  const output=join(process.cwd(),'public',question.audioSrc!.replace(/^\//,''));
  if(existsSync(output)&&(await stat(output)).size>1000)return 'cached';
  const ssml=`<speak version="1.0" xml:lang="ja-JP"><voice name="${escapeXml(voice)}"><prosody rate="${escapeXml(rate)}">${escapeXml(question.audioScript!)}</prosody></voice></speak>`;
  for(let attempt=1;attempt<=5;attempt++){
    const response=await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,{method:'POST',headers:{'Ocp-Apim-Subscription-Key':key!,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':'audio-24khz-48kbitrate-mono-mp3','User-Agent':'jft-simulator'},body:ssml});
    if(response.ok){const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length<1000)throw new Error(`${question.id}: audio is unexpectedly small.`);await writeFile(output,bytes);return 'created';}
    if(response.status!==429&&response.status<500)throw new Error(`${question.id}: Azure TTS HTTP ${response.status}`);
    await new Promise(resolve=>setTimeout(resolve,attempt*1000));
  }
  throw new Error(`${question.id}: Azure TTS retries exhausted.`);
}

let cursor=0,created=0,cached=0;
async function worker(){while(true){const index=cursor++;if(index>=listening.length)return;const result=await synthesize(listening[index]);if(result==='created')created++;else cached++;if((created+cached)%25===0)console.log(`audio ${created+cached}/${listening.length}`);}}
await Promise.all(Array.from({length:4},()=>worker()));
console.log(JSON.stringify({total:listening.length,created,cached,voice,rate}));
