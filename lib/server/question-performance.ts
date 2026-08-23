import type {Question} from '@/lib/types';
import type {Repository} from './domain';

export const QUESTION_PERFORMANCE_POLICY_V1={
  version:'QUESTION_PERFORMANCE_V1',
  minimumAttempts:30,
  strongSampleAttempts:100,
  minimumResponseTimeMs:500,
  maximumResponseTimeMs:600_000,
} as const;

export interface QuestionPerformanceObservation {
  questionId:string;
  submitted:boolean;
  correct:boolean;
  responseTimeMs?:number;
  abandoned?:boolean;
  expired?:boolean;
  section?:Question['section'];
  category?:string;
  examLevel?:Question['level'];
  learnerLevel?:Question['level'];
}

export interface QuestionPerformanceAggregate {
  questionId:string;
  attemptCount:number;
  correctCount:number;
  incorrectCount:number;
  correctRate:number|null;
  medianResponseTimeMs:number|null;
  averageResponseTimeMs:number|null;
  responseTimeSampleCount:number;
  excludedResponseTimeCount:number;
  sufficientSample:boolean;
  strongSample:boolean;
  discriminationIndex:number|null;
  policyVersion:string;
}

const rounded=(value:number,places=4)=>Number(value.toFixed(places));

export function emptyQuestionPerformance(questionId:string):QuestionPerformanceAggregate{
  return {questionId,attemptCount:0,correctCount:0,incorrectCount:0,correctRate:null,medianResponseTimeMs:null,averageResponseTimeMs:null,responseTimeSampleCount:0,excludedResponseTimeCount:0,sufficientSample:false,strongSample:false,discriminationIndex:null,policyVersion:QUESTION_PERFORMANCE_POLICY_V1.version};
}

export function aggregateQuestionPerformance(questionId:string,observations:QuestionPerformanceObservation[],policy=QUESTION_PERFORMANCE_POLICY_V1):QuestionPerformanceAggregate{
  const attempts=observations.filter(item=>item.questionId===questionId&&item.submitted&&!item.abandoned&&!item.expired);
  const correctCount=attempts.filter(item=>item.correct).length;
  const validTimes:number[]=[];let excludedResponseTimeCount=0;
  for(const item of attempts){
    if(item.responseTimeMs===undefined)continue;
    if(!Number.isFinite(item.responseTimeMs)||item.responseTimeMs<policy.minimumResponseTimeMs||item.responseTimeMs>policy.maximumResponseTimeMs){excludedResponseTimeCount++;continue;}
    validTimes.push(item.responseTimeMs);
  }
  validTimes.sort((a,b)=>a-b);
  const middle=Math.floor(validTimes.length/2);
  const median=validTimes.length?(validTimes.length%2?validTimes[middle]:(validTimes[middle-1]+validTimes[middle])/2):null;
  const average=validTimes.length?validTimes.reduce((sum,value)=>sum+value,0)/validTimes.length:null;
  return {
    questionId,
    attemptCount:attempts.length,
    correctCount,
    incorrectCount:attempts.length-correctCount,
    correctRate:attempts.length?rounded(correctCount/attempts.length):null,
    medianResponseTimeMs:median===null?null:Math.round(median),
    averageResponseTimeMs:average===null?null:Math.round(average),
    responseTimeSampleCount:validTimes.length,
    excludedResponseTimeCount,
    sufficientSample:attempts.length>=policy.minimumAttempts,
    strongSample:attempts.length>=policy.strongSampleAttempts,
    discriminationIndex:null,
    policyVersion:policy.version,
  };
}

/**
 * Builds aggregate, privacy-safe item statistics from frozen exams and submitted
 * sessions. The current session schema has no per-question timestamps, so this
 * adapter intentionally leaves response-time fields empty.
 */
export async function loadQuestionPerformanceCatalog(repo:Repository):Promise<Map<string,QuestionPerformanceAggregate>>{
  const [versions,sessions]=await Promise.all([repo.listExamVersions(),repo.listSessions()]);
  const versionById=new Map(versions.map(version=>[version.id,version]));
  const observations:QuestionPerformanceObservation[]=[];
  for(const session of sessions){
    if(session.status!=='submitted')continue;
    const version=versionById.get(session.examVersionId);if(!version)continue;
    for(const frozen of version.questions){
      observations.push({questionId:frozen.questionId,submitted:true,correct:session.answers[frozen.questionId]===frozen.snapshot.answer,section:frozen.snapshot.section,examLevel:frozen.snapshot.level});
    }
  }
  const ids=new Set(observations.map(item=>item.questionId));
  return new Map(Array.from(ids,id=>[id,aggregateQuestionPerformance(id,observations)]));
}
