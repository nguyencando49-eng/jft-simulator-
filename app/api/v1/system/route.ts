import { NextResponse } from 'next/server';
import { repositoryMode } from '@/lib/server/repository';
import { factoryProviderMode } from '@/lib/server/factory-provider';
import { semanticQaProviderMode } from '@/lib/server/semantic-qa-provider';
import { ttsProviderMode } from '@/lib/server/tts-provider';
export async function GET(){return NextResponse.json({ok:true,repository:repositoryMode(),authentication:process.env.AUTH_DISABLED==='true'?'disabled-dev':(process.env.SUPABASE_URL?'supabase':'not-configured'),assetStorage:process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY?'supabase-storage':'inline-dev',aiFactory:`${factoryProviderMode()} · semantic:${semanticQaProviderMode()} · tts:${ttsProviderMode()}`,apiVersion:'v1 / app 0.5.1-qa.2'});}
