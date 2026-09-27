import type { ExamDraft } from '@/lib/admin-types';

export const PRODUCTION_EXAM_LEVELS=['A1','A2.1','A2.2'] as const;
export type ProductionExamLevel=(typeof PRODUCTION_EXAM_LEVELS)[number];
export const PRODUCTION_EXAMS_PER_LEVEL=20;
export const PRODUCTION_EXAM_QUESTIONS_PER_SECTION=12;
export const PRODUCTION_EXAM_QUESTIONS=48;
export const PRODUCTION_EXAM_DURATION_MINUTES=60;

function rules(level:ProductionExamLevel):ExamDraft['rules']{
  return [
    {section:'script_vocabulary',count:PRODUCTION_EXAM_QUESTIONS_PER_SECTION,allowBack:true,levels:[level]},
    {section:'conversation_expression',count:PRODUCTION_EXAM_QUESTIONS_PER_SECTION,allowBack:true,levels:[level]},
    {section:'listening',count:PRODUCTION_EXAM_QUESTIONS_PER_SECTION,allowBack:false,levels:[level]},
    {section:'reading',count:PRODUCTION_EXAM_QUESTIONS_PER_SECTION,allowBack:true,levels:[level]},
  ];
}

export const PRODUCTION_EXAM_DRAFTS:ExamDraft[]=PRODUCTION_EXAM_LEVELS.flatMap(level=>
  Array.from({length:PRODUCTION_EXAMS_PER_LEVEL},(_,index)=>{
    const form=index+1;
    return {
      id:`JFT-PRACTICE-${level.replaceAll('.','-')}-${String(form).padStart(3,'0')}`,
      title:`JFT Practice ${level} — Đề ${String(form).padStart(2,'0')}`,
      durationMinutes:PRODUCTION_EXAM_DURATION_MINUTES,
      status:'published' as const,
      rules:rules(level),
    };
  })
);
