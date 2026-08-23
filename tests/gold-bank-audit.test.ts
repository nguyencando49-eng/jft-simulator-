import { describe, expect, it } from 'vitest';
import { questions } from '../data/questions';
import type { QuestionRecord } from '../lib/admin-types';
import type { Repository } from '../lib/server/domain';
import { applyGoldBankAudit, GOLD_BANK_AUDIO_HOLD_IDS, GOLD_BANK_LEVEL_REVIEW_IDS, GOLD_BANK_REVISED_IDS, previewGoldBankAudit } from '../lib/server/gold-bank-audit';

const expectedAnswers:Record<(typeof GOLD_BANK_REVISED_IDS)[number],string>={
  'SV-001':'おきます','SV-002':'来週の病院の診察を予約しました。','SV-003':'入る ところ',
  'SV-004':'みず','SV-005':'かいます','SV-006':'急げば 電車に間に合います。','SV-007':'かいさつ',
  'SV-011':'住所をもう一度確認してください。','SV-012':'みぎ','CE-004':'となり','CE-006':'降ったら',
  'CE-007':'はい。まず、このボタンを押してください。','CE-009':'わかりました。着いたら連絡してください。',
  'CE-010':'なければなりません','CE-011':'予約の時間を変更したいのですが。',
};

function record(id:string):QuestionRecord{
  const question=questions.find(item=>item.id===id);
  if(!question)throw new Error(`Missing fixture ${id}`);
  return {...structuredClone(question),version:3,status:'approved',source:'original',createdAt:'2026-08-01T00:00:00.000Z',updatedAt:'2026-08-01T00:00:00.000Z'};
}

function repository(bank:QuestionRecord[]){
  const rows=structuredClone(bank);
  const repo={
    async listQuestions(){return structuredClone(rows)},
    async upsertQuestions(next:QuestionRecord[]){for(const question of next){const index=rows.findIndex(item=>item.id===question.id);if(index<0)throw new Error('Unexpected insert');rows[index]=structuredClone(question)}return structuredClone(next)},
  } as Repository;
  return {repo,rows};
}

describe('Gold Bank 50 manual audit',()=>{
  it('keeps all revised IDs stable and maps the audited answer text to the stored answer index',()=>{
    expect(GOLD_BANK_REVISED_IDS).toHaveLength(15);
    for(const id of GOLD_BANK_REVISED_IDS){const question=questions.find(item=>item.id===id)!;expect(question.choices[question.answer],id).toBe(expectedAnswers[id])}
  });

  it('applies the explicit metadata corrections only',()=>{
    const byId=new Map(questions.map(question=>[question.id,question]));
    expect(byId.get('SV-003')?.tags).toContain('can-do:recognize-entrance-meaning');
    expect(byId.get('SV-004')?.tags).toContain('can-do:read-kanji-water');
    expect(byId.get('SV-005')?.tags).toContain('category:word-usage');
    expect(byId.get('SV-007')?.tags).toContain('can-do:read-kanji-ticket-gate');
    expect(byId.get('SV-012')?.tags).toContain('can-do:read-kanji-right');
  });

  it('does not relabel REVIEW_LEVEL items and leaves LI-002 held for audio verification',()=>{
    const byId=new Map(questions.map(question=>[question.id,question]));
    for(const id of GOLD_BANK_LEVEL_REVIEW_IDS)expect(byId.get(id)?.level,id).toBe('A2.2');
    expect(byId.get('LI-002')?.audioSrc).toBe('/audio/sample-02.wav');
    expect(GOLD_BANK_REVISED_IDS).not.toContain('LI-002');
    expect(GOLD_BANK_AUDIO_HOLD_IDS).toEqual(['LI-002']);
  });

  it('increments changed bank versions, preserves workflow status, and is idempotent',async()=>{
    const stale=[...GOLD_BANK_REVISED_IDS.map(id=>({...record(id),prompt:`LEGACY ${id}`})),record('LI-002')];
    stale[0].status='archived';
    const {repo,rows}=repository(stale),first=await applyGoldBankAudit(repo,'2026-08-23T01:00:00.000Z');
    expect(first.changed).toHaveLength(15);
    expect(first.held).toEqual([{id:'LI-002',version:3,status:'review'}]);
    expect(rows.find(item=>item.id==='SV-001')).toMatchObject({version:4,status:'archived'});
    expect(rows.find(item=>item.id==='SV-002')).toMatchObject({version:4,status:'approved'});
    const second=await applyGoldBankAudit(repo,'2026-08-23T02:00:00.000Z');
    expect(second.changed).toEqual([]);expect(second.held).toEqual([]);expect(second.unchanged).toHaveLength(15);
  });

  it('does not mutate an already frozen ExamVersion snapshot',()=>{
    const bank=[...GOLD_BANK_REVISED_IDS.map(id=>record(id)),{...record('LI-002'),status:'review' as const}],stale=bank.find(question=>question.id==='SV-001')!;
    stale.prompt='LEGACY SV-001';
    const snapshotBefore=structuredClone(stale),preview=previewGoldBankAudit(bank,'2026-08-23T01:00:00.000Z');
    expect(preview.changed.find(question=>question.id==='SV-001')?.prompt).toContain('8時に 会社へ 行きます');
    expect(snapshotBefore.prompt).toBe('LEGACY SV-001');
    expect(snapshotBefore.version).toBe(3);
  });
});
