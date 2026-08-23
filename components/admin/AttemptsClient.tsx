'use client';
import { useEffect,useState } from 'react';
import { adminApi } from '@/lib/api-client';

const sessionStatus:Record<string,string>={active:'Đang làm',submitted:'Đã nộp',expired:'Hết giờ'};

export default function AttemptsClient(){
  const [rows,setRows]=useState<Awaited<ReturnType<typeof adminApi.attempts>>['attempts']>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{void adminApi.attempts().then(result=>setRows(result.attempts)).catch(cause=>setError(cause instanceof Error?cause.message:'Tải dữ liệu thất bại.')).finally(()=>setLoading(false))},[]);
  const submitted=rows.filter(row=>row.scorePercent!==undefined),average=submitted.length?submitted.reduce((sum,attempt)=>sum+(attempt.scorePercent??0),0)/submitted.length:0,completion=rows.length?rows.reduce((sum,attempt)=>sum+(attempt.total?attempt.answered/attempt.total:0),0)/rows.length*100:0;
  return <>
    <div className="admin-title"><div><span className="eyebrow">PHÂN TÍCH LƯỢT THI</span><h1>Lượt làm bài</h1><p>Dữ liệu trực tiếp từ phiên làm bài của học viên, không sử dụng dữ liệu mẫu.</p></div></div>
    {error&&<div className="admin-alert error">{error}</div>}
    <section className="metric-grid three"><div className="metric"><span>Tổng lượt</span><strong>{rows.length}</strong><small>{loading?'Đang tải…':'Phiên trên máy chủ'}</small></div><div className="metric"><span>Điểm trung bình</span><strong>{average.toFixed(1)}%</strong><small>Các lượt đã nộp</small></div><div className="metric"><span>Mức hoàn thành</span><strong>{completion.toFixed(1)}%</strong><small>Số câu đã trả lời / tổng số câu</small></div></section>
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Lượt thi</th><th>Phiên bản đề</th><th>Trạng thái</th><th>Bắt đầu</th><th>Đã trả lời</th><th>Điểm</th></tr></thead><tbody>{rows.map(attempt=><tr key={attempt.id}><td className="mono">{attempt.id.slice(0,8)}</td><td>{attempt.examVersionId}</td><td><span className={`badge ${attempt.status==='submitted'?'approved':'review'}`}>{sessionStatus[attempt.status]??attempt.status}</span></td><td>{new Date(attempt.startedAt).toLocaleString('vi-VN')}</td><td>{attempt.answered}/{attempt.total}</td><td><strong>{attempt.scorePercent===undefined?'—':`${attempt.scorePercent}%`}</strong></td></tr>)}</tbody></table></div>
  </>;
}
