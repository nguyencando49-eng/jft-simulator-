import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
import { getRepository } from '@/lib/server/repository';
import { calculateCoverage, checkExamReadiness, DEFAULT_BLUEPRINTS, rankDeficits } from '@/lib/server/curriculum-production';
import { CONTENT_LEVELS } from '@/lib/server/content-taxonomy';
import { summarizeJftAlignmentMetrics } from '@/lib/server/jft-alignment';
import {summarizeDifficultyCalibrationMetrics} from '@/lib/server/difficulty-calibration';
import {summarizeOriginalityDuplicateMetrics} from '@/lib/server/originality-duplicate';

export async function GET(req:Request){
  try{
    await requireAuth(req,'admin');
    const repo=getRepository(),questions=await repo.listQuestions(),sources=await repo.listSourceDocuments(),factoryJobs=await repo.listFactoryJobs();
    const units=(await Promise.all(sources.map(s=>repo.listKnowledgeUnits(s.id)))).flat(),provenance=(await Promise.all(sources.map(s=>repo.listQuestionProvenance(s.id)))).flat();
    const coverage=calculateCoverage(units,questions,provenance);
    const levels=Object.fromEntries(CONTENT_LEVELS.map(level=>{
      const approved=questions.filter(q=>q.level===level&&q.status==='approved');
      return [level,{approved:approved.length,targetMin:700,targetMax:900,coverage:{total:coverage.filter(c=>c.level===level).length,covered:coverage.filter(c=>c.level===level&&c.deficit===0).length},readiness:checkExamReadiness(level,questions,DEFAULT_BLUEPRINTS[level])}];
    }));
    const groundingResults=factoryJobs.flatMap(job=>job.candidates.map(candidate=>candidate.curriculumGroundingQa).filter((result):result is NonNullable<typeof result>=>!!result));
    const countGroundingIssue=(code:string)=>groundingResults.filter(result=>result.issues.some(issue=>issue.code===code)).length;
    const outOfCurriculumFailures=groundingResults.filter(result=>result.verdict==='FAIL'&&result.issues.some(issue=>['OUT_OF_CURRICULUM','REQUIRED_GRAMMAR_UNSUPPORTED','REQUIRED_VOCABULARY_UNSUPPORTED','REQUIRED_KANJI_UNSUPPORTED','REQUIRED_EXPRESSION_UNSUPPORTED','EXTERNAL_KNOWLEDGE_REQUIRED'].includes(issue.code))).length;
    const alignmentResults=factoryJobs.flatMap(job=>job.candidates.map(candidate=>candidate.jftAlignmentQa).filter((result):result is NonNullable<typeof result>=>!!result));
    const alignmentMetrics=summarizeJftAlignmentMetrics(alignmentResults);
    const difficultyResults=factoryJobs.flatMap(job=>job.candidates.map(candidate=>candidate.difficultyCalibrationQa).filter((result):result is NonNullable<typeof result>=>!!result));
    const difficultyMetrics=summarizeDifficultyCalibrationMetrics(difficultyResults);
    const originalityResults=factoryJobs.flatMap(job=>job.candidates.map(candidate=>candidate.originalityDuplicateQa).filter((result):result is NonNullable<typeof result>=>!!result));
    const originalityMetrics=summarizeOriginalityDuplicateMetrics(originalityResults);
    return NextResponse.json({
      ok:true,
      levels,
      sources:{total:sources.length,approvedKnowledgeUnits:units.filter(u=>u.status==='approved').length},
      deficits:rankDeficits(coverage).slice(0,100),
      qa:{
        listeningAudioDeficits:questions.filter(q=>q.level&&q.status==='approved'&&q.type==='audio_choice'&&!q.audioSrc).length,
        outOfCurriculumFailures,
        curriculumPassRate:groundingResults.length?groundingResults.filter(result=>result.verdict==='PASS').length/groundingResults.length:0,
        unsupportedGrammarRate:groundingResults.length?countGroundingIssue('REQUIRED_GRAMMAR_UNSUPPORTED')/groundingResults.length:0,
        unsupportedVocabularyRate:groundingResults.length?countGroundingIssue('REQUIRED_VOCABULARY_UNSUPPORTED')/groundingResults.length:0,
        unsupportedKanjiRate:groundingResults.length?countGroundingIssue('REQUIRED_KANJI_UNSUPPORTED')/groundingResults.length:0,
        partialSupportRate:groundingResults.length?countGroundingIssue('PARTIALLY_SUPPORTED')/groundingResults.length:0,
        retrievalIncompleteRate:groundingResults.length?countGroundingIssue('CURRICULUM_SEARCH_INCOMPLETE')/groundingResults.length:0,
        ...alignmentMetrics,
        ...difficultyMetrics,
        ...originalityMetrics,
      },
    });
  }catch(e){return apiError(e);}
}
