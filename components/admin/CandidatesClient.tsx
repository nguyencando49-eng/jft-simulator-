'use client';
import { useEffect,useState } from 'react';
import { adminApi,UserProfile } from '@/lib/api-client';
type Row=UserProfile&{attempts:number;submitted:number;active:number;averageScore:number|null;lastAttemptAt?:string};

export default function CandidatesClient(){
  const [rows,setRows]=useState<Row[]>([]),[error,setError]=useState(''),[message,setMessage]=useState('');
  useEffect(()=>{void adminApi.candidates().then(result=>setRows(result.candidates)).catch(cause=>setError(cause instanceof Error?cause.message:'Tải dữ liệu thất bại.'))},[]);
  async function changeRole(id:string,role:'admin'|'candidate'){setError('');setMessage('');try{await adminApi.updateCandidateRole(id,role);setRows(current=>current.map(row=>row.id===id?{...row,role}:row));setMessage('Đã cập nhật vai trò. Người dùng cần đăng nhập lại để áp dụng vai trò mới.')}catch(cause){setError(cause instanceof Error?cause.message:'Cập nhật vai trò thất bại.')}}
  return <>
    <div className="admin-title"><div><div className="eyebrow">TÀI KHOẢN</div><h1>Quản lý người dùng</h1><p>Hồ sơ học viên/quản trị viên, vai trò và hoạt động thi từ backend.</p></div></div>
    {error&&<div className="admin-alert error">{error}</div>}{message&&<div className="admin-alert ok">{message}</div>}
    <div className="metric-grid three"><div className="metric"><span>Học viên</span><strong>{rows.filter(row=>row.role==='candidate').length}</strong></div><div className="metric"><span>Bài đang làm</span><strong>{rows.reduce((sum,row)=>sum+row.active,0)}</strong></div><div className="metric"><span>Bài đã nộp</span><strong>{rows.reduce((sum,row)=>sum+row.submitted,0)}</strong></div></div>
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Lượt thi</th><th>Đã hoàn thành</th><th>Điểm trung bình</th><th>Hoạt động gần nhất</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><b>{row.displayName||row.email}</b><br/><small>{row.email}</small></td><td><select aria-label={`Vai trò của ${row.email}`} className="role-select" value={row.role} onChange={event=>void changeRole(row.id,event.target.value as 'admin'|'candidate')}><option value="candidate">Học viên</option><option value="admin">Quản trị viên</option></select></td><td>{row.attempts}</td><td>{row.submitted}</td><td>{row.averageScore===null?'—':`${row.averageScore}%`}</td><td>{row.lastAttemptAt?new Date(row.lastAttemptAt).toLocaleString('vi-VN'):'—'}</td></tr>)}</tbody></table></div>
  </>;
}
