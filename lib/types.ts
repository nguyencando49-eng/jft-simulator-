export type SectionId = 'script_vocabulary' | 'conversation_expression' | 'listening' | 'reading';
export type QuestionType = 'choice' | 'audio_choice';
export type ExamPhase = 'instructions' | 'audio_check' | 'section_intro' | 'testing' | 'final_confirm';

export interface Question {
  id: string;
  section: SectionId;
  type: QuestionType;
  level: 'A1' | 'A2.1' | 'A2.2';
  instruction: string;
  prompt: string;
  choices: string[];
  answer: number;
  explanationVi: string;
  audioSrc?: string;
  tags: string[];
}

export interface ExamBlueprint {
  id: string;
  title: string;
  durationMinutes: number;
  sections: { id: SectionId; title: string; allowBack: boolean }[];
}

export interface ExamState {
  answers: Record<string, number>;
  startedAt: number | null;
  expiresAt: number | null;
  currentIndex: number;
  phase: ExamPhase;
  language: 'ja' | 'vi';
  activeSection: SectionId;
}
