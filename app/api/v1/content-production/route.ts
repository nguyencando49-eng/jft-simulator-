import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';
import { apiError } from '@/lib/server/http';
import { getRepository } from '@/lib/server/repository';
import { calculateCoverage, checkExamReadiness, DEFAULT_BLUEPRINTS, rankDeficits } from '@/lib/server/curriculum-production';
import { CONTENT_LEVELS } from '@/lib/server/content-taxonomy';

export async function GET(req:Request){try{await requireAuth(req,'admin');const repo=getRepository(),questions=await repo.listQuestions(),sources=await repo.listSourceDocuments();const units=(await Promise.all(sources.map(s=>repo.listKnowledgeUnits(s.id)))).flat(),provenance=(await Promise.all(sources.map(s=>repo.listQuestionProvenance(s.id)))).flat();const coverage=calculateCoverage(units,questions,provenance);const levels=Object.fromEntries(CONTENT_LEVELS.map(level=>{const approved=questions.filter(q=>q.level===level&&q.status==='approved');return [level,{approved:approved.length,targetMin:700,targetMax:900,coverage:{total:coverage.filter(c=>c.level===level).length,covered:coverage.filter(c=>c.level===level&&c.deficit===0).length},readiness:checkExamReadiness(level,questions,DEFAULT_BLUEPRINTS[level])}]}));return NextResponse.json({ok:true,levels,sources:{total:sources.length,approvedKnowledgeUnits:units.filter(u=>u.status==='approved').length},deficits:rankDeficits(coverage).slice(0,100),qa:{listeningAudioDeficits:questions.filter(q=>q.level&&q.status==='approved'&&q.type==='audio_choice'&&!q.audioSrc).length,outOfCurriculumFailures:0}});}catch(e){return apiError(e);}}
