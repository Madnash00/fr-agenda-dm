/* Richieste del 23/11/2026 (sera): barra azioni contestuale, planning sul mese
   corrente, prefetch con una sola richiesta, RM con una richiesta per sezione,
   storico ferie in memoria, date/audit/ordinamento uniformi. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync('assets/js/app.js','utf8'),html=readFileSync('index.html','utf8'),api=readFileSync('assets/js/cloud-api.js','utf8'),ferie=readFileSync('assets/js/ferie-dm.js','utf8');
const estrai=inizio=>{const r=app.split('\n'),i=r.findIndex(x=>x.startsWith(inizio));assert.notEqual(i,-1,'Manca '+inizio);for(let n=1;n<=60;n++){const f=r.slice(i,i+n).join('\n');try{new vm.Script(f);return f}catch{}}assert.fail(inizio)};
const ctx={String,Number,Array,Object,Map,Set,JSON,console,app:{users:[{id:'ADM2',display_name:'Dm Rossi'}]},storeById:id=>id==='STO1'?{name:'PISTOIA'}:null,profileDirectory:null};
vm.createContext(ctx);
for(const n of ['function fmtDmy(','const AUDIT_ACTION_LABELS=','const AUDIT_ENTITY_LABELS=','function auditLabel(','function auditUserName('])vm.runInContext(estrai(n).replace(/^const /,'var '),ctx);
// 2. barra azioni
assert.ok(html.includes('id="newVisitBtn" class="btn primary" data-top-pages="calendar agenda"')&&html.includes('id="exportPlanningBtn" class="btn" data-top-pages="calendar"')&&html.includes('id="backupBtn" class="btn" data-top-pages="calendar audit"'),'ogni tasto dichiara le sue pagine');
assert.ok(app.includes('target.classList.add(\'active\');updateTopActions(page);'),'aggiornata a ogni cambio pagina');
{const btns=[...html.matchAll(/data-top-pages="([^"]+)"/g)].map(m=>m[1].split(' '));
 const doc={q:[]};const mk=pages=>({dataset:{topPages:pages.join(' ')},cls:new Set(),classList:{toggle(c,on){on?this.o.add(c):this.o.delete(c)}}});
 const bar={items:btns.map(mk),cls:new Set()};bar.items.forEach(b=>b.classList.o=b.cls);bar.classList={o:bar.cls,toggle(c,on){on?this.o.add(c):this.o.delete(c)}};bar.querySelectorAll=()=>bar.items;
 const c2={document:{querySelector:()=>bar},String};vm.createContext(c2);vm.runInContext(estrai('function updateTopActions('),c2);
 c2.updateTopActions('actionplans');assert.ok(bar.cls.has('top-actions-empty'),'Action Plan: nessun tasto');
 c2.updateTopActions('calendar');assert.ok(!bar.cls.has('top-actions-empty')&&bar.items.every(b=>!b.cls.has('top-action-off')),'Calendario: tutti');
 c2.updateTopActions('audit');assert.equal(bar.items.filter(b=>!b.cls.has('top-action-off')).length,1,'Audit: solo Backup');}
// 3. mese corrente
assert.ok(app.includes("host.innerHTML=h;scrollPlanningToCurrentMonth(host,")&&ferie.includes("scrollPlanningToCurrentMonth(host,'dm|'"),'Planning Ferie e Ferie DM si aprono sul mese corrente');
// 4. prefetch e RM
assert.ok(app.includes("api.request('getPrefetchBundle'")&&app.includes("if(prefetchActive()&&err?.code!=='STALE_SESSION')pump()"),'una richiesta unica, con ripiego sulle singole');
assert.ok(api.includes('if(snapshot&&(snapshot.get(domainOf(action))||0)!==generation(domainOf(action)))return;'),'non si mettono in cache dati superati da un salvataggio');
assert.ok(!/for\(let i=0;i<dms\.length;i\+=4\)\{\s*const (data|chunk)=/.test(app)&&app.includes("rmPerDm('getRMOvertime'")&&app.includes("rmPerDm('getRMActionPlanReport'"),'RM: una richiesta per sezione');
assert.ok(app.includes("if(err?.code!=='UNKNOWN_ACTION')throw err"),'RM: ripiego per DM con backend vecchio');
// 5. storico ferie
assert.ok(app.includes("Date.now()-(old.loadedAt||0)<300000")&&app.includes("$('#reloadHolidayPlanningAudit').onclick=()=>loadHolidayPlanningAudit(true,true);"),'storico in memoria 5 minuti, Aggiorna lo riscarica');
// 6. uniformita
assert.equal(ctx.fmtDmy('2026-11-10'),'10/11/2026');assert.equal(ctx.fmtDmy('2026-11-10T09:05:00Z'),'10/11/2026 09:05');
assert.equal(ctx.auditLabel(ctx.AUDIT_ACTION_LABELS,'CREATE_ACTION_PLAN'),'Action Plan creato');assert.equal(ctx.auditLabel(ctx.AUDIT_ACTION_LABELS,'NUOVA_AZIONE'),'Nuova azione');
assert.equal(ctx.auditUserName('ADM2'),'Dm Rossi');assert.equal(ctx.auditUserName('STO1'),'PISTOIA');
assert.ok(app.includes("rows=(rows||[]).slice().sort((a,b)=>String(b.plan_date||'').localeCompare(String(a.plan_date||''))"),'Action Plan: data piu recente, poi negozio');
console.log('PASS: barra contestuale, mese corrente, prefetch unico, RM aggregato, storico ferie, uniformita');
