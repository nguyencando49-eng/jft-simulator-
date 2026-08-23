'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { candidateApi, type CandidateExam, type CandidateSession, type ServerResult } from '@/lib/api-client';
import type { SectionId } from '@/lib/types';
import CandidateShell from './CandidateShell';
import AnswerReview from './AnswerReview';
import { Alert, Card, PageHeader, Skeleton, StatCard } from '@/components/ui';

const labels:Record<SectionId,string>={script_vocabulary:'Chữ viết & Từ vựng',conversation_expression:'Hội thoại & Biểu đạt',listening:'Nghe hiểu',reading:'Đọc hiểu'};

export default function AttemptDetailClient({sessionId}:{sessionId:string}){
  const [session,setSession]=useState<CandidateSession|null>(null);
  const [exam,setExam]=useState<CandidateExam|null>(null);
  const [result,setResult]=useState<ServerResult|null>(null);
  const [error,setError]=useState('');

  useEffect(()=>{
    void candidateApi.resume(sessionId)
      .then(async response=>{
        setSession(response.session);
        setExam(response.exam);
        if(response.session.status==='submitted')setResult((await candidateApi.result(sessionId)).result);
      })
      .catch(()=>setError('Không thể tải lần luyện tập này. Bài có thể không tồn tại hoặc không thuộc tài khoản của bạn.'));
  },[sessionId]);

  return <CandidateShell><div className="candidate-page">
    <PageHeader eyebrow="LỊCH SỬ LUYỆN TẬP" title={exam?.title||'Chi tiết lần làm bài'} description={session?new Date(session.startedAt).toLocaleString('vi-VN'):'Đang tải…'} actions={<Link href="/candidate#history" className="secondary">← Lịch sử</Link>}/>
    {error&&<Alert tone="danger" title="Không thể mở lần luyện tập">{error}</Alert>}
    {!session&&!error?<Skeleton lines={7}/>:session&&<>
      <div className="metric-grid four">
        <StatCard label="Trạng thái" value={session.status==='submitted'?'Hoàn thành':session.status==='active'?'Đang làm':'Đã hết hạn'}/>
        <StatCard label="Đã trả lời" value={result?.answered??Object.keys(session.answers||{}).length}/>
        <StatCard label="Câu sai" value={result?.incorrect??'—'}/>
        <StatCard label="Practice Score" value={result?`${result.scorePercent}%`:'—'}/>
      </div>
      {result&&<><Card title="Kết quả theo phần"><div className="history-list">{(Object.entries(result.sectionScores) as [SectionId,{correct:number;total:number;percent:number}][]).map(([id,section])=><div key={id}><div><b>{labels[id]}</b><small>{section.correct}/{section.total} câu đúng</small></div><span/><strong>{section.percent}%</strong></div>)}</div></Card><AnswerReview items={result.review}/></>}
      {session.status==='active'&&<Alert tone="warning" title="Bài chưa hoàn thành"><p>Tiến độ gần nhất đã được lưu. Bạn có thể tiếp tục từ câu đang làm.</p><Link href={`/exam?sessionId=${encodeURIComponent(session.id)}`} className="primary">Tiếp tục bài</Link></Alert>}
      {session.status==='expired'&&<Alert tone="warning">Bài đã hết thời gian và không thể thay đổi đáp án.</Alert>}
    </>}
  </div></CandidateShell>;
}
