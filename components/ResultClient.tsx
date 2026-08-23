'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { candidateApi, type ServerResult } from '@/lib/api-client';
import type { SectionId } from '@/lib/types';
import CandidateShell from '@/components/candidate/CandidateShell';
import AnswerReview from '@/components/candidate/AnswerReview';
import { Alert, Card, Progress, Skeleton, StatCard } from '@/components/ui';

const labels:Record<SectionId,string>={script_vocabulary:'Chữ viết & Từ vựng',conversation_expression:'Hội thoại & Biểu đạt',listening:'Nghe hiểu',reading:'Đọc hiểu'};

export default function ResultClient({sessionId}:{sessionId?:string}){
  const [result,setResult]=useState<ServerResult|null>(null);
  const [title,setTitle]=useState('Bài luyện tập JFT');
  const [error,setError]=useState('');

  useEffect(()=>{
    if(!sessionId){setError('Không tìm thấy bài đã hoàn thành. Hãy mở kết quả từ lịch sử luyện tập.');return;}
    void candidateApi.result(sessionId)
      .then(response=>{setResult(response.result);setTitle(response.exam.title);})
      .catch(()=>setError('Không thể tải kết quả này. Bài có thể chưa được nộp hoặc không thuộc tài khoản của bạn.'));
  },[sessionId]);

  if(error)return <CandidateShell><div className="candidate-page"><Alert tone="danger" title="Không thể mở kết quả">{error}</Alert><Link href="/candidate" className="primary">Về trang học viên</Link></div></CandidateShell>;
  if(!result)return <CandidateShell><div className="candidate-page"><Skeleton lines={7}/></div></CandidateShell>;

  const sections=Object.entries(result.sectionScores) as [SectionId,{correct:number;total:number;percent:number}][];
  const weakest=[...sections].sort((a,b)=>a[1].percent-b[1].percent)[0];
  return <CandidateShell><div className="candidate-page result-page">
    <section className="result-hero">
      <span className="eyebrow">KẾT QUẢ LUYỆN TẬP</span>
      <h1>{title}</h1>
      <div className="practice-score"><strong>{result.scorePercent}%</strong><span>Practice Score</span></div>
      <p>{result.correct}/{result.total} câu đúng · {result.answered} câu đã trả lời</p>
      <Alert tone="info">Điểm này chỉ phản ánh bài luyện tập và không tương đương điểm hoặc cấp độ JFT-Basic chính thức.</Alert>
    </section>

    <div className="metric-grid four result-metrics">
      <StatCard label="Đúng" value={result.correct}/>
      <StatCard label="Sai" value={result.incorrect}/>
      <StatCard label="Chưa trả lời" value={result.unanswered}/>
      <StatCard label="Tổng số câu" value={result.total}/>
    </div>

    <div className="candidate-grid">
      <Card title="Kết quả theo phần">{sections.map(([id,section])=><div className="result-section" key={id}><div><b>{labels[id]}</b><span>{section.correct}/{section.total} câu đúng</span></div><Progress value={section.percent}/></div>)}</Card>
      <Card title="Bước tiếp theo" className="next-step"><h3>{weakest?`Ưu tiên ${labels[weakest[0]]}`:'Tiếp tục luyện tập'}</h3><p>{weakest&&weakest[1].percent<70?'Hãy xem lại các câu sai ở phần này trước khi làm bài tiếp theo.':'Kết quả khá cân bằng. Hãy tiếp tục luyện đều bốn phần.'}</p><div className="candidate-stack"><Link href="/candidate#exams" className="primary">Chọn bài tiếp theo</Link><Link href={`/candidate/history/${sessionId}`} className="secondary">Mở trong lịch sử</Link></div></Card>
    </div>

    <AnswerReview items={result.review}/>
  </div></CandidateShell>;
}
