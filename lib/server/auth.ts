import { UserRole } from './domain';

export interface AuthContext { userId: string; role: UserRole; email?: string; displayName?: string; }
export const ACCESS_COOKIE='jft-access-token';
export const REFRESH_COOKIE='jft-refresh-token';
export const DEV_ROLE_COOKIE='jft-dev-role';
export const DEV_USER_COOKIE='jft-dev-user';

function cookie(req:Request,name:string){
  const raw=req.headers.get('cookie')||'';
  for(const item of raw.split(';')){ const i=item.indexOf('='); if(i<0)continue; if(item.slice(0,i).trim()===name)return decodeURIComponent(item.slice(i+1).trim()); }
  return null;
}
export function authDisabled(){
  if(process.env.NODE_ENV==='production')return false;
  return process.env.AUTH_DISABLED==='true'||!process.env.SUPABASE_URL;
}
export function devAuth(req:Request):AuthContext {
  const role=(cookie(req,DEV_ROLE_COOKIE)==='candidate'?'candidate':'admin') as UserRole;
  const email=cookie(req,DEV_USER_COOKIE)||`dev-${role}@local.test`;
  return {userId:`dev-${role}`,role,email,displayName:role==='admin'?'Dev Admin':'Dev Candidate'};
}
export async function requireAuth(req:Request, required?:UserRole):Promise<AuthContext>{
  if(authDisabled()){
    const ctx=devAuth(req); if(required&&ctx.role!==required)throw new Error('FORBIDDEN'); return ctx;
  }
  const bearer=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
  const token=bearer||cookie(req,ACCESS_COOKIE);
  if(!token) throw new Error('UNAUTHORIZED');
  const url=process.env.SUPABASE_URL; const anon=process.env.SUPABASE_ANON_KEY;
  if(!url||!anon) throw new Error('AUTH_NOT_CONFIGURED');
  const res=await fetch(`${url.replace(/\/$/,'')}/auth/v1/user`,{headers:{apikey:anon,Authorization:`Bearer ${token}`},cache:'no-store'});
  if(!res.ok) throw new Error('UNAUTHORIZED');
  const user=await res.json(); const role=(user.app_metadata?.role==='admin'?'admin':'candidate') as UserRole;
  if(required && role!==required) throw new Error('FORBIDDEN');
  return {userId:user.id,role,email:user.email,displayName:user.user_metadata?.display_name||user.user_metadata?.full_name};
}
