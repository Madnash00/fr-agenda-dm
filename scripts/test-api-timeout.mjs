/* Audit 23/11/2026: una richiesta che non risponde non deve bloccare l'app.
   Letture: tempo massimo e un secondo tentativo. Scritture: tempo massimo,
   nessun secondo tentativo (potrebbero essere gia' registrate). */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('assets/js/cloud-api.js','utf8'),cut=source.indexOf('const XLSX_CDN_URL=');
const env={window:{AgendaAdminContext:null,dispatchEvent(){}},sessionStorage:{getItem(){return null},setItem(){},removeItem(){},get length(){return 0},key(){return null}},
 AbortController,Date,Map,Set,Promise,JSON,Error,Math,Number,String,console,clearTimeout,setTimeout,CustomEvent:class{constructor(n,o){this.type=n;this.detail=o?.detail}}};
vm.createContext(env);vm.runInContext(source.slice(0,cut)+';this.makeApi=createAgendaApi;this.T=[AGENDA_READ_TIMEOUT_MS,AGENDA_LOGIN_TIMEOUT_MS,AGENDA_WRITE_TIMEOUT_MS];',env);
assert.deepEqual([...env.T],[45000,45000,90000],'tempi massimi: letture e login 45 s, scritture 90 s');
/* fetch che rispetta l'abort come quello del browser */
const hanging=(calls,answerOn)=>async(_u,o)=>{const a=JSON.parse(o.body).action;calls.push(a);const n=calls.filter(x=>x===a).length;
 if(answerOn&&n>=answerOn)return {json:async()=>({ok:true,data:{n}})};
 return new Promise((_,rej)=>o.signal.addEventListener('abort',()=>rej(new Error('aborted'))))};
{const calls=[],api=env.makeApi({endpoint:'https://example.invalid/x',fetchFn:hanging(calls,2),getToken:()=>'t'});
 const out=await api.request('getActionPlans',{__timeout:30});
 assert.equal(out.n,2,'lettura: al primo tempo scaduto riprova e usa la seconda risposta');}
{const calls=[],api=env.makeApi({endpoint:'https://example.invalid/x',fetchFn:hanging(calls,0),getToken:()=>'t'});
 const t=Date.now();await assert.rejects(api.request('getBootstrap',{__timeout:30}),e=>e.code==='API_UNAVAILABLE'&&e.timeout===true&&/non risponde/.test(e.message));
 assert.equal(calls.length,2,'lettura: due tentativi in tutto, poi errore chiaro');assert.ok(Date.now()-t<2000,'e non resta appesa');}
{const calls=[],api=env.makeApi({endpoint:'https://example.invalid/x',fetchFn:hanging(calls,0),getToken:()=>'t'});
 await assert.rejects(api.request('saveActionPlan',{__timeout:30}),e=>e.code==='API_UNAVAILABLE'&&/verificare se il salvataggio/.test(e.message));
 assert.equal(calls.length,1,'scrittura: un solo tentativo');}
{const calls=[],api=env.makeApi({endpoint:'https://example.invalid/x',fetchFn:hanging(calls,0),getToken:()=>'t'});
 const p=api.request('getActionPlans',{__timeout:5000});await new Promise(r=>setTimeout(r,10));api.clearCache();
 await assert.rejects(p,e=>e.code==='STALE_SESSION');assert.equal(calls.length,1,'annullata dal cambio sessione: nessun nuovo tentativo');}
{const calls=[],deaf=async(_u,o)=>{calls.push(1);return new Promise(()=>{})};/* fetch che ignora l'annullamento */
 const api=env.makeApi({endpoint:'https://example.invalid/x',fetchFn:deaf,getToken:()=>'t'});
 await assert.rejects(api.request('getActionPlans',{__timeout:30}),e=>e.timeout===true);assert.equal(calls.length,2,'anche se fetch ignora l annullamento la richiesta finisce');}
console.log('PASS: timeout e nuovo tentativo delle richieste');
