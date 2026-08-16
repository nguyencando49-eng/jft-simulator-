import type { TtsResult } from './tts-provider';

function bytesToDataUrl(bytes:Uint8Array,contentType:string){return `data:${contentType};base64,${Buffer.from(bytes).toString('base64')}`;}

export async function persistGeneratedAudio(result:TtsResult,jobId:string,candidateId:string){
  if(result.audioUrl) return {src:result.audioUrl,storage:'provider-url'};
  if(!result.bytes) throw new Error('TTS provider returned no audio payload.');
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key||process.env.AUTH_DISABLED==='true') return {src:bytesToDataUrl(result.bytes,result.contentType),storage:'inline-dev'};
  const bucket=process.env.EXAM_ASSET_BUCKET||'exam-assets';
  const path=`factory/${jobId}/${candidateId}.${result.extension}`;
  const upload=await fetch(`${url.replace(/\/$/,'')}/storage/v1/object/${encodeURIComponent(bucket)}/${path}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':result.contentType,'x-upsert':'true'},body:Buffer.from(result.bytes)});
  if(!upload.ok) throw new Error(`Audio storage failed: ${upload.status} ${await upload.text()}`);
  const publicBase=process.env.EXAM_ASSET_PUBLIC_BASE_URL || `${url.replace(/\/$/,'')}/storage/v1/object/public/${encodeURIComponent(bucket)}`;
  return {src:`${publicBase.replace(/\/$/,'')}/${path}`,storage:'supabase'};
}
