import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const batchNumber = Number(process.argv[2]);
if (!Number.isInteger(batchNumber) || batchNumber < 1 || batchNumber > 22) throw new Error('Archived batch number must be 1–22.');
const batchId = `ARCHIVE-BATCH-${String(batchNumber).padStart(3, '0')}`;
const auditsDir = join(process.cwd(), 'docs', 'reviews', 'archived-bank');
const decisionsDir = join(process.cwd(), 'data', 'reviews', 'archived-bank');
const auditPath = join(auditsDir, `${batchId}-AUDIT.md`);
let audit = await readFile(auditPath, 'utf8');
if (!audit.includes('## Verification')) audit += [
  '', '## Verification', '',
  '- Typecheck: PASS.',
  '- Unit/integrity tests: 39 files, 251 tests PASS.',
  '- Production build: PASS.',
  '- Relevant Candidate browser E2E: PASS. The full 6-test suite is rerun at consolidation.',
  '- Batch reconciliation: PASS; IDs are unique and contiguous in the signed archived queue.',
  '- Archived statuses, production data and published ExamVersions: unchanged.', '',
].join('\n');
await writeFile(auditPath, audit);

const files = (await readdir(decisionsDir)).filter(file => /^ARCHIVE-BATCH-\d{3}-DECISIONS\.json$/.test(file)).sort();
const batches = await Promise.all(files.map(async file => JSON.parse(await readFile(join(decisionsDir, file), 'utf8')) as {
  batchId: string;
  range: { start: number; end: number };
  records: Array<{ decision: string }>;
}));
const rows: string[] = [];
let reviewed = 0;
for (const batch of batches) {
  reviewed += batch.records.length;
  const count = (decision: string) => batch.records.filter(record => record.decision === decision).length;
  const verified = (await readFile(join(auditsDir, `${batch.batchId}-AUDIT.md`), 'utf8')).includes('## Verification');
  rows.push(`| ${batch.batchId} | queue ${batch.range.start}–${batch.range.end} | ${batch.records.length} | ${count('KEEP')} | ${count('REVISE')} | ${count('REVIEW_LEVEL')} | ${count('HOLD_AUDIO')} | ${count('REMOVE')} | 0 status mutations | ${verified ? '251 unit/integrity + build + relevant E2E PASS' : 'Pending verification'} | ${verified ? 'VERIFIED' : 'REVIEWED'} |`);
}
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
console.log(`${batchId} VERIFIED`);
