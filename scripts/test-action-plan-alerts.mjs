/* Action Plan, richiesta 23/11/2026: layout TRAFFICO E CONVERSIONE, MS in euro,
   KPI selezionabili, azioni con strumento, alert prossimo check (storico con
   semaforo e badge del menu). Le funzioni vengono eseguite su dati finti. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync('assets/js/app.js','utf8'),guided=readFileSync('assets/js/action-plan-guided.js','utf8'),css=readFileSync('assets/css/app.css','utf8');
const estrai=(src,inizio)=>{const r=src.split('\n'),i=r.findIndex(x=>x.startsWith(inizio));assert.notEqual(i,-1,`Manca ${inizio}`);
 for(let n=1;n<=80;n++){const f=r.slice(i,i+n).join('\n');try{new vm.Script(f);return f}catch{}}assert.fail(inizio)};
const ctx={Number,String,Math,Object,Array,Set,Map,JSON,console,isFinite,Date,atob,btoa,encodeURIComponent,decodeURIComponent,esc:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')};
vm.createContext(ctx);
vm.runInContext(app.slice(app.indexOf('const AP_YTD_DEF='),app.indexOf('function apYtdImpactChart(')),ctx);
vm.runInContext(guided.replace(/^const /gm,'var '),ctx);

// --- 1. TRAFFICO E CONVERSIONE: CR AC sotto INGRESSI, D CR a fianco ---
assert.ok(app.includes("['02','Traffico e conversione',['visD','cr','crD']]"),'Ordine dei campi invariato');
assert.ok(/apy-panel-traffic \.apy-grid>\.apy-field:nth-child\(2\)\{grid-column:1;grid-row:2\}/.test(css)&&/nth-child\(3\)\{grid-column:2;grid-row:2\}/.test(css),'CR AC sotto INGRESSI AC vs AP, D CR vs AP a fianco');

// --- 2. MS in euro ---
const v={sales:100000,salesD:5,visD:2,cr:20,crD:1,upt:1.6,uptD:3,asp:50,aspD:1,atv:80,atvD:4,ms:57,msD:5};
const d=ctx.apYtdCalculate(v),ms=d.impacts.find(x=>x[0]==='MS');
const T=100000/80,msAP=57/1.05,k=(1.6-0.43)/0.57,atteso=(57-msAP)/100*T*(k-1)*50;
assert.ok(Math.abs(ms[1]-atteso)<1e-6,'MS: (MS AC - MS AP) x scontrini x (k-1) x ASP');
assert.equal(ms[2],'ricavi','MS e un importo come gli altri KPI');
/* Controprova: e l effetto sull incasso dell UPT che avrebbe avuto l AP con la MS AP. */
const uptConMsAP=1+(k-1)*msAP/100;assert.ok(Math.abs(atteso-T*(1.6-uptConMsAP)*50)<1e-6,'Coerente con UPT e ASP');
assert.ok(Math.abs(d.ms.multiAtv-k*50)<1e-9&&d.ms.singleAtv===50,'ATV scontrino multiplo k x ASP, singolo = ASP');
const neg=ctx.apYtdCalculate({...v,msD:-5});assert.ok(neg.impacts[6][1]<0,'MS in calo: impatto negativo');
assert.ok(ctx.apYtdCalculate({...v,msD:0}).impacts[6][1]===0,'MS invariata: zero');
const zero=ctx.apYtdCalculate({...v,ms:0,msD:-100+1e-9});assert.ok(zero,'MS AC a zero non rompe il calcolo');
const incoerente=ctx.apYtdCalculate({...v,upt:1.2});assert.equal(incoerente.ms.consistent,false,'UPT troppo basso per quella MS: segnalato');
const testo=ctx.apYtdMsExplain(v,d);
assert.ok(testo.includes('57% degli scontrini con più di un pezzo, 43% con un pezzo solo')&&testo.includes('(= ASP)'),'La spiegazione dichiara il criterio');
assert.ok(ctx.apYtdMsExplain({...v,upt:1.2},incoerente).includes('non sono coerenti'),'E avvisa se MS e UPT non tornano');
assert.ok(app.includes("gli impatti non si sommano.</p>'+apYtdMsExplain(v,d)"),'Spiegazione sotto il grafico');

// --- 3. KPI selezionabili ---
assert.deepEqual([...ctx.AP_GUIDED_SELECTABLE],['cr','upt','asp','atv','ms'],'INCASSATO e INGRESSI non sono piu selezionabili');
assert.ok(guided.includes("AP_GUIDED_KPIS.filter(k=>AP_GUIDED_SELECTABLE.includes(k.id)||k.id===data.kpi)"),'Restano solo per riaprire obiettivi gia salvati con quei KPI');
assert.equal(ctx.AP_GUIDED_KPIS.find(k=>k.id==='ms').unit,'%','La MS obiettivo e una percentuale come MS AC');

// --- 4. azioni con strumento ---
/* 24/11/2026: azioni e strumenti dal file "Piani di azione CR, ASP + AVT, UPT + MS" (vedi test-action-plan-chiusura.mjs). */
for(const k of ctx.AP_GUIDED_SELECTABLE){const acts=ctx.apCatalogFor(k);
 assert.equal(acts.length,6,`${k}: le 6 azioni del suo piano`);
 for(const a of acts)assert.ok(a.how.length>=2&&a.tools.length>=2,`${k}: COME e strumenti per ${a.action}`);}
assert.ok(ctx.apGuidedToolsFor('cr','Scritta a mano').length>=15,'Per un azione scritta a mano si propongono tutti gli strumenti del gruppo KPI');
const h=ctx.apGuidedPairsHtml('cr',[{action:'Aggancio e accoglienza',tools:['Role play al briefing di apertura']},{action:'Mia azione',manualAction:true,how:['Fare X'],tools:['Mio strumento']}]);
assert.ok(h.includes('AZIONE 1')&&h.includes('AZIONE 2')&&h.includes('+ AGGIUNGI AZIONE')&&h.includes('2 / 3 azioni'),'Elenco azioni con tasto Aggiungi');
assert.ok(h.includes('<option value="__manual" selected>Altro: scrivi l’azione</option>')&&h.includes('value="Mia azione"')&&h.includes('data-ap-pair-how'),'Azione manuale con il suo COME');
assert.ok(h.includes('value="Mio strumento" checked'),'Strumento manuale');
assert.ok(h.includes('value="Role play al briefing di apertura" checked'),'Strumento proposto selezionato');
const tre=ctx.apGuidedPairsHtml('cr',[{action:'a'},{action:'b'},{action:'c'}].map(x=>({...x,tool:''})));
assert.ok(tre.includes('id="apAddPairBtn" disabled'),'Massimo 3 azioni');
assert.ok(ctx.apGuidedPairsHtml('cr',[{action:'',tool:''}]).includes('Gli strumenti si scelgono dopo l’azione'),'Lo strumento si sceglie dopo l azione');
assert.deepEqual(ctx.apGuidedPairsFromMeta({actions:['A','B'],tools:['T1'],otherAction:'C'}).map(p=>p.action+'|'+p.tool),['A|T1','B|','C|'],'Vecchi obiettivi: azioni recuperate, strumento da completare');
assert.ok(!guided.includes('apGuidedNextSteps'),'NEXT STEPS eliminato');

// --- 5. alert ---
assert.equal(ctx.apAlertLatest([{date:'2026-12-01'},{date:'2026-11-20'}]),'2026-12-01');
const col=x=>ctx.apAlertColor(x).hue;
assert.equal(col(0),125,'CHECK lo stesso giorno: verde');
assert.ok(col(3)<col(1)&&col(1)<125&&col(3)>col(6)&&col(6)>0,'Da verde a giallo a rosso man mano che il CHECK si allontana');
assert.equal(col(7),0,'A 7 giorni: rosso');assert.equal(col(-7),0,'Anche 7 giorni prima');assert.equal(col(9),0,'Oltre: rosso');assert.equal(col(null),0,'Senza CHECK: rosso');
assert.ok(Math.abs(col(3.5)-62.5)<1,'A meta finestra: giallo');
const checks=[{date:'2026-11-22',saved:true},{date:'2026-11-27',saved:true},{date:'2026-11-21',saved:false}];
assert.deepEqual(JSON.parse(JSON.stringify(ctx.apAlertMatch('2026-11-20',checks))),{diff:2,date:'2026-11-22'},'CHECK salvato piu vicino, il non salvato non conta');
assert.equal(ctx.apAlertMatch('2026-11-20',[]),null);
const alerts=[{date:'2026-11-10'},{date:'2026-11-23'},{date:'2026-12-05'}];
assert.deepEqual(ctx.apAlertsExpired(alerts,'2026-11-23').map(a=>a.date),['2026-11-23','2026-11-10'],'Storico: solo gli scaduti, dal piu recente');
const box=ctx.apAlertsHtml({alerts,checks:[{date:'2026-11-23',saved:true}],alertHistoryOpen:true});
assert.ok(box.includes('IMPOSTA ALERT PROSSIMO CHECK')&&box.includes('type="date" id="apAlertDate"')&&box.includes('STORICO ALERT (')&&box.includes('Prossimo alert: 05/12/2026'),'Finestra alert con data da calendario o a mano e storico');
assert.ok(box.includes('stesso giorno')&&box.includes('Nessun CHECK entro 7 giorni'),'Storico con esito per riga');
assert.ok(!/remove|elimina/i.test(estrai(guided,'function apAlertsHtml(')+estrai(guided,'function apAlertsWire(')),'Gli alert non si cancellano');
assert.ok(guided.includes("if(d<apToday()){toast('La data dell’alert non può essere nel passato.',true);return}"),'Niente alert nel passato');

// --- 6. badge ---
const meta=a=>({notes:'[APOBJ2:'+btoa(encodeURIComponent(JSON.stringify({alerts:a})))+']'});
const plans=[{objectives:[meta([{date:'2026-11-20'}]),meta([{date:'2026-11-20'},{date:'2026-12-10'}]),meta([]),{notes:'nota legacy'}]},{active:false,objectives:[meta([{date:'2026-11-01'}])]}];
assert.equal(ctx.apAlertBadgeCount(plans,'2026-11-23'),1,'Badge: obiettivi il cui alert piu recente e scaduto; un alert futuro lo spegne');
assert.equal(ctx.apAlertBadgeCount(plans,'2026-12-10'),2,'Il giorno dell alert successivo il badge torna');
const upd=estrai(guided,'function apUpdateAlertBadge(');
assert.ok(upd.includes("currentUser?.role==='STORE'"),'Badge solo per il profilo NEGOZIO');
assert.ok(app.includes('renderActionPlans();apUpdateAlertBadge()}')&&app.includes("{actionPlanCache=d;apUpdateAlertBadge()}"),'Badge aggiornato al caricamento e al prefetch');
assert.ok(/\.nav-alert-badge\{[^}]*background:#d32f2f/.test(css),'Badge rosso');
// --- 7. salvataggio definitivo del negozio: TIMING e note del CHECK non piu obbligatori ---
const salva=estrai(app,'async function saveActionPlanForm(');
assert.ok(!salva.includes('AP_TIMING_OPTIONS.includes')&&!salva.includes("!String(t.owner||'').trim()"),'Il TIMING eliminato non deve piu bloccare il salvataggio definitivo');
assert.ok(salva.includes("(!c.date||!c.contingency)"),'Un CHECK richiede data ed esito, le note sono facoltative');
console.log('PASS: Action Plan 23/11: layout CR, MS in euro, KPI, azioni+strumento, alert, storico e badge');
