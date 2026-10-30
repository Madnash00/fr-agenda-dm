import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('assets/js/cloud-api.js','utf8');
const cut=source.indexOf('const XLSX_CDN_URL=');
assert.ok(cut>0,'API client boundary not found');
const environment={
 window:{AgendaAdminContext:null,dispatchEvent(){}},
 sessionStorage:{getItem(){return null},setItem(){},removeItem(){},get length(){return 0},key(){return null}},
 AbortController,Date,Map,Set,Promise,JSON,Error,Math,Number,String,console,clearTimeout,setTimeout,
 CustomEvent:class{constructor(name,options){this.type=name;this.detail=options?.detail}}
};
vm.createContext(environment);
vm.runInContext(source.slice(0,cut)+';this.makeApi=createAgendaApi;',environment);

function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}}
function makeServer(){
 const reads=[],calls=[],state={value:'old'},fetchFn=async(_url,options)=>{
  const body=JSON.parse(options.body);calls.push(body.action);
  if(body.action==='getActionPlans'){
   const value=state.value,hold=deferred();reads.push(hold);
   await hold.promise;return {json:async()=>({ok:true,data:{value}})};
  }
  if(body.action==='saveActionPlan'){state.value=body.value;return {json:async()=>({ok:true,data:{value:state.value}})}}
  return {json:async()=>({ok:true,data:{}})};
 };
 return {state,reads,calls,fetchFn}
}
const server=makeServer();
const api=environment.makeApi({endpoint:'https://example.invalid/test',fetchFn:server.fetchFn,getToken:()=> 'fake-session'});
const firstRead=api.request('getActionPlans');
await Promise.resolve();
assert.equal(server.reads.length,1,'Initial request should start once');
const write=api.request('saveActionPlan',{value:'new'});
await write;
const freshRead=api.request('getActionPlans');
await Promise.resolve();
assert.equal(server.reads.length,2,'Read after a save must be fresh');
server.reads[1].resolve();
const newResult=await freshRead;
assert.equal(newResult.value,'new');
server.reads[0].resolve();
for(let i=0;i<8;i++)await Promise.resolve();
assert.equal(server.reads.length,3,'Stale response must trigger a new verified fetch');
server.reads[2].resolve();
const originalResult=await firstRead;
assert.equal(originalResult.value,'new','Late pre-write reply must refresh, not restore stale data');
const cached=await api.request('getActionPlans');
assert.equal(cached.value,'new','Cache must retain post-write data');
assert.equal(server.calls.filter(x=>x==='getActionPlans').length,3,'No redundant read on fresh cache');

// Concurrent identical reads are deduplicated. Explicit force bypasses a pending non-forced read.
api.clearCache('actionPlan');
const regular=api.request('getActionPlans');
const duplicate=api.request('getActionPlans');
await Promise.resolve();
assert.equal(server.reads.length,4,'Duplicate read must be deduplicated');
server.reads[3].resolve();
await Promise.all([regular,duplicate]);
assert.equal(server.calls.filter(x=>x==='getActionPlans').length,3);
console.log('PASS: P0 API stale-read fencing, cache invalidation and read deduplication');
