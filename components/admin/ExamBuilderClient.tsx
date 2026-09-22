'use client';
import { useEffect,useState } from 'react';
import { adminApi } from '@/lib/api-client';
import { ExamDraft,ExamVersion,QuestionRecord } from '@/lib/admin-types';
import { SectionId } from '@/lib/types';
import { ADMIN_SECTION_LABELS } from '@/lib/admin-ui';
import type { ProductionReleaseReport } from '@/lib/server/production-release';

export default function ExamBuilderClient(){
  const [draft,setDraft]=useState<ExamDraft|null>(null),[bank,setBank]=useState<QuestionRecord[]>([]),[versions,setVersions]=useState<ExamVersion[]>([]);
  const [productionReport,setProductionReport]=useState<ProductionReleaseReport|null>(null),[productionReady,setProductionReady]=useState(false),[productionPublished,setProductionPublished]=useState<string[]>([]),[productionBankCount,setProductionBankCount]=useState(0),[productionConflicts,setProductionConflicts]=useState<string[]>([]);
  const [message,setMessage]=useState<{kind:'ok'|'error';text:string}|null>(null),[saving,setSaving]=useState(false),[releasing,setReleasing]=useState(false);

  useEffect(()=>{
    void Promise.all([adminApi.exam(),adminApi.questions(),adminApi.productionRelease()])
      .then(([exam,questions,release])=>{
        setDraft(exam.draft);setVersions(exam.versions);setBank(questions.questions);
        setProductionReport(release.report);setProductionReady(release.ready);setProductionPublished(release.publishedVersionIds);setProductionBankCount(release.bankCount);setProductionConflicts(release.conflictingVersionIds);
      })
      .catch(error=>setMessage({kind:'error',text:error instanceof Error?error.message:'Không thể tải trạng thái Production 3000.'}));
  },[]);

  function updateCount(section:SectionId,count:number){setDraft(current=>current?{...current,status:'draft',rules:current.rules.map(rule=>rule.section===section?{...rule,count:Math.max(0,count)}:rule)}:current)}
  function updateLevels(section:SectionId,value:string){const levels=value==='ALL'?['A1','A2.1','A2.2'] as const:[value as 'A1'|'A2.1'|'A2.2'];setDraft(current=>current?{...current,status:'draft',rules:current.rules.map(rule=>rule.section===section?{...rule,levels:[...levels]}:rule)}:current)}

  async function save(){if(!draft)return;try{setSaving(true);const result=await adminApi.saveExam(draft);setDraft(result.draft);setMessage({kind:'ok',text:'Đã lưu bản nháp vào hệ thống.'})}catch(error){setMessage({kind:'error',text:error instanceof Error?error.message:'Lưu thất bại.'})}finally{setSaving(false)}}
  async function publish(){if(!draft)return;try{await adminApi.saveExam(draft);const result=await adminApi.publishExam(draft.id);setVersions(current=>[result.version,...current]);setDraft(current=>current?{...current,status:'published'}:current);setMessage({kind:'ok',text:`Đã phát hành ${result.version.id} với ${result.version.questions.length} ảnh chụp câu hỏi bất biến.`})}catch(error){setMessage({kind:'error',text:error instanceof Error?error.message:'Phát hành thất bại.'})}}
  async function publishProduction(){try{
    setReleasing(true);
    const result=await adminApi.publishProductionRelease();
    setProductionReport(result.report);setProductionPublished([...result.published,...result.skipped]);setProductionBankCount(result.bankImport.imported);setProductionConflicts([]);setProductionReady(true);
    const [exam,questions]=await Promise.all([adminApi.exam(),adminApi.questions()]);
    setDraft(exam.draft);setVersions(exam.versions);setBank(questions.questions);
    setMessage({kind:'ok',text:result.published.length?`Đã phát hành Production 3000: ${result.published.length} đề mới, ${result.skipped.length} đề bất biến được giữ nguyên.`:'Production 3000 đã tồn tại đầy đủ; không thay đổi snapshot.'});
  }catch(error){setMessage({kind:'error',text:error instanceof Error?error.message:'Không thể phát hành Production 3000.'})}finally{setReleasing(false)}}

  return <>
    <div className="admin-title"><div><span className="eyebrow">LẮP RÁP ĐỀ THI</span><h1>Trình tạo đề</h1><p>Production 3000 là đường phát hành chính. Trình sửa draft bên dưới dùng cho các phiên bản bổ sung sau khi release nền tảng đã sẵn sàng.</p></div><div className="home-actions"><button className="secondary" disabled={!draft||saving} onClick={()=>void save()}>{saving?'Đang lưu…':'Lưu bản nháp'}</button><button className="primary" disabled={!draft} onClick={()=>void publish()}>Phát hành phiên bản</button></div></div>
    {message&&<div className={`admin-alert ${message.kind}`}>{message.text}</div>}

    <section className="admin-panel production-release-card" data-testid="production-3000-release"><div className="panel-head"><div><h2>Production 3000</h2><p>Đồng bộ ngân hàng 3.000 câu và 3 đề A1 / A2.1 / A2.2. Mỗi đề 48 câu, 60 phút, snapshot bất biến.</p></div><span className={`readiness-pill ${productionReady?'ready':productionConflicts.length?'blocked':productionReport?'review':'blocked'}`}>{productionReady?'ĐÃ PHÁT HÀNH':productionConflicts.length?'XUNG ĐỘT SNAPSHOT':productionReport?'SẴN SÀNG PHÁT HÀNH':'ĐANG KIỂM TRA'}</span></div>
      {productionReport?<><div className="metric-grid three"><div className="metric"><span>Ngân hàng hiện tại</span><strong>{productionBankCount.toLocaleString('vi-VN')} / {productionReport.expectedQuestionBankSize.toLocaleString('vi-VN')}</strong><small>câu kiểm soát</small></div><div className="metric"><span>Đề production</span><strong>{productionReport.examCount}</strong><small>{productionReport.levels.join(' · ')}</small></div><div className="metric"><span>Mỗi đề</span><strong>{productionReport.questionsPerExam} câu</strong><small>{productionReport.durationMinutes} phút</small></div></div>
      <div className="production-exam-list">{productionReport.exams.map(exam=><div key={exam.versionId}><b>{exam.title}</b><span>{exam.questionCount} câu · {Object.values(exam.sectionCounts).join(' / ')} theo 4 phần</span><small>{productionPublished.includes(exam.versionId)?'Đã có snapshot production':'Chưa phát hành snapshot'}</small></div>)}</div>
      {productionConflicts.length>0&&<div className="admin-alert error">Không thể ghi đè phiên bản bất biến: {productionConflicts.join(', ')}.</div>}
      <div className="home-actions"><button className="primary" disabled={releasing||productionReady||productionConflicts.length>0} onClick={()=>void publishProduction()}>{releasing?'Đang đồng bộ & phát hành…':productionReady?'Production 3000 đã phát hành':'Phát hành Production 3000'}</button></div></>:<p>Đang kiểm tra trạng thái release…</p>}
    </section>

    {!draft?<section className="admin-panel"><div className="panel-head"><h2>Chưa có draft trong cơ sở dữ liệu</h2></div><p className="helper">Đây là trạng thái bình thường của một Supabase mới. Dùng nút <b>Phát hành Production 3000</b> phía trên để nhập ngân hàng và tạo ba snapshot production đầu tiên.</p></section>:<>
      <section className="admin-panel builder-head"><div><label>Tên đề thi</label><input value={draft.title} onChange={event=>setDraft({...draft,title:event.target.value,status:'draft'})}/></div><div><label>Thời lượng</label><div className="input-suffix"><input type="number" value={draft.durationMinutes} onChange={event=>setDraft({...draft,durationMinutes:Number(event.target.value),status:'draft'})}/><span>phút</span></div></div><div><label>ID đề thi</label><code>{draft.id}</code></div></section>
      <section className="admin-panel"><div className="panel-head"><h2>Cấu trúc đề</h2><span className="badge">Chỉ dùng câu đã duyệt</span></div><div className="rule-list">{draft.rules.map((rule,index)=>{const eligible=bank.filter(question=>question.status==='approved'&&question.section===rule.section&&rule.levels.includes(question.level)).length,enough=eligible>=rule.count,levelValue=rule.levels.length===1?rule.levels[0]:'ALL';return <div className="rule-card" key={rule.section}><div className="rule-index">{index+1}</div><div className="rule-name"><b>{ADMIN_SECTION_LABELS[rule.section]}</b><small>{rule.allowBack?'Cho phép quay lại':'Làm tuần tự, không quay lại'}</small></div><div className="level-edit"><label>Cấp độ</label><select aria-label={`Cấp độ ${ADMIN_SECTION_LABELS[rule.section]}`} value={levelValue} onChange={event=>updateLevels(rule.section,event.target.value)}><option value="A1">A1</option><option value="A2.1">A2.1</option><option value="A2.2">A2.2</option><option value="ALL">Tất cả</option></select></div><div className="pool"><span>Kho phù hợp</span><b>{eligible}</b></div><div className="count-edit"><label>Số câu</label><input type="number" min="0" value={rule.count} onChange={event=>updateCount(rule.section,Number(event.target.value))}/></div><span className={`readiness-pill ${enough?'ready':'blocked'}`}>{enough?'Sẵn sàng':'Chưa đủ câu'}</span></div>})}</div></section>
      <section className="admin-grid-2"><div className="admin-panel"><div className="panel-head"><h2>Điều kiện phát hành</h2></div><ul className="contract"><li>Chỉ câu hỏi <b>đã duyệt</b> mới được sử dụng.</li><li>Phiên bản câu hỏi được đóng băng khi phát hành.</li><li>Học viên không nhận đáp án hoặc lời giải trong lúc thi.</li><li>Máy chủ chấm điểm theo ExamVersion đã đóng băng.</li></ul></div><div className="admin-panel"><div className="panel-head"><h2>Phiên bản đã tạo</h2><span>{versions.length}</span></div>{versions.length===0?<p className="empty">Chưa có phiên bản nào được phát hành.</p>:<div className="version-list">{versions.map(version=><div key={version.id}><b>{version.id}</b><span>{version.questions.length} câu</span><small>{new Date(version.publishedAt).toLocaleString('vi-VN')}</small></div>)}</div>}</div></section>
    </>}
  </>;
}
