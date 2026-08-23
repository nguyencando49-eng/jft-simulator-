'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api-client';
import { Alert,Card,Skeleton,StatCard } from '@/components/ui';

type Data={questions:number;approved:number;review:number;attempts:number;candidates:number;sources:number;knowledge:number;audioMissing:number;notReady:string[]};

export default function AdminDashboardClient(){
  const [data,setData]=useState<Data|null>(null),[error,setError]=useState('');
  useEffect(()=>{void Promise.all([adminApi.questions(),adminApi.attempts(),adminApi.candidates(),adminApi.sources(),adminApi.contentProduction()]).then(([q,a,c,s,p])=>setData({
    questions:q.questions.length,
    approved:q.questions.filter(x=>x.status==='approved').length,
    review:q.questions.filter(x=>x.status==='review').length,
    attempts:a.attempts.length,
    candidates:c.candidates.length,
    sources:s.sources.length,
    knowledge:p.sources.approvedKnowledgeUnits,
    audioMissing:p.qa.listeningAudioDeficits,
    notReady:Object.entries(p.levels).filter(([,value])=>value.readiness.status==='NOT_READY').map(([level])=>level),
  })).catch(()=>setError('Không thể tải số liệu vận hành hiện tại.'))},[]);
  return <>
    {error&&<Alert tone="danger">{error}</Alert>}
    <div className="admin-title"><div><span className="eyebrow">TỔNG QUAN VẬN HÀNH</span><h1>Điều hành nội dung</h1><p>Trạng thái trực tiếp của chương trình học, công việc duyệt và hệ thống đề luyện tập.</p></div><Link href="/admin/content-production" className="primary admin-cta">Xem phần còn thiếu</Link></div>
    {!data?<Skeleton lines={8}/>:<>
      <section className="metric-grid">
        <StatCard label="Tổng câu hỏi" value={data.questions} note={`${data.approved} đã duyệt`}/>
        <StatCard label="Chờ duyệt" value={data.review} note="Cần kiểm tra thủ công"/>
        <StatCard label="Đơn vị kiến thức" value={data.knowledge} note={`${data.sources} nguồn chương trình`}/>
        <StatCard label="Học viên" value={data.candidates} note={`${data.attempts} lượt làm bài`}/>
      </section>
      <section className="admin-grid-2">
        <Card title="Việc cần xử lý"><div className="readiness"><p><span>Hàng chờ duyệt câu hỏi</span><b>{data.review}</b></p><p><span>Câu nghe thiếu âm thanh</span><b>{data.audioMissing}</b></p><p><span>Cấp độ chưa sẵn sàng</span><b>{data.notReady.join(', ')||'Không có'}</b></p></div></Card>
        <Card title="Quy trình sản xuất"><ol className="ops-flow"><li>Duyệt kiến thức chương trình</li><li>Sinh và kiểm tra câu hỏi</li><li>Xử lý lỗi QA và âm thanh</li><li>Kiểm tra độ sẵn sàng trước khi phát hành</li></ol></Card>
      </section>
    </>}
  </>;
}
