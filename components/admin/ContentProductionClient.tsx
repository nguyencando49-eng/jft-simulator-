'use client';
import { useEffect,useState } from 'react';
import { adminApi } from '@/lib/api-client';
import { ADMIN_SECTION_LABELS } from '@/lib/admin-ui';
type Summary=Awaited<ReturnType<typeof adminApi.contentProduction>>;

export default function ContentProductionClient(){
  const [data,setData]=useState<Summary|null>(null),[error,setError]=useState('');
  useEffect(()=>{void adminApi.contentProduction().then(setData).catch(cause=>setError(cause instanceof Error?cause.message:String(cause)))},[]);
  return <>
    <div className="admin-title"><div><span className="eyebrow">BẢNG ĐIỀU KHIỂN NỘI BỘ</span><h1>Sản xuất nội dung chương trình</h1><p>Theo dõi độ phủ, phần còn thiếu và mức sẵn sàng. Các chỉ tiêu này là quyết định của simulator, không phải quy định chính thức của JFT.</p></div></div>
    {error&&<div className="admin-alert error">{error}</div>}
    {data&&<><section className="factory-layout">{Object.entries(data.levels).map(([level,item])=><article className="admin-panel" key={level}><h2>{level}</h2><p><b>{item.approved}</b> / {item.targetMin}–{item.targetMax} câu đã duyệt</p><p>Độ phủ kiến thức: {item.coverage.covered}/{item.coverage.total}</p><span className={`badge ${item.readiness.status==='READY'?'green':'review'}`}>{item.readiness.status==='READY'?'Sẵn sàng':'Chưa sẵn sàng'}</span>{item.readiness.deficits.length>0&&<ul>{item.readiness.deficits.map(deficit=><li key={deficit}>{deficit}</li>)}</ul>}</article>)}</section><section className="admin-panel"><h2>Khoảng trống chương trình ưu tiên</h2><p>Nguồn: {data.sources.total} · Đơn vị kiến thức đã duyệt: {data.sources.approvedKnowledgeUnits} · Câu nghe thiếu âm thanh: {data.qa.listeningAudioDeficits}</p><div className="job-list">{data.deficits.slice(0,20).map(deficit=><div key={`${deficit.knowledgeUnitId}-${deficit.section}`}><b>{deficit.level} · {ADMIN_SECTION_LABELS[deficit.section]} · {deficit.topic}</b><small>{deficit.chapter||'Chưa có chương'} · thiếu {deficit.deficit} · {deficit.canDo}</small></div>)}</div></section></>}
  </>;
}
