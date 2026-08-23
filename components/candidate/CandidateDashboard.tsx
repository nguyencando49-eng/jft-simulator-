'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  authApi,
  candidateApi,
  type CandidateAttempt,
  type CandidateExamSummary,
  type UserProfile,
} from '@/lib/api-client';
import CandidateShell from './CandidateShell';
import { Alert, Card, EmptyState, Skeleton, StatCard } from '@/components/ui';

const levelLabel:Record<CandidateExamSummary['level'],string>={A1:'A1','A2.1':'A2.1','A2.2':'A2.2',MIXED:'Nhiều cấp độ'};

export default function CandidateDashboard(){
  const [attempts,setAttempts]=useState<CandidateAttempt[]>([]);
  const [exams,setExams]=useState<CandidateExamSummary[]>([]);
  const [profile,setProfile]=useState<UserProfile|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    void Promise.all([candidateApi.attempts(),candidateApi.publishedExams(),authApi.me()])
      .then(([attemptData,examData,me])=>{
        setAttempts(attemptData.attempts);
        setExams(examData.versions);
        setProfile(me.user);
      })
      .catch(()=>setError('Không thể tải dữ liệu luyện tập. Vui lòng kiểm tra kết nối và thử lại.'))
      .finally(()=>setLoading(false));
  },[]);

  const active=attempts.find(item=>item.status==='active'&&Date.now()<new Date(item.expiresAt).getTime());
  const submitted=attempts.filter(item=>item.status==='submitted');
  const best=Math.max(0,...submitted.map(item=>item.scorePercent||0));
  const recentByExam=useMemo(()=>new Map(exams.map(exam=>[
    exam.id,
    attempts.find(item=>item.examVersionId===exam.id),
  ])),[attempts,exams]);
  const learnerName=profile?.displayName?.trim()||profile?.email?.split('@')[0]||'bạn';

  return <CandidateShell><div className="candidate-page">
    {error&&<Alert tone="danger" title="Không thể tải trang">{error}</Alert>}
    {loading?<Skeleton lines={7}/>:<>
      <section className="candidate-hero">
        <div className="eyebrow">LỘ TRÌNH CỦA BẠN</div>
        <h1>{active?`Chào ${learnerName}, tiếp tục bài đang làm`:`Chào ${learnerName}, hôm nay bạn muốn luyện gì?`}</h1>
        <p>{active?'Đáp án gần nhất đã được lưu trên máy chủ. Bạn có thể tiếp tục từ câu đang làm.':'Chọn một đề đã phát hành để luyện theo trải nghiệm CBT.'}</p>
        <div className="hero-actions">
          {active?<Link href={`/exam?sessionId=${encodeURIComponent(active.id)}`} className="primary">Tiếp tục bài luyện tập</Link>:exams[0]?<Link href={`/exam?examVersionId=${encodeURIComponent(exams[0].id)}`} className="primary">Bắt đầu bài luyện tập</Link>:null}
        </div>
      </section>

      <div className="metric-grid three">
        <StatCard label="Số lần luyện" value={attempts.length} note="Tất cả bài đã mở"/>
        <StatCard label="Đã hoàn thành" value={submitted.length} note="Bài đã nộp"/>
        <StatCard label="Điểm luyện tập cao nhất" value={`${best}%`} note="Không phải điểm JFT chính thức"/>
      </div>

      <div className="candidate-grid">
        <div className="candidate-stack">
          <Card title="Đề luyện tập hiện có" className="candidate-card" action={<span className="ui-badge info">CBT</span>}>
            <div id="exams" className="exam-catalog">
              {exams.length?exams.map(exam=>{
                const attempt=recentByExam.get(exam.id);
                const isActive=attempt?.status==='active'&&Date.now()<new Date(attempt.expiresAt).getTime();
                const completed=attempt?.status==='submitted';
                return <article className="exam-card-row" key={exam.id} data-testid="candidate-exam-card">
                  <div>
                    <div className="exam-card-title"><h3>{exam.title}</h3><span className={`badge ${isActive?'review':completed?'approved':''}`}>{isActive?'Đang làm':completed?'Đã hoàn thành':'Sẵn sàng'}</span></div>
                    <p><span className="level-chip">{levelLabel[exam.level]}</span>{exam.questionCount} câu · {exam.durationMinutes} phút · {exam.sections.length} phần</p>
                  </div>
                  <div className="candidate-actions">
                    {completed&&attempt?<Link href={`/candidate/history/${encodeURIComponent(attempt.id)}`} className="secondary">Xem kết quả</Link>:null}
                    <Link href={isActive&&attempt?`/exam?sessionId=${encodeURIComponent(attempt.id)}`:`/exam?examVersionId=${encodeURIComponent(exam.id)}`} className="primary">{isActive?'Tiếp tục':completed?'Làm lại':'Bắt đầu'}</Link>
                  </div>
                </article>;
              }):<EmptyState title="Chưa có đề luyện tập" description="Các đề luyện tập đang được chuẩn bị. Vui lòng quay lại sau."/>}
            </div>
          </Card>

          <Card title="Lịch sử gần đây" className="candidate-card">
            <div id="history">{attempts.length?<div className="history-list">{attempts.slice(0,8).map(item=><Link className="history-link" key={item.id} href={`/candidate/history/${item.id}`}><div><div><b>{item.examTitle}</b><small>{new Date(item.startedAt).toLocaleString('vi-VN')}</small></div><span className={`badge ${item.status==='submitted'?'approved':item.status==='active'?'review':'archived'}`}>{item.status==='submitted'?'Hoàn thành':item.status==='active'?'Đang làm':'Đã hết hạn'}</span><strong>{item.scorePercent!==undefined?`${item.scorePercent}%`:`${item.answered}/${item.total}`}</strong></div></Link>)}</div>:<EmptyState title="Chưa có lịch sử" description="Hoàn thành bài luyện tập đầu tiên để theo dõi tiến độ của bạn."/>}</div>
          </Card>
        </div>

        <Card title="Gợi ý tiếp theo" className="next-step">
          <p>{submitted.length?'Mở kết quả gần nhất để xem câu sai và phần cần luyện thêm.':'Bắt đầu với một đề A1 đã phát hành để làm quen cách chuyển phần, nghe audio và nộp bài.'}</p>
          {submitted[0]?<Link href={`/candidate/history/${submitted[0].id}`} className="secondary">Xem kết quả gần nhất</Link>:exams[0]?<Link href={`/exam?examVersionId=${encodeURIComponent(exams[0].id)}`} className="secondary">Xem hướng dẫn thi</Link>:null}
        </Card>
      </div>
    </>}
  </div></CandidateShell>;
}
