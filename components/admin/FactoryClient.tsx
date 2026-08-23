'use client';
import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '@/lib/api-client';
import { ADMIN_CONFIDENCE_LABELS,ADMIN_SECTION_LABELS,ADMIN_VERDICT_LABELS,humanizeAdminCode } from '@/lib/admin-ui';
import type { FactoryJob, FactoryRequest } from '@/lib/server/factory-domain';
import type { SectionId } from '@/lib/types';
import { formatQuestionPrompt } from '@/lib/question-presentation';

const defaults:FactoryRequest={section:'script_vocabulary',level:'A2.1',topic:'仕事',canDo:'職場で簡単なやり取りができる',count:4,difficulty:'balanced',includeExplanation:true,generateAudioScript:true};
const labels=ADMIN_SECTION_LABELS;
const jobStatus:Record<string,string>={queued:'Đang chờ',running:'Đang chạy',completed:'Hoàn tất',failed:'Thất bại'};
type Candidate=FactoryJob['candidates'][number];
const hasSpecializedReview=(candidate:Candidate)=>[candidate.contentQa,candidate.answerOracleQa,candidate.japaneseNaturalnessQa,candidate.curriculumGroundingQa,candidate.jftAlignmentQa,candidate.difficultyCalibrationQa,candidate.originalityDuplicateQa].some(result=>result?.verdict==='REVIEW');
const automaticallySelectable=(candidate:Candidate)=>candidate.qa.passed&&!candidate.approvedAt&&!hasSpecializedReview(candidate);

export default function FactoryClient(){
  const [form,setForm]=useState(defaults); const [jobs,setJobs]=useState<FactoryJob[]>([]); const [selected,setSelected]=useState<FactoryJob|null>(null); const [picked,setPicked]=useState<Record<string,boolean>>({}); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(''); const [provider,setProvider]=useState('');
  const load=async()=>{try{const r=await adminApi.factoryJobs();setJobs(r.jobs);setProvider(r.provider);if(selected){const fresh=r.jobs.find(j=>j.id===selected.id);if(fresh)setSelected(fresh)}}catch(e){setMessage(e instanceof Error?e.message:String(e))}};
  useEffect(()=>{load()},[]);
  const generate=async()=>{setBusy(true);setMessage('');try{const r=await adminApi.createFactoryJob(form);setSelected(r.job);setPicked(Object.fromEntries(r.job.candidates.filter(automaticallySelectable).map(c=>[c.id,true])));setMessage(r.job.status==='failed'?(r.job.error||'Sinh câu hỏi thất bại.'):`Đã tạo ${r.job.candidates.length} câu ứng viên.`);await load()}catch(e){setMessage(e instanceof Error?e.message:String(e))}finally{setBusy(false)}};
  const renderAudio=async(candidateId:string)=>{if(!selected)return;setBusy(true);setMessage('');try{const r=await adminApi.renderFactoryAudio(selected.id,candidateId);setSelected(r.job);setPicked(prev=>({...prev,[candidateId]:automaticallySelectable(r.candidate)}));setMessage('Đã tạo lại âm thanh và cập nhật QA.');await load()}catch(e){setMessage(e instanceof Error?e.message:String(e))}finally{setBusy(false)}};
  const approve=async()=>{if(!selected)return;const ids=Object.entries(picked).filter(([,v])=>v).map(([id])=>id);setBusy(true);try{const r=await adminApi.approveFactoryCandidates(selected.id,ids);setSelected(r.job);setMessage(`Đã đưa ${r.approved} câu vào Ngân hàng câu hỏi.`);await load()}catch(e){setMessage(e instanceof Error?e.message:String(e))}finally{setBusy(false)}};
  const stats=useMemo(()=>selected?{pass:selected.candidates.filter(automaticallySelectable).length,avg:selected.candidates.length?Math.round(selected.candidates.reduce((s,c)=>s+c.qa.score,0)/selected.candidates.length):0}:{pass:0,avg:0},[selected]);
  return <>
    <div className="admin-title"><div><span className="eyebrow">KHÔNG GIAN DUYỆT NỘI DUNG</span><h1>Xưởng tạo câu hỏi AI</h1><p>Sinh theo lô có kiểm soát, kiểm tra nội dung và QA, chuẩn bị âm thanh rồi mới đưa câu đạt chuẩn vào Ngân hàng câu hỏi.</p></div></div>
    {message&&<div className={`admin-alert ${message.includes('failed')||message.includes('required')?'error':'ok'}`}>{message}</div>}
    <section className="factory-layout">
      <div className="admin-panel factory-form"><div className="panel-head"><h2>Yêu cầu sinh câu hỏi</h2><span className="badge">Prompt v5.1</span></div>
        <label>Phần thi<select value={form.section} onChange={e=>setForm({...form,section:e.target.value as SectionId})}>{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <div className="factory-2"><label>Cấp độ<select value={form.level} onChange={e=>setForm({...form,level:e.target.value as FactoryRequest['level']})}><option>A1</option><option>A2.1</option><option>A2.2</option></select></label><label>Độ khó<select value={form.difficulty} onChange={e=>setForm({...form,difficulty:e.target.value as FactoryRequest['difficulty']})}><option value="easy">Dễ</option><option value="balanced">Cân bằng</option><option value="hard">Khó</option></select></label></div>
        <label>Chủ đề<input value={form.topic} onChange={e=>setForm({...form,topic:e.target.value})} placeholder="仕事 / 買い物 / 病院..."/></label>
        <label>Can-do<textarea value={form.canDo||''} onChange={e=>setForm({...form,canDo:e.target.value})} rows={3}/></label>
        <label>Số lượng<input type="number" min={1} max={20} value={form.count} onChange={e=>setForm({...form,count:Number(e.target.value)})}/></label>
        <label className="check-row"><input type="checkbox" checked={form.includeExplanation} onChange={e=>setForm({...form,includeExplanation:e.target.checked})}/> Kèm giải thích tiếng Việt</label>
        <label className="check-row"><input type="checkbox" checked={form.generateAudioScript} onChange={e=>setForm({...form,generateAudioScript:e.target.checked})}/> Tạo kịch bản âm thanh cho câu nghe</label>
        <button className="primary" disabled={busy} onClick={generate}>{busy?'Đang sinh…':'Sinh câu ứng viên'}</button>
      </div>
      <div>
        <section className="metric-grid three factory-metrics"><Metric label="Câu ứng viên" value={String(selected?.candidates.length||0)}/><Metric label="Đạt QA" value={String(stats.pass)}/><Metric label="Điểm QA trung bình" value={`${stats.avg}%`}/></section>
        <div className="admin-panel"><div className="panel-head"><h2>Công việc sinh câu</h2><button className="secondary" onClick={load}>Làm mới</button></div><div className="job-list">{jobs.length===0?<p className="empty">Chưa có công việc nào.</p>:jobs.map(j=><button key={j.id} onClick={()=>{setSelected(j);setPicked(Object.fromEntries(j.candidates.filter(automaticallySelectable).map(c=>[c.id,true])))}} className={selected?.id===j.id?'active':''}><span><b>{j.request.topic}</b><small>{labels[j.request.section]} · {j.request.level} · yêu cầu {j.request.count} câu</small></span><span className={`badge ${j.status==='completed'?'green':j.status}`}>{jobStatus[j.status]??j.status}</span></button>)}</div></div>
      </div>
    </section>
    {selected&&<section className="admin-panel"><div className="panel-head"><div><h2>Hàng chờ duyệt thủ công</h2><small className="mono">công việc {selected.id}</small></div><button className="primary" disabled={busy||!Object.values(picked).some(Boolean)} onClick={approve}>Duyệt mục đã chọn → Ngân hàng câu hỏi</button></div>
      <div className="factory-candidates">{selected.candidates.map((c,idx)=><article key={c.id} className={`factory-candidate ${!c.qa.passed?'fail':hasSpecializedReview(c)?'review':'pass'}`}>
        <div className="candidate-top"><label><input type="checkbox" disabled={!c.qa.passed||!!c.approvedAt} checked={!!picked[c.id]&&!c.approvedAt} onChange={e=>setPicked({...picked,[c.id]:e.target.checked})}/><b>Ứng viên {idx+1}</b></label><div><span className={`qa-score ${c.qa.score>=85?'good':c.qa.score>=65?'warn':'bad'}`}>QA {c.qa.score}</span>{c.approvedAt&&<span className="badge green">Đã duyệt</span>}</div></div>
        <p className="factory-prompt">{formatQuestionPrompt(c.question.prompt)}</p><ol>{c.question.choices.map((x,i)=><li key={i} className={i===c.question.answer?'correct':''}>{x}</li>)}</ol>
        {c.audioScript&&<div className="audio-script"><b>Kịch bản âm thanh</b><p>{c.audioScript}</p>{c.question.type==='audio_choice'&&<div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><button className="secondary" disabled={busy} onClick={()=>renderAudio(c.id)}>{c.audio?.status==='ready'?'Tạo lại âm thanh':'Tạo âm thanh TTS'}</button>{c.audio&&<span className={`badge ${c.audio.status==='ready'?'green':c.audio.status==='failed'?'error':''}`}>{c.audio.status==='ready'?'Sẵn sàng':c.audio.status==='failed'?'Thất bại':'Đang chờ'}</span>}{c.question.audioSrc&&<audio controls preload="none" src={c.question.audioSrc}/>}</div>}</div>}
        {c.semanticQa&&<div className="audio-script"><b>QA ngữ nghĩa · {c.semanticQa.score}/100</b><p>{c.semanticQa.summary}</p><small>{c.semanticQa.provider}{c.semanticQa.model?` / ${c.semanticQa.model}`:''}</small></div>}
        {c.answerOracleQa&&<div className="audio-script" data-testid="answer-oracle-result"><b>QA2 — Bộ giải đáp án độc lập</b><p><span className={`badge ${c.answerOracleQa.verdict==='PASS'?'green':c.answerOracleQa.verdict==='FAIL'?'error':''}`}>{ADMIN_VERDICT_LABELS[c.answerOracleQa.verdict]}</span> Đáp án suy ra: {c.answerOracleQa.derivedCorrectOptions.length?c.answerOracleQa.derivedCorrectOptions.map(i=>String.fromCharCode(65+i)).join(', '):'Không có'} · Đáp án khai báo: {c.answerOracleQa.declaredCorrectOption>=0?String.fromCharCode(65+c.answerOracleQa.declaredCorrectOption):'Không xác định'} · Độ tin cậy: {Math.round(c.answerOracleQa.confidence*100)}% · Số đáp án có thể bảo vệ: {c.answerOracleQa.numberOfDefensibleAnswers}</p><details><summary>Phân tích các lựa chọn</summary><ol>{c.answerOracleQa.choiceAnalysis.map(item=><li key={item.index}><b>{String.fromCharCode(65+item.index)} — {humanizeAdminCode(item.classification)}</b><br/><small>{item.reason}</small></li>)}</ol></details><small>{humanizeAdminCode(c.answerOracleQa.outcome)} · {c.answerOracleQa.provider}{c.answerOracleQa.model?` / ${c.answerOracleQa.model}`:''} · {c.answerOracleQa.promptVersion}</small></div>}
        {c.japaneseNaturalnessQa&&<div className="audio-script" data-testid="japanese-naturalness-result"><b>QA3 — Độ tự nhiên của tiếng Nhật</b><p><span className={`badge ${c.japaneseNaturalnessQa.verdict==='PASS'?'green':c.japaneseNaturalnessQa.verdict==='FAIL'?'error':''}`}>{ADMIN_VERDICT_LABELS[c.japaneseNaturalnessQa.verdict]}</span> Điểm: {c.japaneseNaturalnessQa.scores.overall}/100 · Độ tin cậy: {ADMIN_CONFIDENCE_LABELS[c.japaneseNaturalnessQa.confidence]} · Phong cách: {humanizeAdminCode(c.japaneseNaturalnessQa.contextAssessment.actualStyle)} ({humanizeAdminCode(c.japaneseNaturalnessQa.contextAssessment.fit)})</p><details><summary>Ngữ pháp, kết hợp từ, sắc thái, ngữ cảnh và lựa chọn</summary><p>Ngữ pháp {c.japaneseNaturalnessQa.scores.grammar}/20 · Tự nhiên {c.japaneseNaturalnessQa.scores.naturalness}/20 · Kết hợp từ {c.japaneseNaturalnessQa.scores.collocation}/15 · Sắc thái {c.japaneseNaturalnessQa.scores.register}/15 · Ngữ cảnh {c.japaneseNaturalnessQa.scores.contextFit}/10 · Nói/Viết {c.japaneseNaturalnessQa.scores.spokenWrittenFit}/10 · Mạch hội thoại {c.japaneseNaturalnessQa.scores.conversationFlow}/10</p>{c.japaneseNaturalnessQa.issues.length?<ul className="qa-issues">{c.japaneseNaturalnessQa.issues.map((item,index)=><li key={index} className={item.severity==='CRITICAL'||item.severity==='MAJOR'?'error':'warning'}><b>{item.code}</b> — {item.evidence}<br/><small>{item.reason}</small></li>)}</ul>:<p className="ok-text">Không phát hiện vấn đề tiếng Nhật.</p>}<ol>{c.japaneseNaturalnessQa.choiceLanguageAnalysis.map(item=><li key={item.index}>{String.fromCharCode(65+item.index)} — {item.natural?'Tự nhiên':'Cần xem lại'}{item.issues.length?`: ${item.issues.join(', ')}`:''}</li>)}</ol></details><small>{c.japaneseNaturalnessQa.provider}{c.japaneseNaturalnessQa.model?` / ${c.japaneseNaturalnessQa.model}`:''} · {c.japaneseNaturalnessQa.promptVersion}</small></div>}
        {c.curriculumGroundingQa&&<CurriculumGroundingPanel result={c.curriculumGroundingQa}/>}
        {c.jftAlignmentQa&&<JftAlignmentPanel result={c.jftAlignmentQa}/>}
        {c.difficultyCalibrationQa&&<DifficultyCalibrationPanel result={c.difficultyCalibrationQa}/>}
        {c.originalityDuplicateQa&&<OriginalityDuplicatePanel result={c.originalityDuplicateQa}/>}
        <details><summary>Báo cáo QA · {c.qa.issues.length} vấn đề</summary>{c.qa.issues.length===0?<p className="ok-text">Không phát hiện vấn đề.</p>:<ul className="qa-issues">{c.qa.issues.map((x,i)=><li key={i} className={x.severity}><b>{x.severity==='error'?'Lỗi':'Cảnh báo'}</b> {x.message}</li>)}</ul>}</details>
        <details><summary>Nhật ký sinh câu</summary><small className="factory-meta">{c.generation.provider} / {c.generation.model||'mặc định'} · {c.generation.promptVersion}</small></details>
      </article>)}</div>
    </section>}
  </>
}
function Metric({label,value}:{label:string,value:string}){return <div className="metric"><span>{label}</span><strong>{value}</strong></div>}

function CurriculumGroundingPanel({result}:{result:NonNullable<FactoryJob['candidates'][number]['curriculumGroundingQa']>}){
  const groups=Array.from(new Set(result.knowledgeAnalysis.map(item=>item.type)));
  return <div className="audio-script" data-testid="curriculum-grounding-result">
    <b>QA4 — Bám sát chương trình</b>
    <p><span className={`badge ${result.verdict==='PASS'?'green':result.verdict==='FAIL'?'error':''}`}>{ADMIN_VERDICT_LABELS[result.verdict]}</span> Độ phủ: {result.coverage.supportedCount}/{result.coverage.requiredCount} kiến thức bắt buộc được hỗ trợ · Độ tin cậy: {ADMIN_CONFIDENCE_LABELS[result.confidence]}</p>
    <p><small>Truy xuất: {result.retrieval.complete?'đầy đủ':'chưa đầy đủ'} ({result.retrieval.returnedUnitCount}/{result.retrieval.totalApprovedUnits} đơn vị đã duyệt) · Nguồn gốc: {result.provenance.complete?'đầy đủ':'chưa đầy đủ'}</small></p>
    <details><summary>Ánh xạ kiến thức và dấu vết chương trình</summary>
      {groups.length?groups.map(type=><section key={type}><b>{humanizeAdminCode(type)}</b><ul className="qa-issues">{result.knowledgeAnalysis.filter(item=>item.type===type).map((item,index)=><li key={`${item.value}-${index}`} className={item.support==='UNSUPPORTED'?'error':item.support==='SUPPORTED'?'':'warning'}><b>{humanizeAdminCode(item.support)}</b> — {item.value}<br/><small>{humanizeAdminCode(item.role)} · {item.reason}<br/>{item.evidence}<br/>{item.knowledgeUnitIds.length?item.knowledgeUnitIds.join(', '):'Không có đơn vị kiến thức đã duyệt hỗ trợ'}{item.sourceChunkIds.length?` → ${item.sourceChunkIds.join(', ')}`:''}</small></li>)}</ul></section>):<p className="empty">Chưa có phân tích kiến thức hợp lệ.</p>}
      {result.outsideKnowledge.length>0&&<><b>Kiến thức ngoài chương trình</b><ul>{result.outsideKnowledge.map((item,index)=><li key={index}>{item.type}: {item.value} — {item.reason}</li>)}</ul></>}
      {result.issues.length>0&&<><b>Vấn đề QA4</b><ul className="qa-issues">{result.issues.map((item,index)=><li key={index} className={item.severity==='CRITICAL'||item.severity==='MAJOR'?'error':'warning'}><b>{item.code}</b> — {item.evidence}<br/><small>{item.reason}</small></li>)}</ul></>}
    </details>
    <small>{result.provider}{result.model?` / ${result.model}`:''} · {result.promptVersion}</small>
  </div>
}

function JftAlignmentPanel({result}:{result:NonNullable<FactoryJob['candidates'][number]['jftAlignmentQa']>}){
  const value=(text:string|undefined)=>text?.trim()||'Chưa khai báo';
  return <div className="audio-script" data-testid="jft-alignment-result">
    <b>QA5 — Mức phù hợp JFT</b>
    <p><span className={`badge ${result.verdict==='PASS'?'green':result.verdict==='FAIL'?'error':'review'}`}>{ADMIN_VERDICT_LABELS[result.verdict]}</span> Điểm: {result.scores.total}/100 · Độ tin cậy: {ADMIN_CONFIDENCE_LABELS[result.confidence]}</p>
    <p><b>Khai báo:</b> {value(result.declared.section)} / {value(result.declared.category)}<br/><b>Phát hiện:</b> {value(result.independentAssessment.actualSection)} / {value(result.independentAssessment.actualCategory)}</p>
    <p><small>Can-do: {humanizeAdminCode(result.alignment.canDo)} · Phương thức: {humanizeAdminCode(result.independentAssessment.requiredModality)} ({humanizeAdminCode(result.alignment.modalityDependency)}) · Tính hợp lệ: {humanizeAdminCode(result.taskValidity.realWorldValidity)}</small></p>
    <details><summary>Mục tiêu đánh giá, mức phù hợp và vấn đề</summary>
      <p><b>Mục tiêu đánh giá thực tế</b><br/>{value(result.independentAssessment.actualAssessmentTarget)}</p>
      <p><b>Can-do</b><br/>Khai báo: {value(result.declared.canDo)}<br/>Phát hiện: {value(result.independentAssessment.actualCanDo)}</p>
      <p><b>Loại nhiệm vụ</b><br/>Khai báo: {value(result.declared.taskType)}<br/>Phát hiện: {value(result.independentAssessment.actualTaskType)} · Mức phù hợp: {humanizeAdminCode(result.alignment.taskType)}</p>
      <p><b>Mục đích giao tiếp</b><br/>{value(result.independentAssessment.communicativePurpose)}</p>
      <p>Phần thi {humanizeAdminCode(result.alignment.section)} · Loại câu {humanizeAdminCode(result.alignment.category)} · Can-do {humanizeAdminCode(result.alignment.canDo)} · Nhiệm vụ {humanizeAdminCode(result.alignment.taskType)}</p>
      {result.taskValidity.constructUnderrepresented&&<p className="ui-alert warning"><b>Đánh giá chưa đầy đủ:</b> câu hỏi chưa đo hết kỹ năng đã khai báo.</p>}
      {result.taskValidity.constructIrrelevantClues.length>0&&<><b>Dấu hiệu ngoài năng lực cần đánh giá</b><ul>{result.taskValidity.constructIrrelevantClues.map((clue,index)=><li key={index}>{clue}</li>)}</ul></>}
      {result.issues.length>0?<><b>Vấn đề QA5</b><ul className="qa-issues">{result.issues.map((item,index)=><li key={index} className={item.severity==='CRITICAL'||item.severity==='MAJOR'?'error':'warning'}><b>{item.code}</b> — {item.evidence}<br/><small>{item.reason}<br/><b>Hành động:</b> {item.suggestedAction}</small></li>)}</ul></>:<p className="ok-text">Không phát hiện vấn đề về mức phù hợp JFT.</p>}
      {result.release.blockReason.length>0&&<p><b>Lý do chặn phát hành</b><br/><small>{result.release.blockReason.join(', ')}</small></p>}
    </details>
    <small>{result.provider}{result.model?` / ${result.model}`:''} · {result.promptVersion} · Tham chiếu {result.referenceVersion} · Phân loại {result.taxonomyVersion}</small>
  </div>
}

function DifficultyCalibrationPanel({result}:{result:NonNullable<FactoryJob['candidates'][number]['difficultyCalibrationQa']>}){
  const dimensions=Object.entries(result.profile) as Array<[string,number]>;
  return <div className="audio-script" data-testid="difficulty-calibration-result">
    <b>QA6 — Hiệu chỉnh độ khó</b>
    <p><span className={`badge ${result.verdict==='PASS'?'green':result.verdict==='FAIL'?'error':'review'}`}>{ADMIN_VERDICT_LABELS[result.verdict]}</span> Khai báo: {result.declaredLevel} · Ước tính: {result.estimatedLevel} · Độ tin cậy: {ADMIN_CONFIDENCE_LABELS[result.confidence]}</p>
    <p><b>Độ khó nội bộ:</b> {result.difficultyScore.toFixed(2)} · {humanizeAdminCode(result.levelMatch)} · {humanizeAdminCode(result.calibrationSource)}</p>
    <details><summary>Tín hiệu độ khó, dữ liệu thực nghiệm và vấn đề</summary>
      <ul className="qa-issues">{dimensions.map(([name,value])=><li key={name}><b>{name.replace(/([A-Z])/g,' $1')}</b> — {value.toFixed(2)}</li>)}</ul>
      <p>Mức suy luận: {humanizeAdminCode(result.reasoningDepth)} · Độ mạnh phương án nhiễu: {humanizeAdminCode(result.distractorStrength)}</p>
      <p><b>Dữ liệu thực nghiệm:</b> {result.empirical.available?`${result.empirical.attemptCount} lượt · ${result.empirical.correctRate===null?'chưa có tỷ lệ đúng':`${Math.round(result.empirical.correctRate*100)}% đúng`} · ${result.empirical.sufficientSample?'đủ mẫu':'chưa đủ mẫu'}`:'Chưa có dữ liệu từ đề đã phát hành'}<br/><small>Trung vị thời gian trả lời: {result.empirical.medianResponseTimeMs===null?'chưa ghi nhận':`${result.empirical.medianResponseTimeMs} ms`} · Trạng thái: {humanizeAdminCode(result.calibrationStatus)}</small></p>
      {result.issues.length?<><b>Vấn đề QA6</b><ul className="qa-issues">{result.issues.map((item,index)=><li key={index} className={item.severity==='CRITICAL'||item.severity==='MAJOR'?'error':'warning'}><b>{item.code}</b> — {item.evidence}<br/><small>{item.reason}<br/><b>Hành động:</b> {item.suggestedAction}</small></li>)}</ul></>:<p className="ok-text">Không phát hiện vấn đề hiệu chỉnh độ khó.</p>}
      {result.release.blockReason.length>0&&<p><b>Lý do chặn phát hành</b><br/><small>{result.release.blockReason.join(', ')}</small></p>}
    </details>
    <small>{result.provider}{result.model?` / ${result.model}`:''} · {result.promptVersion} · Hiệu chỉnh {result.calibrationVersion}</small>
  </div>
}

function OriginalityDuplicatePanel({result}:{result:NonNullable<FactoryJob['candidates'][number]['originalityDuplicateQa']>}){
  return <div className="audio-script" data-testid="originality-duplicate-result">
    <b>QA7 — Tính nguyên bản &amp; trùng lặp</b>
    <p><span className={`badge ${result.verdict==='PASS'?'green':result.verdict==='FAIL'?'error':'review'}`}>{ADMIN_VERDICT_LABELS[result.verdict]}</span> Nguồn: {humanizeAdminCode(result.summary.sourceCopyRisk)} · Trong lô: {humanizeAdminCode(result.summary.batchDuplicateRisk)} · Ngân hàng: {humanizeAdminCode(result.summary.bankDuplicateRisk)} · Độ tin cậy: {ADMIN_CONFIDENCE_LABELS[result.confidence]}</p>
    <p><small>Độ tương đồng cao nhất — nguồn {Math.round(result.summary.maxSourceSimilarity*100)}% · trong lô {Math.round(result.summary.maxBatchSimilarity*100)}% · ngân hàng {Math.round(result.summary.maxBankSimilarity*100)}%</small></p>
    <details><summary>So sánh, bằng chứng và quyết định phát hành</summary>
      {result.comparisons.length?<ul className="qa-issues">{result.comparisons.map(item=><li key={`${item.kind}-${item.id}`} className={item.semanticRisk==='HIGH'?'error':item.semanticRisk==='MEDIUM'?'warning':''}><b>{humanizeAdminCode(item.kind)} · {humanizeAdminCode(item.semanticRisk)}</b> — {item.id}<br/><small>{humanizeAdminCode(item.relationship)} · n-gram {Math.round(item.ngramSimilarity*100)}% · mẫu {Math.round(item.patternSimilarity*100)}% · bao hàm {Math.round(item.containmentSimilarity*100)}%<br/>{item.evidence}</small></li>)}</ul>:<p className="empty">Không có mục so sánh nào cần kiểm tra ngữ nghĩa chi tiết.</p>}
      {result.issues.length?<><b>Vấn đề QA7</b><ul className="qa-issues">{result.issues.map((item,index)=><li key={index} className={item.severity==='CRITICAL'||item.severity==='MAJOR'?'error':'warning'}><b>{item.code}</b> — {item.evidence}<br/><small>{item.reason}<br/><b>Hành động:</b> {item.suggestedAction}</small></li>)}</ul></>:<p className="ok-text">Không phát hiện nguy cơ sao chép hoặc trùng lặp.</p>}
      {result.release.blockReason.length>0&&<p><b>Lý do chặn phát hành</b><br/><small>{result.release.blockReason.join(', ')}</small></p>}
    </details>
    <small>{result.provider}{result.model?` / ${result.model}`:''} · {result.promptVersion} · Chính sách {result.policyVersion} · {result.algorithmVersion}</small>
  </div>
}
