import { MemoryRepository } from './memory-repository';
import { SupabaseRepository } from './supabase-repository';
import { Repository } from './domain';
import { authDisabled } from './auth';
let singleton: Repository | null = null;
export function getRepository(): Repository {
  if(singleton) return singleton;
  const mode=repositoryMode();
  if(mode==='not-configured')throw new Error('REPOSITORY_NOT_CONFIGURED');
  singleton = mode==='supabase' ? new SupabaseRepository() : new MemoryRepository();
  return singleton;
}
export function repositoryMode(){
  if(!authDisabled()&&process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY)return 'supabase';
  return process.env.NODE_ENV==='production'?'not-configured':'memory';
}
