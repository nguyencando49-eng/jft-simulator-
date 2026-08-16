export interface TtsResult { bytes?:Uint8Array; audioUrl?:string; contentType:string; extension:string; provider:string; voice?:string; }
export interface TtsProvider { name:string; voice?:string; synthesize(text:string):Promise<TtsResult>; }

function writeString(view:DataView,offset:number,s:string){for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));}
function mockWav(durationSeconds=0.8,sampleRate=8000){
  const samples=Math.floor(durationSeconds*sampleRate), dataSize=samples*2, buffer=new ArrayBuffer(44+dataSize), view=new DataView(buffer);
  writeString(view,0,'RIFF'); view.setUint32(4,36+dataSize,true); writeString(view,8,'WAVE'); writeString(view,12,'fmt '); view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true); view.setUint32(24,sampleRate,true); view.setUint32(28,sampleRate*2,true); view.setUint16(32,2,true); view.setUint16(34,16,true); writeString(view,36,'data'); view.setUint32(40,dataSize,true);
  for(let i=0;i<samples;i++){const t=i/sampleRate;const amp=Math.sin(2*Math.PI*440*t)*0.12*Math.max(0,1-i/samples);view.setInt16(44+i*2,Math.round(amp*32767),true);}
  return new Uint8Array(buffer);
}

class MockTtsProvider implements TtsProvider { name='mock'; voice='tone-dev'; async synthesize(_text:string){return {bytes:mockWav(),contentType:'audio/wav',extension:'wav',provider:this.name,voice:this.voice};} }
class HttpTtsProvider implements TtsProvider {
  name='http'; voice=process.env.TTS_VOICE || 'default';
  async synthesize(text:string):Promise<TtsResult>{
    const endpoint=process.env.TTS_ENDPOINT; if(!endpoint) throw new Error('TTS_ENDPOINT is required for http TTS provider.');
    const res=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',...(process.env.TTS_API_KEY?{authorization:`Bearer ${process.env.TTS_API_KEY}`}:{})},body:JSON.stringify({task:'tts',text,voice:this.voice,language:'ja-JP',format:'mp3'})});
    if(!res.ok) throw new Error(`TTS provider failed: ${res.status}`);
    const ct=res.headers.get('content-type')||'';
    if(ct.startsWith('audio/')){const bytes=new Uint8Array(await res.arrayBuffer());return {bytes,contentType:ct,extension:ct.includes('wav')?'wav':'mp3',provider:this.name,voice:this.voice};}
    const json=await res.json() as {audioBase64?:string;audioUrl?:string;contentType?:string};
    if(json.audioUrl) return {audioUrl:json.audioUrl,contentType:json.contentType||'audio/mpeg',extension:'mp3',provider:this.name,voice:this.voice};
    if(json.audioBase64){return {bytes:Uint8Array.from(Buffer.from(json.audioBase64,'base64')),contentType:json.contentType||'audio/mpeg',extension:(json.contentType||'').includes('wav')?'wav':'mp3',provider:this.name,voice:this.voice};}
    throw new Error('TTS response must be audio bytes, audioUrl, or audioBase64.');
  }
}
function escapeXml(value:string){return value.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));}
export class AzureTtsProvider implements TtsProvider {
  name='azure'; voice=process.env.AZURE_SPEECH_VOICE||'ja-JP-NanamiNeural';
  async synthesize(text:string):Promise<TtsResult>{
    const key=process.env.AZURE_SPEECH_KEY,region=process.env.AZURE_SPEECH_REGION;
    if(!key||!region) throw new Error('AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are required for Azure TTS.');
    const endpoint=`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const ssml=`<speak version="1.0" xml:lang="ja-JP"><voice name="${escapeXml(this.voice)}"><prosody rate="${escapeXml(process.env.AZURE_SPEECH_RATE||'-5%')}">${escapeXml(text)}</prosody></voice></speak>`;
    const res=await fetch(endpoint,{method:'POST',headers:{'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':'riff-48khz-16bit-mono-pcm','User-Agent':'jft-simulator'},body:ssml});
    if(!res.ok) throw new Error(`Azure Speech synthesis failed: ${res.status} ${await res.text()}`);
    const bytes=new Uint8Array(await res.arrayBuffer());
    if(bytes.length<44||String.fromCharCode(...bytes.slice(0,4))!=='RIFF') throw new Error('Azure Speech returned invalid WAV audio.');
    return {bytes,contentType:'audio/wav',extension:'wav',provider:this.name,voice:this.voice};
  }
}
export function getTtsProvider():TtsProvider{const mode=process.env.TTS_PROVIDER;return mode==='azure'?new AzureTtsProvider():mode==='http'?new HttpTtsProvider():new MockTtsProvider();}
export function ttsProviderMode(){const mode=process.env.TTS_PROVIDER;return mode==='azure'?'azure':mode==='http'?'http':'mock';}
