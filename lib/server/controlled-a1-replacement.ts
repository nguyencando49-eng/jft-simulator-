import replacementPack from '@/data/production/controlled-a1-replacement-1320.json';
import type { QuestionRecord, QuestionStatus } from '@/lib/admin-types';
import type { Repository } from './domain';
import { runQuestionQa } from './qa';

export const CONTROLLED_A1_REPLACEMENT_VERSION = 'CONTROLLED_A1_1320_V1';
const REPLACEMENT_TAG = `replacement-batch:${CONTROLLED_A1_REPLACEMENT_VERSION}`;
const REPLACED_TAG = `replaced-by:${CONTROLLED_A1_REPLACEMENT_VERSION}`;
const PREVIOUS_STATUS_PREFIX = 'replacement-previous-status:';

function uniqueTags(tags: string[]) {
  return Array.from(new Set(tags));
}

export function buildControlledA1ReplacementQuestions(now = new Date().toISOString()) {
  const questions = replacementPack.questions.map((value) => ({
    ...value,
    status: 'review' as const,
    source: 'ai' as const,
    updatedAt: now,
    tags: uniqueTags([...value.tags, REPLACEMENT_TAG, 'qa-state:human-review-required']),
  })) as QuestionRecord[];

  if (questions.length !== 1320) throw new Error(`Expected 1320 replacement questions, received ${questions.length}.`);
  if (new Set(questions.map((question) => question.id)).size !== 1320) throw new Error('Replacement question IDs must be unique.');
  const invalid = questions.find((question) => !runQuestionQa(question).passed);
  if (invalid) throw new Error(`Q0 rejected replacement question ${invalid.id}.`);
  const listening = questions.filter((question) => question.section === 'listening');
  if (listening.length !== 330 || listening.some((question) => !question.audioSrc?.endsWith('.mp3'))) {
    throw new Error('Replacement release requires 330 Listening questions with MP3 audio.');
  }
  return questions;
}

function previousStatus(question: QuestionRecord): QuestionStatus | null {
  const value = question.tags.find((tag) => tag.startsWith(PREVIOUS_STATUS_PREFIX))?.slice(PREVIOUS_STATUS_PREFIX.length);
  return value === 'draft' || value === 'review' || value === 'approved' || value === 'archived' ? value : null;
}

export function previewControlledA1Replacement(existing: QuestionRecord[]) {
  const replacement = buildControlledA1ReplacementQuestions();
  const replacementIds = new Set(replacement.map((question) => question.id));
  const previous = existing.filter((question) => !replacementIds.has(question.id));
  return {
    releaseVersion: CONTROLLED_A1_REPLACEMENT_VERSION,
    existing: existing.length,
    willArchive: previous.filter((question) => question.status !== 'archived').length,
    alreadyArchived: previous.filter((question) => question.status === 'archived').length,
    willUpsert: replacement.length,
    byLevel: Object.fromEntries(['A1', 'A2.1', 'A2.2'].map((level) => [level, replacement.filter((q) => q.level === level).length])),
    listeningAudio: replacement.filter((question) => question.section === 'listening' && question.audioSrc).length,
  };
}

export async function applyControlledA1Replacement(repository: Repository) {
  const existing = await repository.listQuestions();
  const replacement = buildControlledA1ReplacementQuestions();
  const replacementIds = new Set(replacement.map((question) => question.id));
  const archivedAt = new Date().toISOString();
  const archived = existing
    .filter((question) => !replacementIds.has(question.id) && question.status !== 'archived')
    .map((question) => ({
      ...question,
      status: 'archived' as const,
      tags: uniqueTags([
        ...question.tags.filter((tag) => !tag.startsWith(PREVIOUS_STATUS_PREFIX)),
        REPLACED_TAG,
        `${PREVIOUS_STATUS_PREFIX}${previousStatus(question) ?? question.status}`,
      ]),
      updatedAt: archivedAt,
    }));

  // Insert the replacement first so a partial network failure cannot empty the active bank.
  await repository.upsertQuestions(replacement);
  await repository.upsertQuestions(archived);
  return { ...previewControlledA1Replacement(existing), archived: archived.length, imported: replacement.length };
}

export async function rollbackControlledA1Replacement(repository: Repository) {
  const existing = await repository.listQuestions();
  const restoredAt = new Date().toISOString();
  const replacementIds = new Set(buildControlledA1ReplacementQuestions().map((question) => question.id));
  const restored = existing
    .filter((question) => question.tags.includes(REPLACED_TAG) && previousStatus(question))
    .map((question) => ({
      ...question,
      status: previousStatus(question)!,
      tags: question.tags.filter((tag) => tag !== REPLACED_TAG && !tag.startsWith(PREVIOUS_STATUS_PREFIX)),
      updatedAt: restoredAt,
    }));
  const replacement = existing
    .filter((question) => replacementIds.has(question.id))
    .map((question) => ({ ...question, status: 'archived' as const, updatedAt: restoredAt }));
  await repository.upsertQuestions(restored);
  await repository.upsertQuestions(replacement);
  return { releaseVersion: CONTROLLED_A1_REPLACEMENT_VERSION, restored: restored.length, archivedReplacement: replacement.length };
}
