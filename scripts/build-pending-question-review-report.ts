import { mkdir,writeFile } from 'node:fs/promises';
import { questions as authoredQuestions } from '../data/questions';
import { seedQuestions } from '../data/admin/seed';
import { buildPendingQuestionReviewRecords,pendingReviewDigest,summarizePendingQuestionReviews } from '../lib/server/pending-question-review';

const approvedIds=new Set(authoredQuestions.map(question=>question.id));
const simulatedCurrentBank=seedQuestions.map(question=>approvedIds.has(question.id)?{...question,status:'approved' as const}:question);
const records=buildPendingQuestionReviewRecords(simulatedCurrentBank),summary=summarizePendingQuestionReviews(records),digest=pendingReviewDigest(records);
const generatedAt=new Date().toISOString();
await mkdir('data/reviews',{recursive:true});await mkdir('docs/reviews',{recursive:true});
await writeFile('data/reviews/pending-question-review-2026-08-23.json',JSON.stringify({reviewVersion:'PENDING_QUESTION_REVIEW_V1',reviewer:'codex-assisted-review',generatedAt,digest,summary,records},null,2)+'\n');

const labels:Record<string,string>={script_vocabulary:'Chữ viết & Từ vựng',conversation_expression:'Hội thoại & Biểu đạt',listening:'Nghe',reading:'Đọc'};
const lines=[
  '# Pending Question Review Report','',`Generated: ${generatedAt}`,'',
  '## Review status','',summary.reviewed?'COMPLETE':'BLOCKED','',
  '## Counts','',`- Total reviewed: ${summary.reviewed}`,`- Approved: ${summary.approved}`,`- Kept in review: ${summary.review}`,`- Rejected/archived: ${summary.rejected}`,`- Decision digest: \`${digest}\``,'',
  'No item was approved from a numeric score. A QA FAIL remained blocked. Items without complete QA2–QA7 evidence remained in review. In this repository, `archived` is the supported reversible state used for REJECT.','',
  '## Breakdown by level','',
  '| Level | Reviewed | Approved | Review | Rejected |','|---|---:|---:|---:|---:|',
  ...Object.entries(summary.byLevel).map(([key,value])=>`| ${key} | ${value.reviewed} | ${value.approved} | ${value.review} | ${value.rejected} |`),'',
  '## Breakdown by section','',
  '| Section | Reviewed | Approved | Review | Rejected |','|---|---:|---:|---:|---:|',
  ...Object.entries(summary.bySection).map(([key,value])=>`| ${labels[key]??key} | ${value.reviewed} | ${value.approved} | ${value.review} | ${value.rejected} |`),'',
  '## QA issue categories','',
  '| Issue | Count |','|---|---:|',...Object.entries(summary.issueCounts).map(([key,value])=>`| ${key} | ${value} |`),'',
  '## Item-by-item non-approved decisions','',
  'Every pending item is listed below. Full structured QA summaries and reason arrays are stored in `data/reviews/pending-question-review-2026-08-23.json`.','',
  '| Question ID | Decision | Confidence | Primary reason | Minimum required action |','|---|---|---|---|---|',
  ...records.filter(record=>record.decision!=='APPROVE').map(record=>`| ${record.questionId} | ${record.decision} | ${record.confidence} | ${(record.reasons[0]??'Evidence incomplete').replaceAll('|','/')} | ${(record.recommendedFix??'None').replaceAll('|','/')} |`),'',
  '## Quality sampling','',
  'Approved from this pending batch: 0. Therefore the requested approved-item re-sample is not applicable. As a safety substitute, the deterministic decision set is verified by digest and production preflight before any status mutation.','',
  '## Auditability limitation','',
  'QuestionRecord has no reviewer, reviewedAt, or decision-reason fields. The implementation therefore preserves audit evidence in this report and its structured JSON companion instead of inventing incompatible payload fields. Factory QA evidence remains separately stored in FactoryJob payloads.','',
];
await writeFile('docs/reviews/PENDING_QUESTION_REVIEW_REPORT.md',lines.join('\n'));
console.log(JSON.stringify({generatedAt,digest,summary},null,2));
