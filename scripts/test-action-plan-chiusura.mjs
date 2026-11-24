/* Action Plan, richiesta 24/11/2026: maschera a piena pagina, data di FINE,
   azioni e strumenti dal file "Piani di azione CR, ASP + AVT, UPT + MS",
   CHECK che sostituisce l'azione rossa, alert obbligatorio dopo il CHECK,
   EFFETTUA CHECK dal box, badge su ACTION PLAN, CHIUDI ACTION PLAN (DM). */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync('assets/js/app.js','utf8'),guided=readFileSync('assets/js/action-plan-guided.js','utf8'),api=readFileSync('assets/js/cloud-api.js','utf8'),css=readFileSync('assets/css/app.css','utf8');
const ctx={Number,String,Math,Object,Array,Set,Map,JSON,console,Date,atob,btoa,encodeURIComponent,decodeURIComponent,Infinity,
 currentUser:{display_name:'Dm Prova',username:'dm1',role:'ADMIN',profile_role:'DM',admin_id:'ADM1'},isoDate:()=> '2026-11-24',
 esc:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')};
vm.createContext(ctx);
vm.runInContext(app.slice(app.indexOf('const AP_YTD_DEF='),app.indexOf('function apYtdImpactChart(')),ctx);
vm.runInContext(guided.replace(/^const /gm,'var '),ctx);
const enc=m=>'[APOBJ2:'+btoa(encodeURIComponent(JSON.stringify(m)))+']';

// --- piena pagina, data di fine, apertura su STEP 04 ---
assert.ok(app.includes("$('#modalRoot .modal')?.classList.add('ap-fullpage')")&&css.includes('#modalRoot .modal.wide.ap-fullpage'),'maschera a piena pagina');
assert.ok(app.includes('DATA FINE ACTION PLAN<input id="apEndDate" type="date"')&&app.includes("end_date:$('#apEndDate')?.value||''"),'data di fine tra le info iniziali e nel salvataggio');
assert.ok(app.includes("const startStep=plan?.plan_id&&!plan.is_draft&&")&&app.includes("showStep(startStep);"),'APRI su un piano salvato porta a STEP 04 · OBIETTIVI');
assert.ok(app.includes("stepper.className='ap-stepper'"),'barra di avanzamento degli step');

// --- catalogo del PPT ---
assert.equal(ctx.AP_PPT_ACTIONS.length,18,'18 azioni');
assert.deepEqual([...ctx.apCatalogFor('cr')].map(a=>a.n),[1,2,3,4,5,6],'CR: azioni 1-6');
assert.deepEqual([...ctx.apCatalogFor('asp')].map(a=>a.n),[7,8,9,10,11,12],'ASP: azioni 7-12');
assert.deepEqual([...ctx.apCatalogFor('atv')].map(a=>a.n),[7,8,9,10,11,12],'ATV (= AVT): stesso gruppo di ASP');
assert.deepEqual([...ctx.apCatalogFor('upt')].map(a=>a.n),[13,14,15,16,17,18],'UPT: azioni 13-18');
assert.deepEqual([...ctx.apCatalogFor('ms')].map(a=>a.n),[13,14,15,16,17,18],'MS: stesso gruppo di UPT');
const a2=ctx.apCatalogAction('cr','Aggancio e accoglienza');
assert.ok(a2.how[0].startsWith('Saluto e contatto visivo')&&a2.tools.includes('My T. n°5 (aggancio)')&&a2.verify==='CR, n° nuove fidelity','ogni azione con COME, strumenti e verifica');
assert.ok(ctx.AP_PPT_ACTIONS.every(a=>a.how.length&&a.tools.length&&!a.tools.some(t=>/^verifica/i.test(t))),'nessuna riga "Verifica" tra gli strumenti');
const h=ctx.apGuidedPairsHtml('cr',[{action:'Aggancio e accoglienza',tools:['My T. n°5 (aggancio)','Role play al briefing di apertura','Liste clienti CRM per le chiamate']}]);
assert.ok(h.includes('COME · AZIONI CONCRETE')&&h.includes('Saluto e contatto visivo'),'il COME è integrato nell azione');
assert.ok(h.includes('value="Obiettivo individuale nuove fidelity" disabled')&&h.includes('3 / 3'),'massimo 3 strumenti');
assert.ok(h.includes('2. Aggancio e accoglienza')&&h.includes('Altro: scrivi l’azione'),'le 6 azioni del piano + inserimento manuale');
assert.deepEqual([...ctx.apGuidedPairsFromMeta({kpi:'cr',pairs:[{action:'Aggancio e accoglienza',tool:'A · B'}]})[0].tools],['A','B'],'obiettivi salvati prima: strumenti recuperati');

// --- CHECK: l'azione rossa è sostituita ---
const base=[{action:'A',tool:'t1'},{action:'B',tool:'t2'}];
const checks=[{date:'2026-11-20',saved:true,rows:[{action:'A',light:'RED',newAction:'A2',newTool:'n1'},{action:'B',light:'GREEN'}]}];
assert.deepEqual([...ctx.apChecksActivePairs(base,checks)].map(x=>x.action),['A2','B'],'la nuova azione prende il posto della vecchia');
assert.deepEqual([...ctx.apChecksAllPairs(base,checks)].map(x=>x.action),['A','B','A2'],'lo storico (task e PDF) conserva anche la vecchia');
const c2=[...checks,{date:'2026-11-27',saved:true,rows:[{action:'A2',light:'RED',newAction:'A3'},{action:'B',light:'YELLOW'}]}];
assert.deepEqual([...ctx.apChecksActivePairs(base,c2)].map(x=>x.action),['A3','B'],'e cosi a ogni CHECK');
assert.ok(guided.includes("apCheckHtml(c,i,apChecksActivePairs(data.pairs||[],(data.checks||[]).slice(0,i)))"),'ogni CHECK mostra le azioni attive in quel momento');

// --- alert obbligatorio dopo il CHECK ---
const nuovo={isNew:true,date:'2026-11-24',rows:[{action:'A',light:'GREEN'}]};
assert.match(ctx.apCheckValidate({...nuovo},'2026-11-24'),/PROSSIMO ALERT/);
assert.match(ctx.apCheckValidate({...nuovo,nextAlert:{date:'2026-11-24',next:'x'}},'2026-11-24'),/successivo/);
assert.match(ctx.apCheckValidate({...nuovo,nextAlert:{date:'2026-12-01',next:''}},'2026-11-24'),/NEXT STEPS/);
assert.equal(ctx.apCheckValidate({...nuovo,nextAlert:{date:'2026-12-01',next:'Verificare'}},'2026-11-24'),'');
assert.equal(ctx.apCheckValidate({date:'2026-11-24',rows:[{action:'A',light:'GREEN'}],snapshot:{date:'2026-11-24'}},'2026-11-24'),'','modificare un CHECK salvato non chiede un nuovo alert');
assert.ok(guided.includes("data.alerts.push({date:a.date,set_at:new Date().toISOString(),next_steps:a.next,by:apUserLabel()})"),'salvando il CHECK il nuovo alert entra tra gli alert');

// --- box obiettivo e finestra CHECK ---
const obj={objective_text:'CR 23,5%',status:'IN_PROGRESS',notes:enc({kpi:'cr',ac:22,target:23.5,pairs:[{action:'Aggancio e accoglienza',tools:['My T. n°5 (aggancio)']}],alerts:[{date:'2026-12-01',next_steps:'Controllare'}],checks:[{date:'2026-11-20',rows:[]}]})};
vm.runInContext('var actionPlanStatusClass=()=>"",actionPlanStatusLabel=()=>"In corso";',ctx);
const card=ctx.apObjCardHtml(obj,0,{});
assert.ok(card.includes('data-ap-obj-check="0"')&&card.includes('EFFETTUA CHECK')&&card.includes('Prossimo alert 01/12/2026')&&card.includes('Ultimo CHECK 20/11/2026'),'box con EFFETTUA CHECK, prossimo alert e ultimo check');
assert.ok(!ctx.apObjCardHtml(obj,0,{closed:true}).includes('EFFETTUA CHECK'),'piano chiuso: niente CHECK');
assert.ok(app.includes("root.querySelectorAll('[data-ap-obj-check]').forEach(b=>b.onclick=()=>apOpenCheckWindow("),'il tasto apre CHECK MONITORAGGIO');
assert.ok(guided.includes("form.requestSubmit()"),'il CHECK registrato viene salvato con l Action Plan');

// --- badge ---
const plans=[{objectives:[obj,{notes:enc({alerts:[{date:'2026-11-20'}]})}]},{closed:true,objectives:[{notes:enc({alerts:[{date:'2026-11-20'}]})}]}];
assert.equal(ctx.apAlertBadgeCount(plans,'2026-11-24'),1,'NEGOZIO: alert scaduti, esclusi i piani chiusi');
const dmPlans=[{admin_id:'ADM1',end_date:'2026-11-20'},{admin_id:'ADM1',end_date:'2026-11-24'},{admin_id:'ADM1',end_date:'2026-12-01'},{admin_id:'ADM1',end_date:'2026-11-01',closed:true},{admin_id:'ADM1',end_date:'2026-11-01',is_draft:true},{admin_id:'ADM2',end_date:'2026-11-01'},{admin_id:'ADM1'}];
assert.equal(ctx.apCloseBadgeCount(dmPlans,'2026-11-24','ADM1'),2,'DM: piani propri con data di fine raggiunta, non chiusi');
assert.ok(guided.includes(`document.querySelector('.nav-group-btn[data-nav-group="action-plans"]')`),'badge anche sulla voce principale ACTION PLAN');

// --- chiusura ---
assert.equal(ctx.apCloseEsito(6).emoji,'🏆');assert.equal(ctx.apCloseEsito(0).emoji,'✅');assert.equal(ctx.apCloseEsito(-3).emoji,'🤏');assert.equal(ctx.apCloseEsito(-10).emoji,'⚠️');assert.equal(ctx.apCloseEsito(-30).emoji,'❌');
const d=ctx.apCloseDelta(24,23.5);assert.ok(Math.abs(d.delta-0.5)<1e-9&&Math.abs(d.pct-2.1276)<1e-3,'delta in unità e in %');
assert.equal(ctx.apCloseFmtDelta(0.5,'%'),'+0,50 pt');assert.equal(ctx.apCloseFmtDelta(-2,'€'),'−2,00 €');
assert.ok(ctx.apCanClosePlan({admin_id:'ADM1'})&&!ctx.apCanClosePlan({admin_id:'ADM1',is_draft:true})&&!ctx.apCanClosePlan({admin_id:'ADM2'}),'chiude solo il DM proprietario, non le bozze');
assert.ok(app.includes('data-action-plan-close="${p.plan_id}">CHIUDI ACTION PLAN</button>')&&app.includes('data-action-plan-esito="${p.plan_id}">ESITO</button>'),'tasti in riga: CHIUDI (DM) ed ESITO (tutti)');
assert.ok(guided.includes("window.agendaCloudApi.request('closeActionPlan'")&&api.includes("closeActionPlan:['actionPlan','audit']"),'chiusura salvata e cache aggiornata');
assert.ok(app.includes('function apApplyClosedReadOnly(plan)'),'piano chiuso in sola lettura');
console.log('PASS: Action Plan a piena pagina, data di fine, catalogo azioni, CHECK, alert, chiusura');
