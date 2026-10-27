import test from 'node:test';
import assert from 'node:assert/strict';
import {validate,publish,transactionViews} from './sync.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const generated_at='2026-10-23T20:00:00Z';
test('reject failed/HTML/malformed exports rather than publish them',()=>{
 for(const value of [null,[],{}, {generated_at:'invalid'}, {generated_at,count:2,positions:[]}])assert.throws(()=>validate('positions',value));
 assert.throws(()=>validate('positions',{generated_at,count:1,positions:[{}]}));
 assert.throws(()=>validate('summary',{generated_at}));
});
test('preserve the original financial payload and count',()=>{
 const position={generated_at,count:1,positions:[{isin:'JE00BN2CJ301',market_value:1234.56}],quality:{complete:false}};
 assert.strictEqual(validate('positions',position),position);
 assert.strictEqual(validate('summary',{generated_at,overview:{},quality:{}}).generated_at,generated_at);
 assert.equal(validate('purchases',{generated_at,count:0,purchases:[]}).count,0);
});
test('reject a paginated partial history instead of marking it complete',()=>{
 assert.throws(()=>validate('transactions',{generated_at,count:100,total_count:1200,transactions:Array(100).fill({}),pagination:{has_more:true}}),/Partial transaction export/);
 assert.equal(validate('transactions',{generated_at,count:1,total_count:1,transactions:[{isin:null,type:'tax'}],pagination:{has_more:false}}).count,1);
});
test('small public views cover every transaction exactly once',()=>{
 const transactions=Array.from({length:205},(_,i)=>({id:String(i),isin:i%2?'JE00BN2CJ301':null,type:i%2?'buy':'tax'}));
 const report={generated_at,transactions,instruments:[{isin:'JE00BN2CJ301',related_isins:[]}],corporate_action_links:[],quality:{complete:true},data_as_of:{},depots:[],definitions:{}};
 const files=transactionViews(report,{copied_at:generated_at});
 assert.equal(files['index.json'].pages.length,3);
 assert.deepEqual(files['index.json'].pages.flatMap(name=>files[name].transactions),transactions);
 assert.equal(files['by-isin/JE00BN2CJ301.json'].count+files['unallocated.json'].count,205);
 assert(files['index.json'].pages.every(name=>files[name].count<=100));
 assert.throws(()=>transactionViews({...report,transactions:[{isin:'../../escape'}]},{}),/Invalid transaction ISIN/);
});
test('a failed source response preserves the last publication',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'portfolio-json-check-'));
 await fs.writeFile(path.join(directory,'positions.json'),'last successful copy');
 const fetcher=async url=>new Response(JSON.stringify(url.endsWith('/summary')?{generated_at,overview:{},quality:{}}:{error:'unavailable'}),{status:url.endsWith('/summary')?200:503,headers:{'content-type':'application/json'}});
 await assert.rejects(publish(directory,fetcher),/HTTP 503/);
 assert.equal(await fs.readFile(path.join(directory,'positions.json'),'utf8'),'last successful copy');
 await fs.unlink(path.join(directory,'positions.json'));await fs.rmdir(directory);
});
