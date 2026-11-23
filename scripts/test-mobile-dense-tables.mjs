/* Tabelle dense come schede sul telefono. Una cella senza data-label diventa un
   valore senza nome: la scheda resta illeggibile proprio dove serviva. Il test
   esegue i costruttori veri e controlla ogni tabella marcata mobile-cards. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync('assets/js/app.js','utf8'),css=readFileSync('assets/css/app.css','utf8');
const righe=app.split('\n');

// --- lo stile vive solo sotto i 720px ---
const i=css.indexOf('@media screen and (max-width:720px){\n table.mobile-cards');
assert.notEqual(i,-1,'Il blocco delle schede deve stare dentro la media query del telefono');
const blocco=css.slice(i,css.indexOf('\n}',i));
for(const regola of ['table.mobile-cards thead{display:none}','td::before{content:attr(data-label)',
 'td.mobile-title{order:-1','tr{display:grid'])
 assert.ok(blocco.includes(regola),`Manca ${regola}`);
assert.ok(!css.slice(0,i).includes('table.mobile-cards{'),'Fuori dal telefono deve restare una tabella normale');
/* L'ordine conta: nel markup il titolo arriva dopo regione, codice e DM, quindi
   senza order:-1 il nome del negozio comparirebbe in mezzo alla scheda. */
assert.ok(blocco.includes('tr{display:grid'),'Senza griglia order non avrebbe effetto');

// --- ogni tabella a schede dichiarata nel sorgente ---
const tabelle=[...app.matchAll(/<table class=\\?"[^"\\]*mobile-cards[^"\\]*\\?">/g)];
assert.ok(tabelle.length>=5,`Attese almeno 5 tabelle a schede, trovate ${tabelle.length}`);
for(const t of tabelle){
 const dopo=app.slice(t.index,app.indexOf('</table>',t.index));
 const colonne=(dopo.match(/<th[ >]/g)||[]).length;
 const estratto=dopo.slice(0,90);
 assert.ok(dopo.includes('mobile-title'),`Una tabella a schede senza cella titolo: ${estratto}`);
 /* Due modi di comporre le celle: markup letterale, oppure l'aiutante td(valore,etichetta).
    Nel secondo caso l'etichetta non compare nel sorgente, quindi si verifica che
    ogni chiamata la passi: una td(x) senza etichetta produrrebbe una cella muta. */
 const chiamate=[...dopo.matchAll(/\+td\(/g)].map(m=>{
  /* Gli argomenti contengono a loro volta parentesi, es. td(fmt(x.ore),'Goduto'):
     si bilanciano le parentesi invece di affidarsi a una espressione regolare. */
  let liv=0,virgola=false;
  for(let k=m.index+3;k<dopo.length;k++){
   const c=dopo[k];
   if(c==='(')liv++;
   else if(c===')'){liv--;if(!liv)return {testo:dopo.slice(m.index,k+1),virgola}}
   else if(c===','&&liv===1)virgola=true;
  }
  return {testo:dopo.slice(m.index,m.index+40),virgola:false};
 });
 if(chiamate.length){
  const mute=chiamate.filter(c=>!c.virgola).map(c=>c.testo);
  assert.equal(mute.length,0,`Celle costruite con td() senza etichetta: ${mute.join(' ')}`);
 }else{
  const etichette=new Set([...dopo.matchAll(/data-label="([^"]*)"/g)].map(m=>m[1]));
  assert.ok(etichette.size>=colonne-3,
   `Troppe celle senza etichetta (${etichette.size} per ${colonne} colonne): ${estratto}`);
 }
}

// --- i costruttori condivisi, eseguiti ---
const estrai=inizio=>{const k=righe.findIndex(x=>x.startsWith(inizio));assert.notEqual(k,-1,`Manca ${inizio}`);
 for(let n=1;n<=60;n++){const f=righe.slice(k,k+n).join('\n');try{new vm.Script(f);return f}catch{}}
 assert.fail(`Frammento non compilabile: ${inizio}`)};
const ctx={Number,String,Math,Array,JSON,Object,Date,console,app:{stores:[]},atob,btoa,encodeURIComponent,decodeURIComponent};
vm.createContext(ctx);
/* La tabella esclude dai conteggi gli obiettivi disattivati (modulo guidato). */
{const g=readFileSync('assets/js/action-plan-guided.js','utf8');for(const n of ['function apGuidedMeta(','function apObjDisabled(','function apObjActive('])vm.runInContext(g.slice(g.indexOf(n),g.indexOf('\n',g.indexOf(n))),ctx);}
for(const n of ['function esc(','function overtimeNum(','function overtimeFmt(','function overtimeCoverageState(',
 'function overtimeMetricDisplay(','function overtimeDetailCells(','const OVERTIME_METRIC_HEAD=',
 'function overtimeStoresTableMarkup(','function overtimeEmployeesTableMarkup(','function actionPlanStore(',
 'function actionPlanStoreLabel(','function actionPlanPeriodLabel(','function apYtdPremise(','function actionPlanStatusKey(',
 'function actionPlanStatusLabel(','function actionPlanPct(','function actionPlanPctFmt(','function actionPlanTableMarkup('])
 vm.runInContext(estrai(n),ctx);

const coverage={month_count:3,sickness_months:3,injury_months:3};
const prodotti={
 negozi:ctx.overtimeStoresTableMarkup([{region:'TOSCANA',code:'339',name:'PISTOIA',employees_count:6,months_count:3,overtime_hours:52.5,sickness_hours:18,injury_hours:1}],coverage),
 dipendenti:ctx.overtimeEmployeesTableMarkup([{employee_name:'Mario Rossi',employee_role:'SA',level:'4',months_count:3,overtime_hours:7,sickness_hours:1,injury_hours:0}],coverage),
 piani:ctx.actionPlanTableMarkup([{plan_id:'P1',store_id:'S1',plan_date:'2026-09-01',period_year:2026,period_fraction:'H2',premise:'Premessa',objectives:[{objective_text:'CR',status:'ACHIEVED'}],objective_count:1,achieved_count:1}],{storeColumn:true,storeLabel:()=>'339 · PISTOIA'})};
for(const [nome,html] of Object.entries(prodotti)){
 assert.ok(html.includes('mobile-cards'),`${nome}: manca la classe delle schede`);
 assert.equal((html.match(/class="[^"]*mobile-title/g)||[]).length,1,`${nome}: serve una sola cella titolo per riga`);
 const celle=[...html.matchAll(/<td\b[^>]*>/g)].map(m=>m[0]);
 const senza=celle.filter(c=>!c.includes('data-label=')&&!c.includes('actions-cell'));
 assert.equal(senza.length,0,`${nome}: celle senza etichetta → ${senza.join(' ')}`);
 const etichette=celle.map(c=>(c.match(/data-label="([^"]*)"/)||[])[1]).filter(Boolean);
 assert.equal(new Set(etichette).size,etichette.length,`${nome}: due celle con la stessa etichetta nella stessa scheda`);
}
/* La cella delle azioni non ha etichetta ma deve restare in fondo alla scheda. */
assert.ok(prodotti.piani.includes('class="actions-cell"'),'I pulsanti vanno raccolti in una cella propria');
assert.ok(blocco.includes('td.actions-cell{order:1'),'La cella delle azioni va in fondo alla scheda');

/* Striscia dei mesi: allargando le colonne per rendere leggibili le etichette,
   la striscia esce dal contenitore. Due condizioni la tengono dentro: il
   contenitore deve scorrere, e l'etichetta, che e' in posizione assoluta, deve
   avere un riferimento nella propria colonna. Senza, si allarga tutta la pagina. */
const strip=css.slice(css.indexOf('striscia dei mesi sul telefono'));
assert.ok(/#rmHolidayMonthlyChart,#holidayMonthlyChart\{[^}]*overflow-x:auto/.test(strip),
 'Il contenitore della striscia deve scorrere');
assert.ok(strip.includes('.holiday-month-col{position:relative}'),
 'Le etichette dei mesi devono essere ancorate alla propria colonna');
assert.ok(/\.holiday-month-bars\{[^}]*minmax\(46px/.test(strip),'Le colonne devono reggere un'+String.fromCharCode(39)+'etichetta da 11px');

console.log('PASS: tabelle dense rese a schede sul telefono, con titolo ed etichette su ogni cella');
