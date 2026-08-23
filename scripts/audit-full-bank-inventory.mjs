const base=process.env.SUPABASE_URL?.replace(/\/$/,'');
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;

if(!base||!key)throw new Error('Production Supabase configuration is required.');

const headers={apikey:key,Authorization:`Bearer ${key}`};
const rows=[];
for(let offset=0;;offset+=1000){
  const response=await fetch(`${base}/rest/v1/questions?select=payload&order=updated_at.desc,id.asc&limit=1000&offset=${offset}`,{headers});
  if(!response.ok)throw new Error(`Supabase ${response.status}: inventory request failed.`);
  const page=await response.json();
  if(!Array.isArray(page))throw new Error('Supabase inventory response was not an array.');
  rows.push(...page);
  if(page.length<1000)break;
}

const questions=rows.map(row=>row.payload);
const group=property=>Object.fromEntries(
  [...new Set(questions.map(question=>question[property]??'missing'))]
    .sort()
    .map(value=>[value,questions.filter(question=>(question[property]??'missing')===value).length]),
);
const listening=questions.filter(question=>question.section==='listening');
const hasScriptTag=question=>question.tags?.some(tag=>tag.startsWith('audio-script:'))??false;

console.log(JSON.stringify({
  total:questions.length,
  status:group('status'),
  source:group('source'),
  level:group('level'),
  section:group('section'),
  listening:{
    total:listening.length,
    withAudio:listening.filter(question=>question.audioSrc).length,
    withoutAudio:listening.filter(question=>!question.audioSrc).length,
    withScriptTag:listening.filter(hasScriptTag).length,
    withoutScriptTag:listening.filter(question=>!hasScriptTag(question)).length,
  },
},null,2));
