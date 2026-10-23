import test from 'node:test';
import assert from 'node:assert/strict';
import {validate} from './sync.mjs';
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
