/* REPORT FERIE e CHECK STRAORDINARI: il profilo RM legge gli stessi file dei DM e
   deve mostrarli come li mostra il DM. Il test esegue i veri costruttori di markup:
   confrontare il sorgente non proverebbe che le due viste coincidano. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const src=readFileSync('assets/js/app.js','utf8').split('\n');
/* Le funzioni stanno quasi tutte su una riga sola, alcune no: si prendono le righe
   successive finche' il frammento non compila, cosi l'estrazione non dipende dallo stile. */
const riga=inizio=>{
 const i=src.findIndex(x=>x.startsWith(inizio));
 assert.notEqual(i,-1,`Manca ${inizio}`);
 for(let n=1;n<=40;n++){
  const frammento=src.slice(i,i+n).join('\n');
  try{new vm.Script(frammento);return frammento}catch{}
 }
 assert.fail(`Frammento non compilabile: ${inizio}`);
};
const ctx={Number,String,Math,Array,JSON,Object,console,currentUser:{role:'ADMIN'},overtimeCheckCache:null};
vm.createContext(ctx);
for(const n of ['function esc(','function overtimeNum(','function overtimeFmt(','function overtimeCoverageState(',
 'function overtimeMetricDisplay(','function overtimeDetailCells(','const OVERTIME_METRIC_HEAD=',
 'function overtimeStoresTableMarkup(','function overtimeEmployeesTableMarkup(',
 'function holidayConsolidatedNum(','function holidayConsolidatedDisposal(','function holidayConsolidatedFmtPct('])
 vm.runInContext(riga(n),ctx);

// --- straordinari: stessa tabella per DM e RM, la colonna DM e' l'unica differenza ---
const coverage={month_count:3,sickness_months:2,injury_months:0};
const negozi=[{region:'TOSCANA',code:'339',name:'PISTOIA',employees_count:5,months_count:3,overtime_hours:12.5,sickness_hours:4,injury_hours:0},
 {region:'EMILIA',code:'412',name:'RAVENNA',employees_count:3,months_count:2,overtime_hours:3,sickness_hours:1,injury_hours:0}];
const dipendenti=[{employee_name:'Mario Rossi',employee_role:'SA',level:'4',months_count:3,overtime_hours:7.25,sickness_hours:1.5,injury_hours:0}];

const dmNegozi=ctx.overtimeStoresTableMarkup(negozi,coverage);
const rmNegozi=ctx.overtimeStoresTableMarkup(negozi.map(x=>({...x,dm_name:'Lorenzo Riccomi'})),coverage,{dmColumn:true});
assert.ok(dmNegozi.includes('class="data-table overtime-table"'),'La tabella DM deve usare lo stile overtime-table');
assert.equal(rmNegozi.replace(/<th>DM<\/th>/,'').replace(/<td>Lorenzo Riccomi<\/td>/g,''),dmNegozi,
 'La tabella negozi del profilo RM deve coincidere con quella del DM, a meno della colonna DM');
const dmDip=ctx.overtimeEmployeesTableMarkup(dipendenti,coverage);
const rmDip=ctx.overtimeEmployeesTableMarkup(dipendenti.map(x=>({...x,dm_name:'Lorenzo Riccomi'})),coverage,{dmColumn:true});
assert.equal(rmDip.replace(/<th>DM<\/th>/,'').replace(/<td>Lorenzo Riccomi<\/td>/g,''),dmDip,
 'La tabella dipendenti del profilo RM deve coincidere con quella del DM');
assert.ok(!ctx.overtimeEmployeesTableMarkup(dipendenti,coverage,{showLevel:false}).includes('<th>Livello</th>'),
 'Il profilo NEGOZIO non deve vedere la colonna Livello');

/* Copertura: malattia presente in 2 mesi su 3 va segnata, infortunio assente va N/D.
   Senza questo il profilo RM mostrerebbe zero al posto di dato mancante. */
assert.ok(dmNegozi.includes('*'),'Una copertura parziale va segnalata con asterisco');
assert.equal((dmNegozi.match(/N\/D/g)||[]).length,negozi.length,'Un dato assente va mostrato come N/D, non come zero');
assert.equal(ctx.overtimeCoverageState('sick',coverage).available,true,'La copertura deve leggersi dal dato passato');
assert.equal(ctx.overtimeCoverageState('injury',coverage).available,false,'Senza mesi coperti il dato non e disponibile');

// --- ferie consolidate: una sola percentuale di smaltimento, quella del profilo DM ---
const rmBlocco=src.filter(l=>l.includes('rmHolidayConsolidatedStoreRanking')||l.includes('rmHolidayConsolidatedStores')).join('\n');
assert.ok(rmBlocco.includes('ranks(cStores,false)')&&rmBlocco.includes('ranks(cRegions,true)'),
 'Le classifiche del profilo RM devono usare le righe con lo smaltimento ricalcolato');
assert.ok(rmBlocco.includes('sorted(cStores)'),'La tabella del profilo RM deve ordinare sulle stesse righe che mostra');
assert.ok(!/sorted\(stores\)[^\n]*store-disposal-badge/.test(rmBlocco),
 'La tabella non deve piu ordinare sul valore aggregato dal backend');
const withPct=src.find(l=>l.includes('cStores=stores.map(withPct)'));
assert.ok(withPct&&withPct.includes('holidayConsolidatedDisposal(x.entitlement_year_end,x.residual_ac_hours)'),
 'Lo smaltimento del profilo RM deve usare la formula sul residuo, come il profilo DM');

/* La formula e' la stessa del DM: a parita di riga deve dare lo stesso numero. */
const riga1={entitlement_year_end:100,residual_ac_hours:25,used_hours:60};
assert.equal(ctx.holidayConsolidatedDisposal(riga1.entitlement_year_end,riga1.residual_ac_hours),75,
 'Lo smaltimento si calcola sul residuo, non sul goduto');
assert.notEqual(riga1.used_hours/riga1.entitlement_year_end*100,75,
 'La formula precedente dava un valore diverso: e il motivo della divergenza fra le due viste');
assert.equal(ctx.holidayConsolidatedFmtPct(null),'—','Senza spettanza la percentuale resta non disponibile');

console.log('PASS: REPORT FERIE e CHECK STRAORDINARI resi allo stesso modo nei profili DM e RM');
