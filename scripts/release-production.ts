import { getRepository,repositoryMode } from '../lib/server/repository';
import { publishProductionRelease } from '../lib/server/production-release';

process.loadEnvFile(process.env.JFT_RELEASE_ENV_FILE??'.env.local');
if(repositoryMode()!=='supabase')throw new Error('Production release requires the Supabase repository. Check AUTH_DISABLED and Supabase credentials.');
const result=await publishProductionRelease(getRepository());
console.log(JSON.stringify({status:'PASS',repository:repositoryMode(),...result},null,2));
