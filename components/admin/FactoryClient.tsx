'use client';
import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/lib/api-client';
import type { FactoryJob, FactoryRequest } from '@/lib/server/factory-domain';
import type { SectionId } from '@/lib/types';

const defaults:FactoryRequest={section:'script_vocabulary',level:'A2.1',topic:'仕事',canDo:'職場で簡単なやり取りができる',count:4,difficulty:'balanced',includeExplanation:true,generateAudioScript:true};
const labels:Record<SectionId,string>={script_vocabulary:'Script & Vocabulary',conversation_expression:'Conversation & Expression',listening:'Listening',reading:'Reading'};
type Candidate=FactoryJob['candidates'][number];
const hasSpecializedReview=(candidate:Candidate)=>[candidate.contentQa,candidate.answerOracleQa,candidate.japaneseNaturalnessQa,candidate.curriculumGroundingQa,candidate.jftAlignmentQa,candidate.difficultyCalibrationQa,candidate.originalityDuplicateQa].some(result=>result?.verdict==='REVIEW');
const automaticallySelectable=(candidate:Candidate)=>candidate.qa.passed&&!candidate.approvedAt&&!hasSpecializedReview(candidate);

export default function FactoryClient(){
  const [form,setForm]=useState(defaults); const [jobs,setJobs]=useState<FactoryJob[]>([]); const [selected,setSelected]=useState<FactoryJob|null>(null); const [picked,setPicked]=useState<Record<string,boolean>>({}); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(''); const [provider,setProvider]=useState('');
  const load=async()=>{try{const r=await adminApi.factoryJobs();setJobs(r.jobs);setProvider(r.provider);if(selected){const fresh=r.jobs.find(j=>j.id===selected.id);if(fresh)setSelected(fresh)}}catch(e){setMessage(e instanceof Error?e.message:String(e))}};
  useEffect(()=>{load()},[]);
  const generate=async()=>{setBusy(true);setMessage('');try{const r=await adminApi.createFactoryJob(form);setSelected(r.job);setPicked(Object.fromEntries(r.job.candidates.filter(automaticallySelectable).map(c=>[c.id,true])));setMessage(r.job.status==='failed'?(r.job.error||'Generation failed'):`Generated ${r.job.candidates.length} candidates.`);await load()}catch(e){setMessage(e instanceof Error?e.message:String(e))}finally{setBusy(false)}};
  const renderAudio=async(candidateId:string)=>{if(!selected)return;setBusy(true);setMessage('');try{const r=await adminApi.renderFactoryAudio(selected.id,candidateId);setSelected(r.job);setPicked(prev=>({...prev,[candidateId]:automaticallySelectable(r.candidate)}));setMessage('Audio rendered and QA refreshed.');await load()}catch(e){setMessage(e instanceof Error?e.message:String(e))}finally{setBusy(false)}};
  const approve=async()=>{if(!selected)return;const ids=Object.entries(picked).filter(([,v])=>v).map(([id])=>id);setBusy(true);try{const r=await adminApi.approveFactoryCandidates(selected.id,ids);setSelected(r.job);setMessage(`Approved ${r.approved} question(s) into Question Bank.`);await load()}catch(e){setMessage(e instanceof Error?e.message:String(e))}finally{setBusy(false)}};
  const stats=useMemo(()=>selected?{pass:selected.candidates.filter(automaticallySelectable).length,avg:selected.candidates.length?Math.round(selected.candidates.reduce((s,c)=>s+c.qa.score,0)/selected.candidates.length):0}:{pass:0,avg:0},[selected]);
  return <>
    <div className="admin-title"><div><span className="eyebrow">CONTENT REVIEW WORKSPACE</span><h1>AI Question Factory</h1><p>Generate a controlled batch, review content and QA, prepare listening audio, then approve items into the Question Bank.</p></div></div>
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
        <div className="admin-panel"><div className="panel-head"><h2>Generation jobs</h2><button className="secondary" onClick={load}>Refresh</button></div><div className="job-list">{jobs.length===0?<p className="empty">No jobs yet.</p>:jobs.map(j=><button key={j.id} onClick={()=>{setSelected(j);setPicked(Object.fromEntries(j.candidates.filter(automaticallySelectable).map(c=>[c.id,true])))}} className={selected?.id===j.id?'active':''}><span><b>{j.request.topic}</b><small>{labels[j.request.section]} · {j.request.level} · {j.request.count} requested</small></span><span className={`badge ${j.status==='completed'?'green':j.status}`}>{j.status}</span></button>)}</div></div>
      </div>
    </section>
    {selected&&<section className="admin-panel"><div className="panel-head"><div><h2>Human review queue</h2><small className="mono">job {selected.id}</small></div><button className="primary" disabled={busy||!Object.values(picked).some(Boolean)} onClick={approve}>Approve selected → Question Bank</button></div>
      <div className="factory-candidates">{selected.candidates.map((c,idx)=><article key={c.id} className={`factory-candidate ${!c.qa.passed?'fail':hasSpecializedReview(c)?'review':'pass'}`}>
        <div className="candidate-top"><label><input type="checkbox" disabled={!c.qa.passed||!!c.approvedAt} checked={!!picked[c.id]&&!c.approvedAt} onChange={e=>setPicked({...picked,[c.id]:e.target.checked})}/><b>Candidate {idx+1}</b></label><div><span className={`qa-score ${c.qa.score>=85?'good':c.qa.score>=65?'warn':'bad'}`}>QA {c.qa.score}</span>{c.approvedAt&&<span className="badge green">approved</span>}</div></div>
        <p className="factory-prompt">{c.question.prompt}</p><ol>{c.question.choices.map((x,i)=><li key={i} className={i===c.question.answer?'correct':''}>{x}</li>)}</ol>
        {c.audioScript&&<div className="audio-script"><b>Audio script</b><p>{c.audioScript}</p>{c.question.type==='audio_choice'&&<div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><button className="secondary" disabled={busy} onClick={()=>renderAudio(c.id)}>{c.audio?.status==='ready'?'Re-render audio':'Render TTS audio'}</button>{c.audio&&<span className={`badge ${c.audio.status==='ready'?'green':c.audio.status==='failed'?'error':''}`}>{c.audio.status}</span>}{c.question.audioSrc&&<audio controls preload="none" src={c.question.audioSrc}/>}</div>}</div>}
        {c.semanticQa&&<div className="audio-script"><b>Semantic QA · {c.semanticQa.score}/100</b><p>{c.semanticQa.summary}</p><small>{c.semanticQa.provider}{c.semanticQa.model?` / ${c.semanticQa.model}`:''}</small></div>}
        {c.answerOracleQa&&<div className="audio-script" data-testid="answer-oracle-result"><b>QA2 — Answer Oracle</b><p><span className={`badge ${c.answerOracleQa.verdict==='PASS'?'green':c.answerOracleQa.verdict==='FAIL'?'error':''}`}>{c.answerOracleQa.verdict}</span> Derived: {c.answerOracleQa.derivedCorrectOptions.length?c.answerOracleQa.derivedCorrectOptions.map(i=>String.fromCharCode(65+i)).join(', '):'None'} · Declared: {c.answerOracleQa.declaredCorrectOption>=0?String.fromCharCode(65+c.answerOracleQa.declaredCorrectOption):'Unavailable'} · Confidence: {Math.round(c.answerOracleQa.confidence*100)}% · Defensible: {c.answerOracleQa.numberOfDefensibleAnswers}</p><details><summary>Choice analysis</summary><ol>{c.answerOracleQa.choiceAnalysis.map(item=><li key={item.index}><b>{String.fromCharCode(65+item.index)} — {item.classification}</b><br/><small>{item.reason}</small></li>)}</ol></details><small>{c.answerOracleQa.outcome} · {c.answerOracleQa.provider}{c.answerOracleQa.model?` / ${c.answerOracleQa.model}`:''} · {c.answerOracleQa.promptVersion}</small></div>}
        {c.japaneseNaturalnessQa&&<div className="audio-script" data-testid="japanese-naturalness-result"><b>QA3 — Japanese Naturalness</b><p><span className={`badge ${c.japaneseNaturalnessQa.verdict==='PASS'?'green':c.japaneseNaturalnessQa.verdict==='FAIL'?'error':''}`}>{c.japaneseNaturalnessQa.verdict}</span> Score: {c.japaneseNaturalnessQa.scores.overall}/100 · Confidence: {c.japaneseNaturalnessQa.confidence} · Style: {c.japaneseNaturalnessQa.contextAssessment.actualStyle} ({c.japaneseNaturalnessQa.contextAssessment.fit})</p><details><summary>Grammar, collocation, register, context and choices</summary><p>Grammar {c.japaneseNaturalnessQa.scores.grammar}/20 · Naturalness {c.japaneseNaturalnessQa.scores.naturalness}/20 · Collocation {c.japaneseNaturalnessQa.scores.collocation}/15 · Register {c.japaneseNaturalnessQa.scores.register}/15 · Context {c.japaneseNaturalnessQa.scores.contextFit}/10 · Spoken/Written {c.japaneseNaturalnessQa.scores.spokenWrittenFit}/10 · Flow {c.japaneseNaturalnessQa.scores.conversationFlow}/10</p>{c.japaneseNaturalnessQa.issues.length?<ul className="qa-issues">{c.japaneseNaturalnessQa.issues.map((item,index)=><li key={index} className={item.severity==='CRITICAL'||item.severity==='MAJOR'?'error':'warning'}><b>{item.code}</b> — {item.evidence}<br/><small>{item.reason}</small></li>)}</ul>:<p className="ok-text">No Japanese-language issues found.</p>}<ol>{c.japaneseNaturalnessQa.choiceLanguageAnalysis.map(item=><li key={item.index}>{String.fromCharCode(65+item.index)} — {item.natural?'Natural':'Needs review'}{item.issues.length?`: ${item.issues.join(', ')}`:''}</li>)}</ol></details><small>{c.japaneseNaturalnessQa.provider}{c.japaneseNaturalnessQa.model?` / ${c.japaneseNaturalnessQa.model}`:''} · {c.japaneseNaturalnessQa.promptVersion}</small></div>}
        {c.curriculumGroundingQa&&<CurriculumGroundingPanel result={c.curriculumGroundingQa}/>}
        {c.jftAlignmentQa&&<JftAlignmentPanel result={c.jftAlignmentQa}/>}
        {c.difficultyCalibrationQa&&<DifficultyCalibrationPanel result={c.difficultyCalibrationQa}/>}
        {c.originalityDuplicateQa&&<OriginalityDuplicatePanel result={c.originalityDuplicateQa}/>}
        <details><summary>QA report · {c.qa.issues.length} issue(s)</summary>{c.qa.issues.length===0?<p className="ok-text">No issues found.</p>:<ul className="qa-issues">{c.qa.issues.map((x,i)=><li key={i} className={x.severity}><b>{x.severity}</b> {x.message}</li>)}</ul>}</details>
        <details><summary>Generation audit</summary><small className="factory-meta">{c.generation.provider} / {c.generation.model||'default'} · {c.generation.promptVersion}</small></details>
      </article>)}</div>
    </section>}
  </>
}
function Metric({label,value}:{label:string,value:string}){return <div className="metric"><span>{label}</span><strong>{value}</strong></div>}

function CurriculumGroundingPanel({result}:{result:NonNullable<FactoryJob['candidates'][number]['curriculumGroundingQa']>}){
  const groups=Array.from(new Set(result.knowledgeAnalysis.map(item=>item.type)));
  return <div className="audio-script" data-testid="curriculum-grounding-result">
    <b>QA4 — Curriculum Grounding</b>
    <p><span className={`badge ${result.verdict==='PASS'?'green':result.verdict==='FAIL'?'error':''}`}>{result.verdict}</span> Coverage: {result.coverage.supportedCount}/{result.coverage.requiredCount} required knowledge supported · Confidence: {result.confidence}</p>
    <p><small>Retrieval: {result.retrieval.complete?'complete':'incomplete'} ({result.retrieval.returnedUnitCount}/{result.retrieval.totalApprovedUnits} approved units) · Provenance: {result.provenance.complete?'complete':'incomplete'}</small></p>
    <details><summary>Knowledge mappings and curriculum trace</summary>
      {groups.length?groups.map(type=><section key={type}><b>{type.replaceAll('_',' ')}</b><ul className="qa-issues">{result.knowledgeAnalysis.filter(item=>item.type===type).map((item,index)=><li key={`${item.value}-${index}`} className={item.support==='UNSUPPORTED'?'error':item.support==='SUPPORTED'?'':'warning'}><b>{item.support}</b> — {item.value}<br/><small>{item.role} · {item.reason}<br/>{item.evidence}<br/>{item.knowledgeUnitIds.length?item.knowledgeUnitIds.join(', '):'No approved KnowledgeUnit support'}{item.sourceChunkIds.length?` → ${item.sourceChunkIds.join(', ')}`:''}</small></li>)}</ul></section>):<p className="empty">No validated knowledge analysis is available.</p>}
      {result.outsideKnowledge.length>0&&<><b>Outside curriculum</b><ul>{result.outsideKnowledge.map((item,index)=><li key={index}>{item.type}: {item.value} — {item.reason}</li>)}</ul></>}
      {result.issues.length>0&&<><b>QA4 issues</b><ul className="qa-issues">{result.issues.map((item,index)=><li key={index} className={item.severity==='CRITICAL'||item.severity==='MAJOR'?'error':'warning'}><b>{item.code}</b> — {item.evidence}<br/><small>{item.reason}</small></li>)}</ul></>}
    </details>
    <small>{result.provider}{result.model?` / ${result.model}`:''} · {result.promptVersion}</small>
  </div>
}

function JftAlignmentPanel({result}:{result:NonNullable<FactoryJob['candidates'][number]['jftAlignmentQa']>}){
  const value=(text:string|undefined)=>text?.trim()||'Not declared';
  return <div className="audio-script" data-testid="jft-alignment-result">
    <b>QA5 — JFT Alignment</b>
    <p><span className={`badge ${result.verdict==='PASS'?'green':result.verdict==='FAIL'?'error':'review'}`}>{result.verdict}</span> Score: {result.scores.total}/100 · Confidence: {result.confidence}</p>
    <p><b>Declared:</b> {value(result.declared.section)} / {value(result.declared.category)}<br/><b>Detected:</b> {value(result.independentAssessment.actualSection)} / {value(result.independentAssessment.actualCategory)}</p>
    <p><small>Can-do: {result.alignment.canDo} · Modality: {result.independentAssessment.requiredModality} ({result.alignment.modalityDependency}) · Task validity: {result.taskValidity.realWorldValidity}</small></p>
    <details><summary>Assessment target, alignment and issues</summary>
      <p><b>Actual assessment target</b><br/>{value(result.independentAssessment.actualAssessmentTarget)}</p>
      <p><b>Can-do</b><br/>Declared: {value(result.declared.canDo)}<br/>Detected: {value(result.independentAssessment.actualCanDo)}</p>
      <p><b>Task type</b><br/>Declared: {value(result.declared.taskType)}<br/>Detected: {value(result.independentAssessment.actualTaskType)} · Alignment: {result.alignment.taskType}</p>
      <p><b>Communicative purpose</b><br/>{value(result.independentAssessment.communicativePurpose)}</p>
      <p>Section {result.alignment.section} · Category {result.alignment.category} · Can-do {result.alignment.canDo} · Task {result.alignment.taskType}</p>
      {result.taskValidity.constructUnderrepresented&&<p className="ui-alert warning"><b>Construct underrepresented:</b> the item does not fully measure the declared skill.</p>}
      {result.taskValidity.constructIrrelevantClues.length>0&&<><b>Construct-irrelevant clues</b><ul>{result.taskValidity.constructIrrelevantClues.map((clue,index)=><li key={index}>{clue}</li>)}</ul></>}
      {result.issues.length>0?<><b>QA5 issues</b><ul className="qa-issues">{result.issues.map((item,index)=><li key={index} className={item.severity==='CRITICAL'||item.severity==='MAJOR'?'error':'warning'}><b>{item.code}</b> — {item.evidence}<br/><small>{item.reason}<br/><b>Action:</b> {item.suggestedAction}</small></li>)}</ul></>:<p className="ok-text">No JFT-alignment issues found.</p>}
      {result.release.blockReason.length>0&&<p><b>Release blockers</b><br/><small>{result.release.blockReason.join(', ')}</small></p>}
    </details>
    <small>{result.provider}{result.model?` / ${result.model}`:''} · {result.promptVersion} · Reference {result.referenceVersion} · Taxonomy {result.taxonomyVersion}</small>
  </div>
}

function DifficultyCalibrationPanel({result}:{result:NonNullable<FactoryJob['candidates'][number]['difficultyCalibrationQa']>}){
  const dimensions=Object.entries(result.profile) as Array<[string,number]>;
  return <div className="audio-script" data-testid="difficulty-calibration-result">
    <b>QA6 — Difficulty Calibration</b>
    <p><span className={`badge ${result.verdict==='PASS'?'green':result.verdict==='FAIL'?'error':'review'}`}>{result.verdict}</span> Declared: {result.declaredLevel} · Estimated: {result.estimatedLevel} · Confidence: {result.confidence}</p>
    <p><b>Internal difficulty:</b> {result.difficultyScore.toFixed(2)} · {result.levelMatch.replaceAll('_',' ')} · {result.calibrationSource.replaceAll('_',' ')}</p>
    <details><summary>Difficulty signals, empirical evidence and issues</summary>
      <ul className="qa-issues">{dimensions.map(([name,value])=><li key={name}><b>{name.replace(/([A-Z])/g,' $1')}</b> — {value.toFixed(2)}</li>)}</ul>
      <p>Reasoning: {result.reasoningDepth.replaceAll('_',' ')} · Distractors: {result.distractorStrength}</p>
      <p><b>Empirical:</b> {result.empirical.available?`${result.empirical.attemptCount} attempts · ${result.empirical.correctRate===null?'correct rate unavailable':`${Math.round(result.empirical.correctRate*100)}% correct`} · ${result.empirical.sufficientSample?'sufficient sample':'sample pending'}`:'No published attempt data yet'}<br/><small>Median item response time: {result.empirical.medianResponseTimeMs===null?'not recorded':`${result.empirical.medianResponseTimeMs} ms`} · Status: {result.calibrationStatus.replaceAll('_',' ')}</small></p>
      {result.issues.length?<><b>QA6 issues</b><ul className="qa-issues">{result.issues.map((item,index)=><li key={index} className={item.severity==='CRITICAL'||item.severity==='MAJOR'?'error':'warning'}><b>{item.code}</b> — {item.evidence}<br/><small>{item.reason}<br/><b>Action:</b> {item.suggestedAction}</small></li>)}</ul></>:<p className="ok-text">No difficulty-calibration issues found.</p>}
      {result.release.blockReason.length>0&&<p><b>Release blockers</b><br/><small>{result.release.blockReason.join(', ')}</small></p>}
    </details>
    <small>{result.provider}{result.model?` / ${result.model}`:''} · {result.promptVersion} · Calibration {result.calibrationVersion}</small>
  </div>
}

function OriginalityDuplicatePanel({result}:{result:NonNullable<FactoryJob['candidates'][number]['originalityDuplicateQa']>}){
  return <div className="audio-script" data-testid="originality-duplicate-result">
    <b>QA7 — Originality &amp; Duplicate</b>
    <p><span className={`badge ${result.verdict==='PASS'?'green':result.verdict==='FAIL'?'error':'review'}`}>{result.verdict}</span> Source: {result.summary.sourceCopyRisk} · Batch: {result.summary.batchDuplicateRisk} · Bank: {result.summary.bankDuplicateRisk} · Confidence: {result.confidence}</p>
    <p><small>Maximum similarity — source {Math.round(result.summary.maxSourceSimilarity*100)}% · batch {Math.round(result.summary.maxBatchSimilarity*100)}% · bank {Math.round(result.summary.maxBankSimilarity*100)}%</small></p>
    <details><summary>Comparisons, evidence and release decision</summary>
      {result.comparisons.length?<ul className="qa-issues">{result.comparisons.map(item=><li key={`${item.kind}-${item.id}`} className={item.semanticRisk==='HIGH'?'error':item.semanticRisk==='MEDIUM'?'warning':''}><b>{item.kind} · {item.semanticRisk}</b> — {item.id}<br/><small>{item.relationship.replaceAll('_',' ')} · n-gram {Math.round(item.ngramSimilarity*100)}% · pattern {Math.round(item.patternSimilarity*100)}% · containment {Math.round(item.containmentSimilarity*100)}%<br/>{item.evidence}</small></li>)}</ul>:<p className="empty">No comparison candidates required detailed semantic review.</p>}
      {result.issues.length?<><b>QA7 issues</b><ul className="qa-issues">{result.issues.map((item,index)=><li key={index} className={item.severity==='CRITICAL'||item.severity==='MAJOR'?'error':'warning'}><b>{item.code}</b> — {item.evidence}<br/><small>{item.reason}<br/><b>Action:</b> {item.suggestedAction}</small></li>)}</ul></>:<p className="ok-text">No source-copy or duplicate risk found.</p>}
      {result.release.blockReason.length>0&&<p><b>Release blockers</b><br/><small>{result.release.blockReason.join(', ')}</small></p>}
    </details>
    <small>{result.provider}{result.model?` / ${result.model}`:''} · {result.promptVersion} · Policy {result.policyVersion} · {result.algorithmVersion}</small>
  </div>
}
