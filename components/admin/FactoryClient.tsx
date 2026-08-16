'use client';
import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/lib/api-client';
import type { FactoryJob, FactoryRequest } from '@/lib/server/factory-domain';
import type { SectionId } from '@/lib/types';

const defaults:FactoryRequest={section:'script_vocabulary',level:'A2.1',topic:'仕事',canDo:'職場で簡単なやり取りができる',count:4,difficulty:'balanced',includeExplanation:true,generateAudioScript:true};
const labels:Record<SectionId,string>={script_vocabulary:'Script & Vocabulary',conversation_expression:'Conversation & Expression',listening:'Listening',reading:'Reading'};

export default function FactoryClient(){
  const [form,setForm]=useState(defaults); const [jobs,setJobs]=useState<FactoryJob[]>([]); const [selected,setSelected]=useState<FactoryJob|null>(null); const [picked,setPicked]=useState<Record<string,boolean>>({}); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(''); const [provider,setProvider]=useState('');
  const load=async()=>{try{const r=await adminApi.factoryJobs();setJobs(r.jobs);setProvider(r.provider);if(selected){const fresh=r.jobs.find(j=>j.id===selected.id);if(fresh)setSelected(fresh)}}catch(e){setMessage(e instanceof Error?e.message:String(e))}};
  useEffect(()=>{load()},[]);
  const generate=async()=>{setBusy(true);setMessage('');try{const r=await adminApi.createFactoryJob(form);setSelected(r.job);setPicked(Object.fromEntries(r.job.candidates.filter(c=>c.qa.passed).map(c=>[c.id,true])));setMessage(r.job.status==='failed'?(r.job.error||'Generation failed'):`Generated ${r.job.candidates.length} candidates.`);await load()}catch(e){setMessage(e instanceof Error?e.message:String(e))}finally{setBusy(false)}};
  const renderAudio=async(candidateId:string)=>{if(!selected)return;setBusy(true);setMessage('');try{const r=await adminApi.renderFactoryAudio(selected.id,candidateId);setSelected(r.job);setPicked(prev=>({...prev,[candidateId]:r.candidate.qa.passed}));setMessage('Audio rendered and QA refreshed.');await load()}catch(e){setMessage(e instanceof Error?e.message:String(e))}finally{setBusy(false)}};
  const approve=async()=>{if(!selected)return;const ids=Object.entries(picked).filter(([,v])=>v).map(([id])=>id);setBusy(true);try{const r=await adminApi.approveFactoryCandidates(selected.id,ids);setSelected(r.job);setMessage(`Approved ${r.approved} question(s) into Question Bank.`);await load()}catch(e){setMessage(e instanceof Error?e.message:String(e))}finally{setBusy(false)}};
  const stats=useMemo(()=>selected?{pass:selected.candidates.filter(c=>c.qa.passed).length,avg:selected.candidates.length?Math.round(selected.candidates.reduce((s,c)=>s+c.qa.score,0)/selected.candidates.length):0}:{pass:0,avg:0},[selected]);
  return <>
    <div className="admin-title"><div><span className="eyebrow">V5.1 · LISTENING FACTORY</span><h1>Generate → Semantic QA → TTS → Human Review</h1><p>Tạo batch câu hỏi, chạy QA cấu trúc + semantic, phát hiện gần-trùng, render TTS cho Listening rồi mới cho phép approve.</p></div><span className="badge green">Provider: {provider||'...'}</span></div>
    {message&&<div className={`admin-alert ${message.includes('failed')||message.includes('required')?'error':'ok'}`}>{message}</div>}
    <section className="factory-layout">
      <div className="admin-panel factory-form"><div className="panel-head"><h2>Generation brief</h2><span className="badge">Prompt v5.1</span></div>
        <label>Section<select value={form.section} onChange={e=>setForm({...form,section:e.target.value as SectionId})}>{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <div className="factory-2"><label>Level<select value={form.level} onChange={e=>setForm({...form,level:e.target.value as FactoryRequest['level']})}><option>A1</option><option>A2.1</option><option>A2.2</option></select></label><label>Difficulty<select value={form.difficulty} onChange={e=>setForm({...form,difficulty:e.target.value as FactoryRequest['difficulty']})}><option value="easy">Easy</option><option value="balanced">Balanced</option><option value="hard">Hard</option></select></label></div>
        <label>Topic<input value={form.topic} onChange={e=>setForm({...form,topic:e.target.value})} placeholder="仕事 / 買い物 / 病院..."/></label>
        <label>Can-do<textarea value={form.canDo||''} onChange={e=>setForm({...form,canDo:e.target.value})} rows={3}/></label>
        <label>Count<input type="number" min={1} max={20} value={form.count} onChange={e=>setForm({...form,count:Number(e.target.value)})}/></label>
        <label className="check-row"><input type="checkbox" checked={form.includeExplanation} onChange={e=>setForm({...form,includeExplanation:e.target.checked})}/> Vietnamese explanation</label>
        <label className="check-row"><input type="checkbox" checked={form.generateAudioScript} onChange={e=>setForm({...form,generateAudioScript:e.target.checked})}/> Generate listening audio script</label>
        <button className="primary" disabled={busy} onClick={generate}>{busy?'Generating...':'Generate candidates'}</button>
      </div>
      <div>
        <section className="metric-grid three factory-metrics"><Metric label="Candidates" value={String(selected?.candidates.length||0)}/><Metric label="QA passed" value={String(stats.pass)}/><Metric label="QA average" value={`${stats.avg}%`}/></section>
        <div className="admin-panel"><div className="panel-head"><h2>Generation jobs</h2><button className="secondary" onClick={load}>Refresh</button></div><div className="job-list">{jobs.length===0?<p className="empty">No jobs yet.</p>:jobs.map(j=><button key={j.id} onClick={()=>{setSelected(j);setPicked(Object.fromEntries(j.candidates.filter(c=>c.qa.passed&&!c.approvedAt).map(c=>[c.id,true])))}} className={selected?.id===j.id?'active':''}><span><b>{j.request.topic}</b><small>{labels[j.request.section]} · {j.request.level} · {j.request.count} requested</small></span><span className={`badge ${j.status==='completed'?'green':j.status}`}>{j.status}</span></button>)}</div></div>
      </div>
    </section>
    {selected&&<section className="admin-panel"><div className="panel-head"><div><h2>Human review queue</h2><small className="mono">job {selected.id}</small></div><button className="primary" disabled={busy||!Object.values(picked).some(Boolean)} onClick={approve}>Approve selected → Question Bank</button></div>
      <div className="factory-candidates">{selected.candidates.map((c,idx)=><article key={c.id} className={`factory-candidate ${c.qa.passed?'pass':'fail'}`}>
        <div className="candidate-top"><label><input type="checkbox" disabled={!c.qa.passed||!!c.approvedAt} checked={!!picked[c.id]&&!c.approvedAt} onChange={e=>setPicked({...picked,[c.id]:e.target.checked})}/><b>Candidate {idx+1}</b></label><div><span className={`qa-score ${c.qa.score>=85?'good':c.qa.score>=65?'warn':'bad'}`}>QA {c.qa.score}</span>{c.approvedAt&&<span className="badge green">approved</span>}</div></div>
        <p className="factory-prompt">{c.question.prompt}</p><ol>{c.question.choices.map((x,i)=><li key={i} className={i===c.question.answer?'correct':''}>{x}</li>)}</ol>
        {c.audioScript&&<div className="audio-script"><b>Audio script</b><p>{c.audioScript}</p>{c.question.type==='audio_choice'&&<div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><button className="secondary" disabled={busy} onClick={()=>renderAudio(c.id)}>{c.audio?.status==='ready'?'Re-render audio':c.audio?.status==='pending'?'Rendering...':'Render TTS audio'}</button>{c.audio&&<span className={`badge ${c.audio.status==='ready'?'green':c.audio.status==='failed'?'error':''}`}>{c.audio.status}</span>}{c.question.audioSrc&&<audio controls preload="none" src={c.question.audioSrc}/>}</div>}</div>}
        {c.semanticQa&&<div className="audio-script"><b>Semantic QA · {c.semanticQa.score}/100</b><p>{c.semanticQa.summary}</p><small>{c.semanticQa.provider}{c.semanticQa.model?` / ${c.semanticQa.model}`:''}</small></div>}
        <details><summary>QA report · {c.qa.issues.length} issue(s)</summary>{c.qa.issues.length===0?<p className="ok-text">No issues found.</p>:<ul className="qa-issues">{c.qa.issues.map((x,i)=><li key={i} className={x.severity}><b>{x.severity}</b> {x.message}</li>)}</ul>}</details>
        <small className="factory-meta">{c.generation.provider} / {c.generation.model||'default'} · {c.generation.promptVersion}</small>
      </article>)}</div>
    </section>}
  </>
}
function Metric({label,value}:{label:string,value:string}){return <div className="metric"><span>{label}</span><strong>{value}</strong></div>}
