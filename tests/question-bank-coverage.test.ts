import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { questions } from '@/data/questions';
import { expansionQuestions, listeningScripts } from '@/data/question-bank-expansion';

describe('JFT practice question bank', () => {
  it('contains a balanced approximately-50-item four-section blueprint', () => {
    expect(questions).toHaveLength(50);
    const counts = Object.fromEntries(['script_vocabulary','conversation_expression','listening','reading'].map(section => [section, questions.filter(q => q.section === section).length]));
    expect(counts).toEqual({script_vocabulary:13,conversation_expression:13,listening:12,reading:12});
    expect(new Set(questions.map(q => q.id)).size).toBe(questions.length);
  });

  it('covers A1, A2.1, and A2.2 in every section', () => {
    for (const section of ['script_vocabulary','conversation_expression','listening','reading'] as const) {
      expect(new Set(questions.filter(q => q.section === section).map(q => q.level))).toEqual(new Set(['A1','A2.1','A2.2']));
    }
  });

  it('keeps internal category, topic, and Can-do metadata on authored additions', () => {
    for (const question of expansionQuestions) {
      expect(question.tags.some(tag => tag.startsWith('category:'))).toBe(true);
      expect(question.tags.some(tag => tag.startsWith('topic:'))).toBe(true);
      expect(question.tags.some(tag => tag.startsWith('can-do:'))).toBe(true);
      expect(question.choices[question.answer]).toBeTruthy();
    }
  });

  it('has non-empty local audio and retained scripts for added listening items', () => {
    for (const question of expansionQuestions.filter(q => q.section === 'listening')) {
      expect(listeningScripts[question.id]).toBeTruthy();
      const audioPath = join(process.cwd(),'public',question.audioSrc!.replace(/^\//,''));
      expect(existsSync(audioPath)).toBe(true);
      expect(statSync(audioPath).size).toBeGreaterThan(1000);
    }
  });

  it('does not expose a single predictable correct-choice position', () => {
    const positions = new Set(expansionQuestions.map(q => q.answer));
    expect(positions).toEqual(new Set([0,1,2,3]));
  });
});
