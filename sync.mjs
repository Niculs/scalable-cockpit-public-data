import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const origin='https://scalable-cockpit.iku68.chatgpt.site';
export const kinds=['summary','positions','purchases'];
export function validate(kind,value){
 if(!value||typeof value!=='object'||Array.isArray(value)||!Number.isFinite(Date.parse(value.generated_at)))throw Error('Invalid '+kind+' response');
 if(kind==='summary'&&(!value.overview||!value.quality))throw Error('Missing summary data');
 if(kind!=='summary'&&(!Array.isArray(value[kind])||value.count!==value[kind].length))throw Error('Invalid '+kind+' count');
 if(kind==='positions'&&value.positions.some(p=>!p.isin))throw Error('Missing position identifier');
 return value;
}
export async function collect(fetcher=fetch){
 const result={};
 for(const kind of kinds){
  let error;
  for(let attempt=0;attempt<3;attempt++){
   try{
    const response=await fetcher(origin+'/api/public/'+kind,{headers:{Accept:'application/json','User-Agent':'ScalablePublicJSONMirror/1.0'},redirect:'error',signal:AbortSignal.timeout(35000)});
    if(!response.ok)throw Error(kind+' returned HTTP '+response.status);
    if(!response.headers.get('content-type')?.includes('application/json'))throw Error(kind+' did not return JSON');
    const raw=await response.text();if(Buffer.byteLength(raw)>10_000_000)throw Error('Response too large');
    result[kind]=validate(kind,JSON.parse(raw));error=null;break;
   }catch(e){error=e;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));}
  }
  if(error)throw error;
 }
 return result;
}
export async function publish(directory='public',fetcher=fetch){
 const reports=await collect(fetcher),copiedAt=new Date().toISOString();
 const delivery={type:'public_snapshot',copied_at:copiedAt,automatic_refresh_enabled:process.env.MIRROR_SCHEDULE_ACTIVE==='1',scheduled_refresh_minutes:15,stale_after_seconds:3600,source_origin:origin,note:'Copied from the public Cockpit APIs. Check copied_at and each report data_as_of. Scheduled jobs may be delayed; this is not a live proxy.'};
 await fs.mkdir(directory,{recursive:true});
 for(const kind of kinds){
  const value={...reports[kind],delivery};
  await fs.writeFile(directory+'/'+kind+'.json',JSON.stringify(value,null,2)+'\n');
  await fs.mkdir(directory+'/api/public/'+kind,{recursive:true});
  await fs.writeFile(directory+'/api/public/'+kind+'/index.html',JSON.stringify(value,null,2)+'\n');
 }
 const bundle={schema_version:1,delivery,...reports};
 await fs.writeFile(directory+'/all.json',JSON.stringify(bundle,null,2)+'\n');
 await fs.writeFile(directory+'/index.json',JSON.stringify({schema_version:1,delivery,endpoints:{summary:'summary.json',positions:'positions.json',purchases:'purchases.json',all:'all.json'}},null,2)+'\n');
 await fs.writeFile(directory+'/index.html','<!doctype html><html lang="de"><meta charset="utf-8"><title>Scalable Cockpit – öffentliche JSON-Daten</title><h1>Öffentliche JSON-Daten</h1><p>Stand der Kopie: '+copiedAt+'</p><p>Automatische Aktualisierung alle 15 Minuten vorgesehen. Zeitplanläufe können sich verzögern. Datenzeitstempel stehen in jeder JSON-Datei.</p><ul>'+kinds.concat('all').map(kind=>'<li><a href="'+kind+'.json">'+kind+'.json</a></li>').join('')+'</ul></html>');
 await fs.writeFile(directory+'/.nojekyll','');
 await fs.writeFile(directory+'/robots.txt','User-agent: *\nAllow: /\n');
 console.log(JSON.stringify({copied_at:copiedAt,positions:reports.positions.count,purchases:reports.purchases.count}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await publish(process.argv[2]||'public');
