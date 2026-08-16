import { QuestionRecord } from '@/lib/admin-types';
import { ImportResult } from './domain';
import { runQuestionQa } from './qa';

export function importQuestionRows(rows: unknown[]): ImportResult {
  const accepted: QuestionRecord[] = [];
  const rejected: ImportResult['rejected'] = [];
  rows.forEach((row, index) => {
    const q = normalize(row);
    if (!q) {
      rejected.push({ row:index+1, issues:[{code:'schema',severity:'error',message:'Invalid question schema.'}] });
      return;
    }
    const qa = runQuestionQa(q);
    if (!qa.passed) rejected.push({ row:index+1, issues:qa.issues }); else accepted.push(q);
  });
  return { accepted, rejected };
}

function normalize(value: unknown): QuestionRecord | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.section !== 'string' || typeof r.type !== 'string' || typeof r.level !== 'string') return null;
  const now = new Date().toISOString();
  return {
    id:r.id,
    section:r.section as QuestionRecord['section'],
    type:r.type as QuestionRecord['type'],
    level:r.level as QuestionRecord['level'],
    instruction:String(r.instruction ?? ''),
    prompt:String(r.prompt ?? ''),
    choices:Array.isArray(r.choices) ? r.choices.map(String) : [],
    answer:Number(r.answer),
    explanationVi:String(r.explanationVi ?? ''),
    audioSrc:typeof r.audioSrc === 'string' ? r.audioSrc : undefined,
    tags:Array.isArray(r.tags) ? r.tags.map(String) : [],
    version:Number.isInteger(r.version) ? Number(r.version) : 1,
    status:(['draft','review','approved','archived'].includes(String(r.status)) ? r.status : 'draft') as QuestionRecord['status'],
    source:'imported', createdAt:typeof r.createdAt==='string'?r.createdAt:now, updatedAt:now,
  };
}

export function parseCsv(text:string):Record<string,string>[] {
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);
  if(!lines.length) return [];
  const headers=parseCsvLine(lines[0]);
  return lines.slice(1).map(line=>{ const vals=parseCsvLine(line); return Object.fromEntries(headers.map((h,i)=>[h,vals[i]??''])); });
}
function parseCsvLine(line:string){ const out:string[]=[]; let cur=''; let quoted=false; for(let i=0;i<line.length;i++){ const c=line[i]; if(c==='"'){ if(quoted&&line[i+1]==='"'){cur+='"';i++;}else quoted=!quoted; } else if(c===','&&!quoted){out.push(cur);cur='';} else cur+=c;} out.push(cur); return out; }
export function csvRowsToQuestions(rows:Record<string,string>[]){ return rows.map(r=>({ ...r, choices:safeJson(r.choices,[]), tags:safeJson(r.tags,[]), answer:Number(r.answer), version:Number(r.version||1) })); }
function safeJson(raw:string,fallback:unknown){ try{return JSON.parse(raw);}catch{return fallback;} }
