'use client';
import Link from 'next/link'; import { usePathname } from 'next/navigation'; import UserMenu from '@/components/auth/UserMenu';
const items=[['/admin','Dashboard'],['/admin/factory','AI Factory'],['/admin/questions','Question Bank'],['/admin/exams','Exam Builder'],['/admin/attempts','Attempts'],['/admin/candidates','Candidates'],['/admin/system','System']] as const;
export default function AdminNav(){const path=usePathname();return <aside className="admin-nav"><div className="admin-logo">JFT FACTORY<small>Simulator Admin V5</small></div><nav>{items.map(([href,label])=><Link key={href} href={href} className={path===href?'active':''}>{label}</Link>)}</nav><div className="admin-user"><UserMenu/></div><Link className="back-site" href="/">← Public home</Link></aside>}
