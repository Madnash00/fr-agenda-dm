import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';

// Deterministic synthetic workloads. Output is NOT production latency.
const source=fs.readFileSync('assets/js/cloud-api.js','utf8');
const cut=source.indexOf('const XLSX_CDN_URL=');
assert.ok(cut>0);
function createClient(fetchFn){
 const window={AgendaAdminContext:null,dispatchEvent(){}};
 const sess=new Map();
 const storage={getItem:k=>sess.get(k)||null,setItem:(k,v)=>sess.set(k,v),removeItem:k=>sess.delete(k),get length(){return sess.size},key:i=>[...sess.keys()][i]||null};
 const env={window,sessionStorage:storage,AbortController,Date,Map,Set,Promise,JSON,Error,Math,Number,String,console,setTimeout,clearTimeout,CustomEvent:class{constructor(type,props){this.type=type;this.detail=props?.detail}}};
 vm.createContext(env);vm.runInContext(source.slice(0,cut)+';this.makeApi=createAgendaApi;',env);
 return env.makeApi({endpoint:'https://example.invalid/synthetic',fetchFn,getToken:()=> 'synthetic-user'});
}
const n=120;
let hits=0;
const api=createClient(async(_url,opts)=>{hits++;const req=JSON.parse(opts.body);return {json:async()=>({ok:true,data:{selected:req.filter?.region||'x',items:[]}})}});
const duration=(xs,p)=>xs.slice().sort((a,b)=>a-b)[Math.min(xs.length-1,Math.ceil(xs.length*p)-1)];
const records=[];
for(let i=0;i<n;i++){
 const begin=performance.now();
 const x=await api.request('getActionPlans',{filter:{region:'NORD',store:'A'},__cacheTtl:60000});
 assert.equal(x.selected,'NORD');
 records.push(performance.now()-begin);
}
assert.equal(hits,1,'Identical reads should use one network request');
api.clearDomain('actionPlan');
await api.request('getActionPlans',{filter:{region:'NORD',store:'B'},__cacheTtl:60000});
assert.equal(hits,2);
await api.request('getActionPlans',{filter:{region:'SUD',store:'B'},__cacheTtl:60000});
assert.equal(hits,3,'Nested scope changes must not reuse cache entry');
console.log(JSON.stringify({
 kind:'SYNTHETIC_CLIENT_BENCHMARK',sampleSize:n,
 cacheHitCount:n-1,networkRequests:hits,
 cachedClientCallP50ms:+duration(records,0.5).toFixed(4),
 cachedClientCallP95ms:+duration(records,0.95).toFixed(4),
 disclaimer:'Local mocked API; excludes browser rendering, production network, Apps Script, Google Sheets and permission checks'
},null,2));
