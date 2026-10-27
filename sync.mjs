import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const origin='https://scalable-cockpit.iku68.chatgpt.site';
export const kinds=['summary','positions','purchases','transactions'];
export function validate(kind,value){
 if(!value||typeof value!=='object'||Array.isArray(value)||!Number.isFinite(Date.parse(value.generated_at)))throw Error('Invalid '+kind+' response');
 if(kind==='summary'&&(!value.overview||!value.quality))throw Error('Missing summary data');
 if(kind!=='summary'&&(!Array.isArray(value[kind])||value.count!==value[kind].length))throw Error('Invalid '+kind+' count');
 if(kind==='positions'&&value.positions.some(p=>!p.isin))throw Error('Missing position identifier');
 if(kind==='transactions'&&(value.pagination?.has_more!==false||value.total_count!==value.count))throw Error('Partial transaction export must not replace complete history');
 return value;
}
export function transactionViews(report,delivery){
 const files={},size=100,rows=report.transactions;
 const ids=[...new Set(rows.map(r=>r.isin).filter(Boolean))].sort();
 if(ids.some(id=>!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(id)))throw Error('Invalid transaction ISIN');
 const pageNames=[];
 const context={schema_version:1,generated_at:report.generated_at,data_as_of:report.data_as_of,delivery,quality:report.quality};
 for(let offset=0;offset<rows.length;offset+=size){
  const name='pages/'+String(offset/size).padStart(4,'0')+'.json',page=rows.slice(offset,offset+size);pageNames.push(name);
  files[name]={...context,count:page.length,total_count:rows.length,pagination:{offset,limit:size,has_more:offset+page.length<rows.length,next_offset:offset+page.length<rows.length?offset+page.length:null},transactions:page};
 }
 for(const isin of ids){
  const selected=rows.filter(r=>r.isin===isin),instrument=report.instruments.find(r=>r.isin===isin);
  files['by-isin/'+isin+'.json']={...context,isin,count:selected.length,instrument,corporate_action_links:report.corporate_action_links.filter(link=>link.from_isin===isin||link.to_isin===isin),transactions:selected,related_histories:(instrument?.related_isins||[]).map(id=>id+'.json')};
 }
 const unallocated=rows.filter(r=>!r.isin);files['unallocated.json']={...context,count:unallocated.length,transactions:unallocated};
 files['index.json']={...context,total_count:rows.length,securities:ids.length,page_size:size,pages:pageNames,unallocated:'unallocated.json',instruments:report.instruments.map(instrument=>({...instrument,history:'by-isin/'+instrument.isin+'.json'})),depots:report.depots,definitions:report.definitions};
 return files;
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
 const revisions=new Map();
 for(const report of Object.values(result))for(const [broker,state] of Object.entries(report.data_as_of?.broker_imports||{})){
  if(revisions.has(broker)&&revisions.get(broker)!==state.revision)throw Error('Broker import changed during publication: '+broker);
  revisions.set(broker,state.revision);
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
 for(const [name,value] of Object.entries(transactionViews(reports.transactions,delivery))){
  const file=directory+'/transactions/'+name;await fs.mkdir(file.slice(0,file.lastIndexOf('/')),{recursive:true});await fs.writeFile(file,JSON.stringify(value,null,2)+'\n');
 }
 const bundle={schema_version:2,delivery,links:{transaction_index:'transactions/index.json'},...reports};
 await fs.writeFile(directory+'/all.json',JSON.stringify(bundle,null,2)+'\n');
 await fs.writeFile(directory+'/index.json',JSON.stringify({schema_version:2,delivery,endpoints:{summary:'summary.json',positions:'positions.json',purchases:'purchases.json',transactions:'transactions.json',transaction_index:'transactions/index.json',all:'all.json'}},null,2)+'\n');
 await fs.writeFile(directory+'/index.html','<!doctype html><html lang="de"><meta charset="utf-8"><title>Scalable Cockpit – öffentliche JSON-Daten</title><h1>Öffentliche JSON-Daten</h1><p>Stand der Kopie: '+copiedAt+'</p><p>Automatische Aktualisierung alle 15 Minuten vorgesehen. Zeitplanläufe können sich verzögern. Datenzeitstempel stehen in jeder JSON-Datei.</p><ul>'+kinds.concat('all').map(kind=>'<li><a href="'+kind+'.json">'+kind+'.json</a></li>').join('')+'</ul></html>');
 await fs.writeFile(directory+'/.nojekyll','');
 await fs.writeFile(directory+'/robots.txt','User-agent: *\nAllow: /\n');
 console.log(JSON.stringify({copied_at:copiedAt,positions:reports.positions.count,purchases:reports.purchases.count,transactions:reports.transactions.count}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await publish(process.argv[2]||'public');
