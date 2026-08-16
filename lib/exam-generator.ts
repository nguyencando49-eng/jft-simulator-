import { ExamDraft, ExamVersion, QuestionRecord } from './admin-types';

export type GenerateResult =
  | { ok: true; version: ExamVersion }
  | { ok: false; errors: string[] };

function hashSeed(input:string){
  let h=2166136261;
  for(let i=0;i<input.length;i++){h^=input.charCodeAt(i);h=Math.imul(h,16777619);}
  return h>>>0;
}
function mulberry32(seed:number){return()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function seededShuffle<T>(items:T[],seedText:string){
  const out=[...items]; const random=mulberry32(hashSeed(seedText));
  for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
  return out;
}

export function generateExamVersion(
  draft: ExamDraft,
  bank: QuestionRecord[],
  nextVersion = 1,
): GenerateResult {
  const errors: string[] = [];
  const picked: QuestionRecord[] = [];

  for (const rule of draft.rules) {
    const pool = bank.filter(q =>
      q.status === 'approved' &&
      q.section === rule.section &&
      rule.levels.includes(q.level)
    );

    if (pool.length < rule.count) {
      errors.push(`${rule.section}: cần ${rule.count} câu approved nhưng chỉ có ${pool.length}.`);
      continue;
    }

    const seed=`${draft.id}:v${nextVersion}:${rule.section}`;
    picked.push(...seededShuffle(pool,seed).slice(0, rule.count));
  }

  if (errors.length) return { ok: false, errors };

  const createdAt = new Date().toISOString();
  return {
    ok: true,
    version: {
      id: `${draft.id}-v${nextVersion}`,
      examId: draft.id,
      version: nextVersion,
      title: draft.title,
      durationMinutes: draft.durationMinutes,
      rules: JSON.parse(JSON.stringify(draft.rules)),
      createdAt,
      publishedAt: createdAt,
      questions: picked.map(q => ({
        questionId: q.id,
        questionVersion: q.version,
        snapshot: JSON.parse(JSON.stringify(q)),
      })),
    },
  };
}
