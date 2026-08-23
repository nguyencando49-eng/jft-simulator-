import { getRepository, repositoryMode } from '../lib/server/repository';
import { importProductionQuestionBank } from '../lib/server/production-question-import';

process.loadEnvFile(process.env.JFT_IMPORT_ENV_FILE ?? '.env.local');

const result=await importProductionQuestionBank(getRepository());
console.log(JSON.stringify({...result,repository:repositoryMode()},null,2));
