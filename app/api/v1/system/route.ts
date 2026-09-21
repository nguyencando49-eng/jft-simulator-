import { NextResponse } from 'next/server';
import { repositoryMode } from '@/lib/server/repository';
import { factoryProviderMode } from '@/lib/server/factory-provider';
import { semanticQaProviderMode } from '@/lib/server/semantic-qa-provider';
import { ttsProviderMode } from '@/lib/server/tts-provider';
import { answerOracleProviderMode } from '@/lib/server/answer-oracle-provider';
import { japaneseNaturalnessProviderMode } from '@/lib/server/japanese-naturalness-provider';
import { curriculumGroundingProviderMode } from '@/lib/server/curriculum-grounding-provider';
import { jftAlignmentProviderMode } from '@/lib/server/jft-alignment-provider';
import { difficultyCalibrationProviderMode } from '@/lib/server/difficulty-calibration-provider';
import { originalityDuplicateProviderMode } from '@/lib/server/originality-duplicate-provider';

export async function GET(){
  const repository=repositoryMode();
  const authentication=process.env.AUTH_DISABLED==='true'?'disabled-dev':(process.env.SUPABASE_URL&&process.env.SUPABASE_ANON_KEY?'supabase':'not-configured');
  const assetStorage=process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY?'supabase-storage':'inline-dev';
  const factory=factoryProviderMode(),semantic=semanticQaProviderMode(),tts=ttsProviderMode();
  const specialized={answerOracle:answerOracleProviderMode(),japaneseNaturalness:japaneseNaturalnessProviderMode(),curriculumGrounding:curriculumGroundingProviderMode(),jftAlignment:jftAlignmentProviderMode(),difficultyCalibration:difficultyCalibrationProviderMode(),originalityDuplicate:originalityDuplicateProviderMode()};
  const blockers:string[]=[];
  if(repository!=='supabase')blockers.push('Durable Supabase repository is not configured.');
  if(authentication!=='supabase')blockers.push('Production authentication is not configured.');
  if(assetStorage!=='supabase-storage')blockers.push('Durable exam asset storage is not configured.');
  const authoringBlockers=[...blockers];
  if(factory==='mock')authoringBlockers.push('Question Factory is using the mock generator.');
  if(semantic==='mock')authoringBlockers.push('Semantic QA is using the mock reviewer.');
  if(tts==='mock')authoringBlockers.push('Listening Factory is using mock TTS.');
  for(const [name,mode] of Object.entries(specialized))if(mode==='mock')authoringBlockers.push(`${name} is using a mock/deterministic QA provider.`);
  return NextResponse.json({
    ok:true,
    ready:blockers.length===0,
    authoringReady:authoringBlockers.length===0,
    blockers,
    authoringBlockers,
    repository,
    authentication,
    assetStorage,
    aiFactory:`${factory} · semantic:${semantic} · tts:${tts}`,
    specializedQa:specialized,
    apiVersion:'v1 / production-3000',
  });
}
