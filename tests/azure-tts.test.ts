import { afterEach,describe,expect,it,vi } from 'vitest';
import { AzureTtsProvider } from '@/lib/server/tts-provider';

afterEach(()=>{vi.unstubAllGlobals();delete process.env.AZURE_SPEECH_KEY;delete process.env.AZURE_SPEECH_REGION;delete process.env.AZURE_SPEECH_VOICE;});
describe('Azure Japanese TTS',()=>{
  it('requests Japanese 48 kHz WAV and escapes SSML',async()=>{process.env.AZURE_SPEECH_KEY='test';process.env.AZURE_SPEECH_REGION='japaneast';const wav=new Uint8Array(44);wav.set([82,73,70,70]);const fetchMock=vi.fn(async(_url:string,init:RequestInit)=>new Response(wav,{status:200,headers:{'content-type':'audio/wav'}}));vi.stubGlobal('fetch',fetchMock);const result=await new AzureTtsProvider().synthesize('A&B <test>');expect(result.contentType).toBe('audio/wav');const init=fetchMock.mock.calls[0][1];expect((init.headers as Record<string,string>)['X-Microsoft-OutputFormat']).toBe('riff-48khz-16bit-mono-pcm');expect(String(init.body)).toContain('A&amp;B &lt;test&gt;');});
  it('requires Azure credentials',async()=>{await expect(new AzureTtsProvider().synthesize('日本語')).rejects.toThrow(/AZURE_SPEECH_KEY/);});
});
