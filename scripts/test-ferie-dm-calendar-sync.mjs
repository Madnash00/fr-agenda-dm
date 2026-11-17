/* FERIE DM -> CALENDARIO: togliere una giornata da FERIE DM deve toglierla
   anche dal calendario. Il backend cancella l'evento; il difetto stava nel
   browser, che rileggeva il calendario dalla propria cache senza sapere che
   un salvataggio di FERIE DM lo aveva cambiato. Qui si esegue il vero client
   API contro un finto server: nessun dato reale. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('assets/js/cloud-api.js','utf8'),fer=readFileSync('assets/js/ferie-dm.js','utf8');
const env={window:{AgendaAdminContext:null,dispatchEvent(){}},
 sessionStorage:{getItem(){return null},setItem(){},removeItem(){},get length(){return 0},key(){return null}},
 localStorage:{getItem(){return null},setItem(){},removeItem(){},get length(){return 0},key(){return null}},
 AbortController,Date,Map,Set,Promise,JSON,Error,Math,Number,String,console,clearTimeout,setTimeout,
 CustomEvent:class{constructor(n,o){this.type=n;this.detail=o?.detail}}};
vm.createContext(env);
vm.runInContext(source.slice(0,source.indexOf('const XLSX_CDN_URL='))+';this.makeApi=createAgendaApi;',env);

/* Finto server: una ferie il 4 maggio che FERIE DM puo togliere. */
function server(){
 const s={ferie:new Set(['2026-05-04']),letture:{getCalendar:0,getAgendaEvents:0,getRMCalendar:0}};
 s.fetchFn=async(_u,o)=>{const b=JSON.parse(o.body),a=b.action;
  if(a in s.letture){s.letture[a]++;return {json:async()=>({ok:true,data:{events:[...s.ferie].map(d=>({event_id:'E'+d,event_date:d,event_type:'DM_HOLIDAY',hours:8}))}})}}
  if(a==='saveDmHolidayPlan'){for(const e of b.entries||[])e.hours>0?s.ferie.add(e.plan_date):s.ferie.delete(e.plan_date);return {json:async()=>({ok:true,data:{saved:1,changed:1}})}}
  if(a==='addCompanyClosure'){s.ferie.add(b.date);return {json:async()=>({ok:true,data:{added:true,defaults:1}})}}
  if(a==='removeCompanyClosure'){s.ferie.delete(b.date);return {json:async()=>({ok:true,data:{removed:true}})}}
  return {json:async()=>({ok:true,data:{}})}};
 return s;
}
const giorni=r=>(r?.events||[]).map(e=>e.event_date).sort();
const R={from:'2026-05-01',to:'2026-05-31'};

{const srv=server(),api=env.makeApi({endpoint:'https://example.invalid/t',fetchFn:srv.fetchFn,getToken:()=>'sessione-finta'});
 assert.deepEqual(giorni(await api.request('getCalendar',R)),['2026-05-04']);
 assert.deepEqual(giorni(await api.request('getCalendar',R)),['2026-05-04'],'seconda lettura dalla cache');
 assert.equal(srv.letture.getCalendar,1,'Premessa: il calendario e in cache nel browser');
 await api.request('getAgendaEvents',{});
 await api.request('saveDmHolidayPlan',{year:2026,entries:[{plan_date:'2026-05-04',hours:0}]});
 assert.deepEqual(giorni(await api.request('getCalendar',R)),[],'Tolta da FERIE DM, la giornata sparisce dal calendario');
 assert.equal(srv.letture.getCalendar,2,'Dopo il salvataggio il calendario si rilegge dal centrale');
 assert.deepEqual(giorni(await api.request('getAgendaEvents',{})),[],'E sparisce anche da Agenda DM');
 await api.request('saveDmHolidayPlan',{year:2026,entries:[{plan_date:'2026-05-11',hours:4}]});
 assert.deepEqual(giorni(await api.request('getCalendar',R)),['2026-05-11'],'Vale anche al contrario: una ferie aggiunta compare subito');
 await api.request('addCompanyClosure',{date:'2026-05-15'});
 assert.deepEqual(giorni(await api.request('getCalendar',R)),['2026-05-11','2026-05-15'],'Una chiusura aziendale compare subito sul calendario');
 await api.request('removeCompanyClosure',{date:'2026-05-15'});
 assert.deepEqual(giorni(await api.request('getCalendar',R)),['2026-05-11'],'E togliendola sparisce subito');}

/* La pagina: dopo il salvataggio si azzera la scorciatoia "intervallo appena
   letto" e, se il calendario e aperto, lo si ridisegna con i dati nuovi. */
{const estratto=fer.slice(fer.indexOf('function dmFerieCalendarRefresh(){'));const fn=estratto.slice(0,estratto.indexOf('\n}\n')+3);
 const passi=[],aperta={v:true};
 const ctx={currentUser:{role:'ADMIN'},calendarRangeFreshUntil:new Map([['2026-05-04|2026-05-31',Date.now()+30000]]),
  refreshCloudState:async()=>{passi.push('rilettura')},renderCalendar:()=>passi.push('ridisegno'),
  $:sel=>sel==='#page-calendar'?{classList:{contains:c=>c==='active'&&aperta.v}}:null};
 vm.createContext(ctx);vm.runInContext(fn,ctx);
 ctx.dmFerieCalendarRefresh();
 assert.equal(ctx.calendarRangeFreshUntil.size,0,'La scorciatoia del calendario viene azzerata subito');
 await new Promise(r=>setTimeout(r,0));
 assert.deepEqual(passi,['rilettura','ridisegno'],'Calendario aperto: si rilegge e si ridisegna');
 passi.length=0;aperta.v=false;ctx.dmFerieCalendarRefresh();await new Promise(r=>setTimeout(r,0));
 assert.deepEqual(passi,['rilettura'],'Calendario chiuso: si rilegge soltanto');
 passi.length=0;ctx.currentUser={role:'RM'};ctx.dmFerieCalendarRefresh();await new Promise(r=>setTimeout(r,0));
 assert.deepEqual(passi,[],'Il RM non modifica FERIE DM: nessuna rilettura del calendario');}
assert.ok(fer.includes("dmFerieSetStatus('Salvato','ok');dmFerieCalendarRefresh();"),'Il salvataggio del planning chiama il riallineamento');

console.log('PASS: togliere o aggiungere ferie in FERIE DM riallinea subito calendario e Agenda DM, anche con le chiusure');
