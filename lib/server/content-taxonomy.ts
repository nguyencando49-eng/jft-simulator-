import type { Question, SectionId } from '@/lib/types';

export const JFT_OFFICIAL_REFERENCE_VERSION='JFT_OFFICIAL_SPEC_2026_08_17' as const;
export const JFT_SIMULATOR_TAXONOMY_VERSION='JFT_SIMULATOR_TAXONOMY_V1' as const;
export const JFT_REFERENCE_RUBRIC={
  authority:'OFFICIAL_REFERENCE',
  verifiedDate:'2026-08-17',
  sourceFiles:['docs/jft-spec/JFT_OFFICIAL_SPEC.md','docs/jft-spec/AGENT_RULES.md','docs/jft-spec/JFT_CAN_DO_GUIDE.md'],
  supportedFacts:[
    'JFT-Basic assesses practical Japanese communication for everyday situations in Japan.',
    'Questions are based on A1-A2 Can-do ability.',
    'The assessment has Script and Vocabulary, Conversation and Expression, Listening, and Reading sections.',
    'The official category families cover word meaning and usage, kanji reading and meaning/usage, grammar and expression, conversation/shop-public/announcement-instruction listening, and content-comprehension/information-search reading.',
  ],
  limitations:[
    'The repository has no machine-readable official Can-do inventory.',
    'Detailed category-boundary heuristics, construct-validity rules, modality thresholds, scoring, and release gates are simulator design decisions.',
  ],
} as const;

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
