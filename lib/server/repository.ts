import { MemoryRepository } from './memory-repository';
import { SupabaseRepository } from './supabase-repository';
import { Repository } from './domain';
let singleton: Repository | null = null;
export function getRepository(): Repository {
  if(singleton) return singleton;
  singleton = process.env.AUTH_DISABLED!=='true' && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? new SupabaseRepository() : new MemoryRepository();
  return singleton;
}
export function repositoryMode(){ return process.env.AUTH_DISABLED!=='true' && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? 'supabase' : 'memory'; }
