'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import UserMenu from '@/components/auth/UserMenu';

const groups=[
  {label:'Tổng quan',items:[['/admin','Bảng điều khiển']]},
  {label:'Nội dung',items:[['/admin/sources','Thư viện nguồn'],['/admin/factory','Xưởng tạo câu hỏi AI'],['/admin/questions','Ngân hàng câu hỏi']]},
  {label:'Sản xuất',items:[['/admin/content-production','Sản xuất nội dung'],['/admin/exams','Tạo đề thi']]},
  {label:'Chất lượng',items:[['/admin/attempts','Lượt làm bài']]},
  {label:'Người dùng',items:[['/admin/candidates','Học viên']]},
  {label:'Hệ thống',items:[['/admin/system','Trạng thái hệ thống']]},
] as const;

export default function AdminNav(){
  const path=usePathname();
  return <aside className="admin-nav">
    <Link href="/admin" className="admin-logo">JFT Studio<small>Vận hành nội dung</small></Link>
    <nav aria-label="Điều hướng quản trị">{groups.map(group=><div className="nav-group" key={group.label}>
      <span>{group.label}</span>
      {group.items.map(([href,label])=><Link key={href} href={href} className={path===href?'active':''}>{label}</Link>)}
    </div>)}</nav>
    <div className="admin-user"><UserMenu/></div>
    <Link className="back-site" href="/">← Về trang chính</Link>
  </aside>;
}
