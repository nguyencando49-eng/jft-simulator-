import type { ExamDraft } from '@/lib/admin-types';

export const PRODUCTION_EXAM_LEVELS=['A1','A2.1','A2.2'] as const;
export type ProductionExamLevel=(typeof PRODUCTION_EXAM_LEVELS)[number];
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

export const PRODUCTION_EXAM_DRAFTS:ExamDraft[]=PRODUCTION_EXAM_LEVELS.map(level=>({
  id:`JFT-PRACTICE-${level.replaceAll('.','-')}-001`,
  title:`JFT Practice ${level} — Đề 01`,
  durationMinutes:PRODUCTION_EXAM_DURATION_MINUTES,
  status:'published',
  rules:rules(level),
}));
