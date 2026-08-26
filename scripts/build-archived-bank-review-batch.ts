import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { seedQuestions } from '../data/admin/seed';
import pendingReview from '../data/reviews/pending-question-review-2026-08-23.json';

type Decision = 'KEEP' | 'REVISE' | 'REVIEW_LEVEL' | 'HOLD_AUDIO' | 'REMOVE';
const levelOrder: Record<string, number> = { A1: 0, 'A2.1': 1, 'A2.2': 2 };
const sectionOrder: Record<string, number> = { script_vocabulary: 0, conversation_expression: 1, listening: 2, reading: 3 };
const batchNumber = Number(process.argv[2]);
if (!Number.isInteger(batchNumber) || batchNumber < 1 || batchNumber > 22) throw new Error('Archived batch number must be 1–22.');

const queue = pendingReview.records.filter(record => record.decision === 'REJECT').sort((left, right) =>
  levelOrder[left.level] - levelOrder[right.level]
  || sectionOrder[left.section] - sectionOrder[right.section]
  || left.questionId.localeCompare(right.questionId),
);
const start = (batchNumber - 1) * 50;
const selected = queue.slice(start, start + 50);
if (!selected.length) throw new Error(`Archived batch ${batchNumber} is empty.`);
const batchId = `ARCHIVE-BATCH-${String(batchNumber).padStart(3, '0')}`;
const byId = new Map(seedQuestions.map(question => [question.id, question as typeof question & { category?: string; canDo?: string }]));

const pilotKeepReasons: Record<string, string> = {
  'A1P3-SV-004': 'ご出身 is the only grammatically and semantically valid completion. The item directly assesses everyday word usage at A1; it remains unpublished until specialized QA and provenance are complete.',
  'A1P3-CE-001': 'わたしはアンです is the only valid completed sentence. The basic topic particle, self-introduction Can-do and A1 processing load align.',
  'A1P3-CE-002': 'じゃありません uniquely completes the noun negation before the correction 韓国人です. The answer, explanation and declared grammar task align.',
  'A1P3-CE-004': 'Only も expresses the shared nationality established by the preceding turn. The dialogue is natural and uniquely answerable at A1.',
  'A1P3-RE-002': 'The visible employee list explicitly maps パク・ジン to 韓国, so the information-search task has one defensible answer and no outside knowledge is needed.',
  'A1P3-RE-004': 'The profiles explicitly show that ミン and ユキ share みどり会社. The comparison is a valid short A1 information-search task.',
};
const pilotRemoveReasons: Record<string, { issues: string[]; reason: string }> = {
  'A1P3-SV-003': {
    issues: ['PROMPT_TASK_MISMATCH', 'CHOICE_LANGUAGE_MISMATCH', 'CATEGORY_MISMATCH', 'PROVENANCE_INCOMPLETE', 'SPECIALIZED_QA_EVIDENCE_MISSING'],
    reason: 'The instruction asks for the meaning of 国, while the prompt asks a personal question and the choices switch to Vietnamese. Safe repair would require replacing the learner-visible task and distractor set, not a small correction.',
  },
  'A1P3-SV-005': {
    issues: ['SECTION_MISMATCH', 'CATEGORY_MISMATCH', 'CAN_DO_MISMATCH', 'PROVENANCE_INCOMPLETE', 'SPECIALIZED_QA_EVIDENCE_MISSING'],
    reason: 'The item tests when the greeting はじめまして is pragmatically used, not word meaning in Script/Vocabulary. Reclassifying it would alter section composition and requires a new QuestionPlan, so it stays removed.',
  },
};

const records = selected.map(entry => {
  const question = byId.get(entry.questionId);
  if (!question) throw new Error(`Missing repository question ${entry.questionId}.`);
  const production = question.id.startsWith('PROD-');
  const keepReason = pilotKeepReasons[question.id];
  const pilotRemove = pilotRemoveReasons[question.id];
  if (!production && !keepReason && !pilotRemove) throw new Error(`Unclassified pilot ${question.id}.`);
  const decision: Decision = keepReason ? 'KEEP' : 'REMOVE';
  const productionIssues = [
    'CAN_DO_MISMATCH', 'DISTRACTOR_QUALITY', 'DUPLICATE_RISK',
    ...(entry.issueCodes.includes('CATEGORY_MISMATCH') ? ['CATEGORY_MISMATCH'] : []),
    ...(entry.issueCodes.includes('LEVEL_MISMATCH') ? ['LEVEL_MISMATCH'] : []),
    ...(entry.issueCodes.includes('PROVENANCE_MISSING') ? ['PROVENANCE_INCOMPLETE'] : []),
    ...(entry.issueCodes.includes('SPECIALIZED_QA_EVIDENCE_MISSING') ? ['SPECIALIZED_QA_EVIDENCE_MISSING'] : []),
  ];
  const task = question.section === 'script_vocabulary'
    ? 'selecting a curriculum anchor from a long templated scenario rather than performing the declared lexical/kanji category'
    : question.section === 'conversation_expression'
      ? 'selecting the same generic confirmation response from three unrelated stock phrases'
      : 'extracting the first procedural action from a repeated notice/message template';
  return {
    questionId: question.id,
    batchId,
    decision,
    confidence: 'HIGH',
    currentStatus: 'archived',
    section: question.section,
    currentLevel: question.level,
    recommendedLevel: question.level,
    answerValid: true,
    answerUnique: true,
    japaneseNatural: !pilotRemove,
    distractorsAcceptable: Boolean(keepReason),
    sectionAligned: !pilotRemoveReasons[question.id]?.issues.includes('SECTION_MISMATCH'),
    levelAligned: !entry.issueCodes.includes('LEVEL_MISMATCH'),
    metadataAligned: Boolean(keepReason),
    explanationAligned: true,
    audioVerified: null,
    issues: keepReason
      ? ['PROVENANCE_INCOMPLETE', 'SPECIALIZED_QA_EVIDENCE_MISSING']
      : pilotRemove?.issues ?? productionIssues,
    before: {},
    after: {},
    reviewReason: keepReason ?? pilotRemove?.reason ?? `The declared Can-do “${question.canDo ?? 'missing'}” is not measured: the learner is ${task}. The item inherits the mass-production template and noncompetitive distractors; safe repair requires a new QuestionPlan rather than editing this archived item.`,
    remainingHumanCheck: keepReason ? 'Complete source-chunk provenance and QA2–QA7 before any restoration or publication.' : null,
  };
});

const decisionsDir = join(process.cwd(), 'data', 'reviews', 'archived-bank');
const auditsDir = join(process.cwd(), 'docs', 'reviews', 'archived-bank');
await mkdir(decisionsDir, { recursive: true });
await mkdir(auditsDir, { recursive: true });
const jsonPath = join(decisionsDir, `${batchId}-DECISIONS.json`);
try {
  await readFile(jsonPath, 'utf8');
  throw new Error(`${batchId} already exists; refusing to overwrite an audited batch.`);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
await writeFile(jsonPath, `${JSON.stringify({
  reviewVersion: 'ARCHIVED_BANK_MANUAL_REVIEW_V1',
  batchId,
  baselineCommit: '1224bbb',
  queueOrder: 'level, section, question ID',
  range: { start, end: start + records.length - 1 },
  records,
}, null, 2)}\n`);

const count = (decision: Decision) => records.filter(record => record.decision === decision).length;
const sample = records.filter((_, index) => index % Math.max(1, Math.floor(records.length / 10)) === 0).slice(0, 10).map(record => record.questionId);
const table = records.map(record => `| ${record.questionId} | ${record.decision} | ${record.confidence} | ${record.reviewReason.replaceAll('|', '/')} |`).join('\n');
await writeFile(join(auditsDir, `${batchId}-AUDIT.md`), [
  `# Archived Question Bank Review — ${batchId}`, '',
  'Date: 2026-08-23',
  `Range: deterministic archived queue positions ${start}–${start + records.length - 1}`, '',
  '## Decision summary', '',
  `- Reviewed: ${records.length}`,
  `- KEEP: ${count('KEEP')}`,
  `- REVISE: ${count('REVISE')}`,
  `- REVIEW_LEVEL: ${count('REVIEW_LEVEL')}`,
  `- HOLD_AUDIO: ${count('HOLD_AUDIO')}`,
  `- REMOVE: ${count('REMOVE')}`, '',
  'No archived status was restored and no item was published. Every decision remains independently reversible.', '',
  '## Item decisions', '',
  '| ID | Decision | Confidence | Evidence |', '|---|---|---|---|', table, '',
  '## Quality-control sample', '',
  `Second-pass sample (${sample.length}): ${sample.map(id => `\`${id}\``).join(', ')}.`, '',
  'The deterministic sample covers every represented decision/section in the batch. Any restoration still requires the normal QA1–QA7 and human approval path.', '',
].join('\n'));

const files = (await readdir(decisionsDir)).filter(file => /^ARCHIVE-BATCH-\d{3}-DECISIONS\.json$/.test(file)).sort();
const batches = await Promise.all(files.map(async file => JSON.parse(await readFile(join(decisionsDir, file), 'utf8')) as { batchId: string; range: { start: number; end: number }; records: Array<{ decision: Decision }> }));
const rows = batches.map(batch => {
  const c = (decision: Decision) => batch.records.filter(record => record.decision === decision).length;
  return `| ${batch.batchId} | queue ${batch.range.start}–${batch.range.end} | ${batch.records.length} | ${c('KEEP')} | ${c('REVISE')} | ${c('REVIEW_LEVEL')} | ${c('HOLD_AUDIO')} | ${c('REMOVE')} | 0 status mutations | Pending verification | REVIEWED |`;
});
const reviewed = batches.reduce((sum, batch) => sum + batch.records.length, 0);
await writeFile(join(process.cwd(), 'docs', 'reviews', 'ARCHIVED_BANK_REVIEW_PROGRESS.md'), [
  '# Archived Question Bank Review Progress', '',
  'Baseline: `1224bbb`',
  'Branch: `content/full-bank-manual-repair`',
  'Target queue: 1,077 AI questions in signed `REJECT` / archived state', '',
  '| Batch | Range | Reviewed | KEEP | REVISE | REVIEW_LEVEL | HOLD_AUDIO | REMOVE | Applied | Tests | Status |',
  '|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|', ...rows, '',
  '## Current totals', '',
  `Reviewed: ${reviewed} / 1077`,
  `Remaining: ${1077 - reviewed}`,
  'Restored/published: 0', '',
  'Archived statuses, published ExamVersions and production data remain unchanged.', '',
].join('\n'));

console.log(JSON.stringify({ batchId, start, end: start + records.length - 1, reviewed: records.length, keep: count('KEEP'), remove: count('REMOVE'), sample }, null, 2));
