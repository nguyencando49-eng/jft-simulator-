import Link from 'next/link';
import { seedQuestions, seedAttempts } from '@/data/admin/seed';

export default function AdminDashboard(){
  const approved=seedQuestions.filter(q=>q.status==='approved').length;
  const review=seedQuestions.filter(q=>q.status==='review').length;
  const avg=seedAttempts.reduce((s,a)=>s+a.scorePercent,0)/seedAttempts.length;
  return <>
    <div className="admin-title"><div><span className="eyebrow">OVERVIEW</span><h1>JFT Content Factory</h1><p>Sinh câu hỏi bằng AI có kiểm soát, QA, human review, publish đề bất biến và theo dõi kết quả.</p></div><Link href="/admin/questions" className="primary admin-cta">+ New question</Link></div>
    <section className="metric-grid">
      <Metric label="Questions" value={seedQuestions.length.toString()} note="Seed bank"/>
      <Metric label="Approved" value={approved.toString()} note={`${review} awaiting review`}/>
      <Metric label="Published exams" value="0" note="V3 local store"/>
      <Metric label="Average score" value={`${avg.toFixed(1)}%`} note={`${seedAttempts.length} sample attempts`}/>
    </section>
    <section className="admin-grid-2">
      <div className="admin-panel"><div className="panel-head"><h2>Production pipeline</h2></div><div className="pipeline">
        <div><b>1</b><span>Draft</span><small>Create/import</small></div><i>→</i><div><b>2</b><span>Review</span><small>QA content</small></div><i>→</i><div><b>3</b><span>Approved</span><small>Ready pool</small></div><i>→</i><div><b>4</b><span>Publish</span><small>Freeze version</small></div>
      </div></div>
      <div className="admin-panel"><div className="panel-head"><h2>Readiness</h2></div><div className="readiness"><p><span>Script & Vocabulary</span><b>2 demo</b></p><p><span>Conversation</span><b>2 demo</b></p><p><span>Listening</span><b>2 demo</b></p><p><span>Reading</span><b>2 demo</b></p></div></div>
    </section>
    <section className="admin-panel"><div className="panel-head"><h2>V5 scope</h2><span className="badge green">Implemented</span></div><div className="feature-row"><span>AI generation queue</span><span>Automated QA</span><span>Human approval</span><span>Question lifecycle</span><span>Versioned snapshots</span><span>Exam generator</span><span>Local persistence adapter</span><span>Attempt analytics</span></div></section>
  </>;
}
function Metric({label,value,note}:{label:string,value:string,note:string}){return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>}
