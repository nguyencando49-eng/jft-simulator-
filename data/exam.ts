import { ExamBlueprint } from '@/lib/types';

export const mockExam: ExamBlueprint = {
  id: 'JFT-MOCK-001',
  title: 'JFT-Basic Mock Test #001',
  durationMinutes: 60,
  sections: [
    { id: 'script_vocabulary', title: 'Script and Vocabulary', allowBack: true },
    { id: 'conversation_expression', title: 'Conversation and Expression', allowBack: true },
    { id: 'listening', title: 'Listening Comprehension', allowBack: false },
    { id: 'reading', title: 'Reading Comprehension', allowBack: true },
  ],
};
