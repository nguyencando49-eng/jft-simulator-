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

const levelLabel:Record<CandidateExamSummary['level'],string>={A1:'A1',A2.1:'A2.1',A2.2:'A2.2',MIXED:'Nhiều cấp độ'};
const sectionShort:Record<string,string>={script_vocabulary:'Từ vựng',conversation_expression:'Hội thoại',listening:'Nghe',reading:'Đọc'};

export default function CandidateDashboard(){
  const [attempts,setAttempts]=useState<CandidateAttempt[]>([]);
  const [exams,setExams]=useState<CandidateExamSummary[]>([]);
  const [profile,setProfile]=useState<UserProfile|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [levelFilter,setLevelFilter]=useState<'ALL'|'A1'|'A2.1'|'A2.2'>('ALL');

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
  const best=submitted.length?Math.max(...submitted.map(item=>item.scorePercent||0)):null;
  const recentByExam=useMemo(()=>new Map(exams.map(exam=>[
    exam.id,
    attempts.find(item=>item.examVersionId===exam.id),
  ])),[attempts,exams]);
  const learnerName=profile?.displayName?.trim()||profile?.email?.split('@')[0]||'bạn';
  const visibleExams=useMemo(()=>levelFilter==='ALL'?exams:exams.filter(exam=>exam.level===levelFilter),[exams,levelFilter]);

  return <CandidateShell><div className="candidate-page candidate-page-pro">
    {error&&<Alert tone="danger" title="Không thể tải trang">{error}</Alert>}
    {loading?<Skeleton lines={7}/>:<>
      <section className="candidate-hero candidate-hero-pro">
        <div className="candidate-hero-copy">
          <div className="eyebrow">KHÔNG GIAN LUYỆN TẬP</div>
          <h1>{active?'Chào '+learnerName+', bài của bạn vẫn đang được giữ.':'Chào '+learnerName+', chọn một đề và bắt đầu.'}</h1>
          <p>{active?'Đáp án đã được lưu trên máy chủ. Tiếp tục đúng vị trí bạn dừng lại.':'Ba cấp độ, bốn phần kỹ năng và một luồng CBT thống nhất để bạn tập trung vào việc làm bài.'}</p>
          <div className="hero-actions">
            {active?<Link href={'/exam?sessionId='+encodeURIComponent(active.id)} className="primary">Tiếp tục bài đang làm</Link>:exams[0]?<Link href={'/exam?examVersionId='+encodeURIComponent(exams[0].id)} className="primary">Bắt đầu bài luyện tập</Link>:null}
            <a href="#exams" className="candidate-hero-link">Xem danh sách đề ↓</a>
          </div>
        </div>
        <div className="candidate-hero-status">
          <span>Practice bank</span><strong>3.000</strong><small>câu hỏi có kiểm soát</small>
          <div><b>525</b><span>audio nghe hiểu</span></div>
        </div>
      </section>

      <div className="metric-grid three candidate-metrics">
        <StatCard label="Lần luyện" value={attempts.length} note="Tất cả phiên đã mở"/>
        <StatCard label="Hoàn thành" value={submitted.length} note="Bài đã nộp"/>
        <StatCard label="Điểm cao nhất" value={best===null?'—':best+'%'} note="Điểm luyện tập, không phải điểm thi thật"/>
      </div>

      <div className="candidate-grid candidate-grid-pro">
        <div className="candidate-stack">
          <Card title="Đề luyện tập" className="candidate-card candidate-card-pro" action={<label className="catalog-filter"><span className="sr-only">Lọc theo cấp độ</span><select value={levelFilter} onChange={e=>setLevelFilter(e.target.value as typeof levelFilter)}><option value="ALL">Tất cả cấp độ</option><option value="A1">A1</option><option value="A2.1">A2.1</option><option value="A2.2">A2.2</option></select></label>}>
            <div id="exams" className="exam-catalog exam-catalog-pro">
              {visibleExams.length?visibleExams.map(exam=>{
                const attempt=recentByExam.get(exam.id);
                const isActive=attempt?.status==='active'&&Date.now()<new Date(attempt.expiresAt).getTime();
                const completed=attempt?.status==='submitted';
                return <article className="exam-card-row exam-card-row-pro" key={exam.id} data-testid="candidate-exam-card">
                  <div className="exam-card-main">
                    <div className="exam-card-title"><span className="level-chip">{levelLabel[exam.level]}</span><h3>{exam.title}</h3><span className={'badge '+(isActive?'review':completed?'approved':'')}>{isActive?'Đang làm':completed?'Đã hoàn thành':'Sẵn sàng'}</span></div>
                    <div className="exam-meta-line"><span>{exam.questionCount} câu</span><i>•</i><span>{exam.durationMinutes} phút</span><i>•</i><span>{exam.sections.length} phần</span></div>
                    <div className="exam-section-tags">{exam.sections.map(section=><span key={section}>{sectionShort[section]||section}</span>)}</div>
                  </div>
                  <div className="candidate-actions">
                    {completed&&attempt?<Link href={'/candidate/history/'+encodeURIComponent(attempt.id)} className="secondary">Kết quả</Link>:null}
                    <Link href={isActive&&attempt?'/exam?sessionId='+encodeURIComponent(attempt.id):'/exam?examVersionId='+encodeURIComponent(exam.id)} className="primary">{isActive?'Tiếp tục':completed?'Làm lại':'Bắt đầu'}</Link>
                  </div>
                </article>;
              }):<EmptyState title={exams.length?'Không có đề ở cấp độ này':'Chưa có đề luyện tập'} description={exams.length?'Chọn cấp độ khác để xem các đề đang phát hành.':'Các đề luyện tập đang được chuẩn bị. Vui lòng quay lại sau.'}/>}
            </div>
          </Card>

          <Card title="Lịch sử gần đây" className="candidate-card candidate-card-pro">
            <div id="history">{attempts.length?<div className="history-list history-list-pro">{attempts.slice(0,8).map(item=><Link className="history-link" key={item.id} href={'/candidate/history/'+item.id}><div><div><b>{item.examTitle}</b><small>{new Date(item.startedAt).toLocaleString('vi-VN')}</small></div><span className={'badge '+(item.status==='submitted'?'approved':item.status==='active'?'review':'archived')}>{item.status==='submitted'?'Hoàn thành':item.status==='active'?'Đang làm':'Đã hết hạn'}</span><strong>{item.scorePercent!==undefined?item.scorePercent+'%':item.answered+'/'+item.total}</strong></div></Link>)}</div>:<EmptyState title="Chưa có lịch sử" description="Hoàn thành bài luyện tập đầu tiên để theo dõi tiến độ của bạn."/>}</div>
          </Card>
        </div>

        <aside className="candidate-side">
          <Card title="Cấu trúc mỗi đề" className="next-step candidate-side-card">
            <div className="side-structure"><div><b>12</b><span>Từ vựng</span></div><div><b>12</b><span>Hội thoại</span></div><div><b>12</b><span>Nghe hiểu</span></div><div><b>12</b><span>Đọc hiểu</span></div></div>
            <p>Phần Nghe hiểu làm tuần tự và mỗi audio có tối đa hai lượt phát.</p>
          </Card>
          <Card title="Gợi ý tiếp theo" className="next-step candidate-side-card">
            <p>{submitted.length?'Mở kết quả gần nhất để xem câu sai và phần cần luyện thêm.':'Bắt đầu với A1 nếu bạn muốn làm quen nhịp CBT trước khi tăng tải.'}</p>
            {submitted[0]?<Link href={'/candidate/history/'+submitted[0].id} className="secondary">Xem kết quả gần nhất</Link>:exams[0]?<Link href={'/exam?examVersionId='+encodeURIComponent(exams[0].id)} className="secondary">Xem hướng dẫn thi</Link>:null}
          </Card>
        </aside>
      </div>
    </>}
  </div></CandidateShell>;
}
