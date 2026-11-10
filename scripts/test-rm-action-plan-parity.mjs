/* ACTION PLAN del profilo RM: stesse righe del profilo DM, senza il tasto Apri,
   e filtro DM che si apre su TUTTI I DM. Il test esegue le funzioni vere. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const src=readFileSync('assets/js/app.js','utf8'),righe=src.split('\n');
const estrai=inizio=>{
 const i=righe.findIndex(x=>x.startsWith(inizio));
 assert.notEqual(i,-1,`Manca ${inizio}`);
 for(let n=1;n<=60;n++){const f=righe.slice(i,i+n).join('\n');try{new vm.Script(f);return f}catch{}}
 assert.fail(`Frammento non compilabile: ${inizio}`);
};
const ctx={Number,String,Math,Array,JSON,Object,Date,console,app:{stores:[]}};
vm.createContext(ctx);
for(const n of ['function esc(','function actionPlanStore(','function actionPlanStoreLabel(','function actionPlanPeriodLabel(',
 'function apYtdPremise(','function actionPlanStatusKey(','function actionPlanStatusLabel(','function actionPlanPct(',
 'function actionPlanPctFmt(','function actionPlanTableMarkup(','function rmActionCombine(']) vm.runInContext(estrai(n),ctx);

const piano={plan_id:'P1',store_id:'S1',plan_date:'2026-09-01',period_year:2026,period_fraction:'H2',premise:'Premessa',
 objectives:[{objective_text:'CR sopra il 18%',status:'IN_PROGRESS'},{objective_text:'UPT 2,1',status:'ACHIEVED'}],objective_count:2,achieved_count:1};

// --- le righe sono le stesse: cambia solo il tasto ---
const dm=ctx.actionPlanTableMarkup([piano],{storeColumn:true,storeLabel:()=>'339 · PISTOIA'});
const rm=ctx.actionPlanTableMarkup([piano],{storeColumn:true,canOpen:false,storeLabel:()=>'339 · PISTOIA'});
assert.ok(dm.includes('data-action-plan-open="P1"'),'Il profilo DM deve avere il tasto Apri');
assert.ok(!rm.includes('data-action-plan-open'),'Il profilo RM non deve avere il tasto Apri');
assert.ok(rm.includes('data-action-plan-pdf="P1"'),'Il profilo RM deve avere il tasto CREA PDF');
assert.equal(rm,dm.replace('<button class="btn small" data-action-plan-open="P1">Apri</button>',''),
 'Tolto il tasto Apri, le due righe devono coincidere carattere per carattere');
const intestazioni=t=>[...t.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map(m=>m[1]);
assert.deepEqual(intestazioni(rm),intestazioni(dm),'Le colonne devono essere le stesse nei due profili');
assert.deepEqual(intestazioni(rm),['Negozio','Data','Periodo','Premessa','OBJ scelti','N. OBJ','Raggiunti','Avanzamento',''],
 'Le colonne sono quelle della tabella del profilo DM');
assert.ok(ctx.actionPlanTableMarkup([piano],{premiseHead:'Analisi'}).includes('<th>Analisi</th>'),
 'Il profilo NEGOZIO vede Analisi al posto di Premessa');

/* Non basta che il costruttore sappia togliere il tasto: va provato che la pagina
   RM lo chieda davvero. Qui si esegue il renderer della pagina. */
const host={innerHTML:''},kpis={innerHTML:''},negozi={innerHTML:''};
const rmCtx={...ctx,rmPct:v=>`${(Number(v)||0).toFixed(1)}%`,
 rmActionReportCache:{kpis:{plans:1,objectives:2,achieved:1,in_progress:1,achievement_pct:50},stores:[{dm_name:'DM Uno',region:'TOSCANA',code:'339',name:'PISTOIA',plan_count:1,objectives:2,achieved:1,in_progress:1,achievement_pct:50}]},
 rmActionPlansCache:{plans:[{...piano,dm_name:'DM Uno',rm_store_label:'339 · PISTOIA'}]},
 $:sel=>sel==='#rmActionPlans'?host:sel==='#rmActionKpis'?kpis:sel==='#rmActionStores'?negozi:{value:''}};
vm.createContext(rmCtx);
for(const n of ['function esc(','function actionPlanStore(','function actionPlanStoreLabel(','function actionPlanPeriodLabel(',
 'function apYtdPremise(','function actionPlanStatusKey(','function actionPlanStatusLabel(','function actionPlanPct(',
 'function actionPlanPctFmt(','function actionPlanTableMarkup(','function renderRMActionPlans(']) vm.runInContext(estrai(n),rmCtx);
rmCtx.renderRMActionPlans();
assert.ok(host.innerHTML.includes('action-plan-table'),'La pagina RM deve usare la tabella del profilo DM, non le schede');
assert.ok(!host.innerHTML.includes('data-action-plan-open'),'La pagina RM non deve produrre il tasto Apri');
assert.ok(!host.innerHTML.includes('rm-plan-card'),'Le vecchie schede non devono piu comparire');
assert.equal((host.innerHTML.match(/data-action-plan-pdf/g)||[]).length,1,'Ogni piano deve avere il suo CREA PDF');
assert.ok(host.innerHTML.includes('339 · PISTOIA · DM Uno'),'Con tutti i DM la riga deve dire di chi e il piano');
assert.ok(negozi.innerHTML.startsWith('<table')&&negozi.innerHTML.includes('<th>DM</th>'),'Il riepilogo negozi resta per DM');

// --- piu DM nello stesso perimetro ---
const combinato=ctx.rmActionCombine([
 {dm:{dm_id:'A',display_name:'DM Uno',stores:[{store_id:'S1',store_code:'339',name:'PISTOIA'}]},
  report:{kpis:{plans:1,objectives:2,achieved:1,in_progress:1,not_achieved:0},stores:[{region:'TOSCANA',name:'PISTOIA'}]},list:{plans:[piano]}},
 {dm:{dm_id:'B',display_name:'DM Due',stores:[]},
  report:{kpis:{plans:3,objectives:6,achieved:3,in_progress:2,not_achieved:1},stores:[{region:'MARCHE',name:'MACERATA'}]},list:{plans:[{...piano,plan_id:'P2'}]}}]);
assert.equal(combinato.kpis.plans,4,'I piani dei DM si sommano');
assert.equal(combinato.kpis.objectives,8,'Gli OBJ si sommano');
assert.equal(combinato.kpis.achieved,4,'I raggiunti si sommano');
assert.equal(combinato.kpis.achievement_pct,50,'Il raggiungimento si ricalcola sul totale, non e una media di medie');
assert.deepEqual(combinato.plans.map(p=>p.dm_name),['DM Uno','DM Due'],'Ogni piano porta il suo DM');
assert.equal(combinato.plans[0].rm_store_label,'339 · PISTOIA','Il negozio si risolve sull anagrafica del DM');
assert.deepEqual(combinato.stores.map(x=>x.dm_name),['DM Uno','DM Due'],'Ogni negozio porta il suo DM');
assert.equal(ctx.rmActionCombine([]).kpis.achievement_pct,0,'Senza OBJ il raggiungimento resta zero, non NaN');

// --- il filtro si apre su TUTTI I DM ---
const sync=estrai('function syncRMDirectoryControls()');
assert.ok(sync.includes("const ap=$('#rmActionDm')")&&sync.includes("'<option value=\"\">TUTTA LA CATENA · Tutti i DM</option>'+options"),
 'Il filtro DM dell Action Plan deve offrire TUTTI I DM');
assert.ok(/ap\.value=\[\.\.\.ap\.options\]\.some\(x=>x\.value===old\)\?old:''/.test(sync),
 'Senza una scelta precedente il filtro deve aprirsi su TUTTI I DM');
assert.ok(sync.includes("if(sel.id==='rmActionDm')return;"),
 'Il perimetro condiviso non deve riscrivere il filtro Action Plan, o perderebbe la voce TUTTI I DM');
const load=estrai('async function loadRMActionPlans(');
assert.ok(load.includes("selected=String($('#rmActionDm')?.value||'')")&&load.includes('filter(x=>!selected||String(x.dm_id)===selected)'),
 'Il caricamento deve seguire il filtro, non il perimetro di un altra pagina');
assert.ok(!/if\(!isRetailManager\(\)\|\|!rmSelectedDmId\)return/.test(load),
 'Il caricamento non deve piu fermarsi quando nessun singolo DM e selezionato');

// --- il PDF deve trovare il piano anche nel profilo RM ---
assert.ok(estrai('async function downloadActionPlanPdf(').includes("...(rmActionPlansCache?.plans||[])"),
 'CREA PDF deve cercare il piano anche fra quelli caricati dal profilo RM');

console.log('PASS: ACTION PLAN del profilo RM con righe del DM, solo CREA PDF e filtro su tutti i DM');
