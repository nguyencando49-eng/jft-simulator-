import { getRepository,repositoryMode } from '../lib/server/repository';
import { publishProductionRelease } from '../lib/server/production-release';

const envFile=process.env.JFT_RELEASE_ENV_FILE??'.env.local';
try{process.loadEnvFile(envFile)}catch(error){if(process.env.JFT_RELEASE_ENV_FILE)throw error;}
if(repositoryMode()!=='supabase')throw new Error('Production release requires the Supabase repository. Check AUTH_DISABLED and Supabase credentials.');
const result=await publishProductionRelease(getRepository());
console.log(JSON.stringify({status:'PASS',repository:repositoryMode(),...result},null,2));
