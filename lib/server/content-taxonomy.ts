import type { Question, SectionId } from '@/lib/types';

export const CONTENT_LEVELS = ['A1', 'A2.1', 'A2.2'] as const satisfies readonly Question['level'][];
export type ContentLevel = (typeof CONTENT_LEVELS)[number];
export const INTERNAL_LEVEL = { A1:'A1', A2_1:'A2.1', A2_2:'A2.2' } as const;

export const JFT_CATEGORIES = {
  script_vocabulary: ['word_meaning','word_usage','kanji_reading','kanji_meaning_usage'],
  conversation_expression: ['grammar','expression'],
  listening: ['conversation','shop_public','announcement_instruction'],
  reading: ['content_comprehension','information_search'],
} as const satisfies Record<SectionId, readonly string[]>;
export type JftCategory = (typeof JFT_CATEGORIES)[SectionId][number];

/** SIMULATOR_DESIGN_DECISION: practical production taxonomy, not an official JFT classification. */
export const PRACTICAL_TOPICS = [
  'personal_information','family','home','daily_routine','food','shopping','restaurant','work',
  'workplace_instructions','schedule','transportation','directions','hospital','health','city_hall',
  'public_services','bank','post_office','housing','garbage','disaster','weather','phone','appointment',
  'school','community','leisure','rules_and_notices',
] as const;
export type PracticalTopic = (typeof PRACTICAL_TOPICS)[number];

export type ContentDifficulty = 'easy'|'medium'|'hard';
export const DEFAULT_DIFFICULTY_DISTRIBUTION = { easy:.3, medium:.5, hard:.2 } as const;
export const isLevel = (value:unknown):value is ContentLevel => CONTENT_LEVELS.includes(value as ContentLevel);
export const isCategoryForSection = (section:SectionId,category:string) => (JFT_CATEGORIES[section] as readonly string[]).includes(category);
