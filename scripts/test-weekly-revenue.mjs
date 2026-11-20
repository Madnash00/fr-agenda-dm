/* Fatturato settimanale: lettura del file, scelta dell'anno, invio al backend
   e celle sotto le settimane del Planning ferie (DM e NEGOZIO).
   Struttura del file aziendale riprodotta con dati finti.
   Con FATTURATO_JSON=<file> si esegue il parser su matrici esportate dal file vero. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync('assets/js/app.js','utf8'),html=readFileSync('index.html','utf8'),api=readFileSync('assets/js/cloud-api.js','utf8'),css=readFileSync('assets/css/app.css','utf8');
const estrai=inizio=>{const r=app.split('\n'),i=r.findIndex(x=>x.startsWith(inizio));assert.notEqual(i,-1,`Manca ${inizio}`);
 for(let n=1;n<=60;n++){const f=r.slice(i,i+n).join('\n');try{new vm.Script(f);return f}catch{}}assert.fail(inizio)};
const fogli={};
const ctx={Number,String,Math,Object,Array,Set,Map,JSON,console,isFinite,
 XLSX:{utils:{sheet_to_json:sh=>fogli[sh]}}};
vm.createContext(ctx);
for(const n of ['function normalizeHolidayImportHeader(','function weeklyRevenueHasData(','function weeklyRevenueValue(','function weeklyRevenueEuro(','function weeklyRevenueDelta(','function weeklyRevenueCell(','function weeklyRevenueParseWorkbook('])vm.runInContext(estrai(n),ctx);
vm.runInContext("var esc=s=>String(s)",ctx);

// --- file come quello aziendale: confronto, due fogli per settimana, formato lungo ---
const wb=(nomi)=>({SheetNames:nomi,Sheets:Object.fromEntries(nomi.map(n=>[n,n]))});
fogli['Confronto 2026 vs 2025']=[['FIORELLA RUBINO — confronto'],['Codice CICS','Nome negozio','Tipo gestione','Totale 2026 (W01-W47)']];
fogli['2026 settimane']=[['FIORELLA RUBINO — Fatturato lordo IVA per settimana — Anno Miroglio 2026 (29/12/2025 → 20/11/2026, W47 parziale)'],['Codice CICS','Nome negozio','Tipo gestione','TOTALE','W01','W02','W47'],['03563','NEG PROVA','PRO',3,1,2,0.5]];
fogli['2025 settimane']=[['Anno Miroglio 2025'],['Codice CICS','Nome negozio','Tipo gestione','TOTALE','W01','W02'],['03563','NEG PROVA','PRO',3,1,2]];
fogli['Dati (formato lungo)']=[['Anno','Codice CICS','Nome negozio','Tipo gestione','Settimana','Fatturato lordo IVA'],
 [2025,'03563','NEG PROVA','OCE',1,800],[2025,'03563','NEG PROVA','OCE',2,1500],[2026,'03563','NEG PROVA','OCE',1,1000],[2026,'03563','NEG PROVA','OCE',2,1200.5],[2026,'03563','NEG PROVA','OCE',47,300],
 [2026,'45025','ALTRO','PRO',1,'2.500,50'],[2026,'45025','ALTRO','PRO',99,5],[2026,'','VUOTO','PRO',1,5]];
const p=ctx.weeklyRevenueParseWorkbook(wb(['Confronto 2026 vs 2025','2026 settimane','2025 settimane','Dati (formato lungo)']));
assert.equal(p.format,'lungo','Con il foglio in formato lungo si usa quello: contiene anno e settimana di ogni valore');
assert.deepEqual(p.years,[2026,2025],'Anni trovati, il piu recente per primo (proposto come AC)');
assert.equal(p.partial[2026],47,'La W47 parziale si legge dal titolo del foglio');
assert.equal(p.stores,2);
const r=k=>p.rows.find(x=>x.code+'|'+x.year===k);
assert.equal(r('03563|2026').weeks[2],1200.5);assert.equal(r('03563|2025').weeks[1],800);
assert.equal(r('45025|2026').weeks[1],2500.5,'Importi in formato italiano');
assert.ok(!r('45025|2026').weeks[99],'Settimane impossibili scartate');
assert.equal(r('03563|2026').code,'03563','Il codice resta quello del file: lo normalizza il backend');

// --- solo fogli per settimana, uno dei quali senza anno ---
const s=ctx.weeklyRevenueParseWorkbook(wb(['2026 settimane','2025 settimane']));
assert.equal(s.format,'settimane');assert.deepEqual(s.years,[2026,2025]);assert.equal(s.rows.find(x=>x.year===2026).weeks[47],0.5);
fogli['Foglio1']=[['Fatturato'],['Codice CICS','Nome','W01','W02'],['111','X',10,20]];
const n=ctx.weeklyRevenueParseWorkbook(wb(['Foglio1']));
assert.ok(n.noYear&&n.rows[0].year==='?','Senza anno nel file, l anno lo sceglie chi importa');

// --- celle del planning ---
const rev={years:{'2026':{weeks:{'1':1000,'2':1200.5,'3':900,'47':300},partial_week:47},'2025':{weeks:{'1':800,'2':1500,'3':900,'47':0}}}};
assert.ok(ctx.weeklyRevenueHasData(rev)&&!ctx.weeklyRevenueHasData({years:{}})&&!ctx.weeklyRevenueHasData(null));
const c1=ctx.weeklyRevenueCell(rev,2026,1,7);
assert.ok(c1.html.includes('1000 €')&&c1.html.includes('+200 €')&&c1.html.includes('+25,0%')&&c1.html.includes('week-rev-delta pos'),'AC, delta in euro e in percentuale, in verde se positivo');
const c2=ctx.weeklyRevenueCell(rev,2026,2,7);
assert.ok(c2.html.includes('−300 €')&&c2.html.includes('−20,0%')&&c2.html.includes('neg'),'Negativo in rosso');
assert.ok(ctx.weeklyRevenueCell(rev,2026,3,7).html.includes('+0,0%')===false&&ctx.weeklyRevenueCell(rev,2026,3,7).html.includes('0,0%'),'Pari: zero senza segno');
const c47=ctx.weeklyRevenueCell(rev,2026,47,7);
assert.ok(c47.partial&&c47.html.includes('parz.')&&c47.title.includes('settimana parziale'),'Settimana parziale segnalata');
assert.ok(c47.delta.pct===null&&!c47.html.includes('%'),'AP a zero: niente percentuale, che non avrebbe senso');
assert.ok(ctx.weeklyRevenueCell(rev,2026,5,7)===null,'Settimana senza dati: cella invariata');
assert.ok(ctx.weeklyRevenueCell({years:{'2026':{weeks:{'9':50}}}},2026,9,7).html.includes('AP n.d.'),'Senza AP lo dice');
{const f=ctx.weeklyRevenueCell({years:{'2025':{weeks:{'48':15340}}}},2026,48,7);assert.ok(f.html.includes('AC n.d.')&&f.html.includes('AP 15.340 €')&&!f.html.includes('AP n.d.'),'Settimana futura: AC non ancora disponibile, mostra l AP come riferimento');}
const corta=ctx.weeklyRevenueCell({years:{'2026':{weeks:{'1':25300}},'2025':{weeks:{'1':20000}}}},2026,1,3);
assert.ok(corta.html.includes('25,3k €'),'Settimana spezzata a inizio o fine anno: formato compatto');
assert.ok(c1.title.includes('AP 2025 800 €'),'Il dettaglio completo resta nel tooltip');

// --- integrazione in pagina ---
assert.ok(/id="holidayPeriodReload"[^>]*>Ricarica<\/button>\s*<button id="importWeeklyRevenueBtn"[^>]*>Importa fatturato<\/button>/.test(html),'Pulsante in Periodi Negozi');
const grid=estrai('function renderHolidayGrid(');
assert.ok(grid.includes('weeklyRevenueCell(rev,w.year,w.week,x.span)')&&grid.includes("' with-revenue':''"),'Il planning (DM e NEGOZIO usano la stessa griglia) mostra il fatturato sotto ogni settimana');
const modale=estrai('function openWeeklyRevenueImportModal(');
assert.ok(modale.includes('A quale anno si riferiscono le settimane di fatturato (AC)?')&&modale.includes('<select id="weeklyRevenueYear">'),'Il pulsante chiede l anno e lo fa scegliere');
const invio=estrai('async function commitWeeklyRevenueImport(');
assert.ok(invio.includes(".filter(r=>r.year===year||r.year===year-1)")&&invio.includes("request('importStoreWeeklyRevenue',{year,rows,filename:st.filename,partial})"),'Si inviano solo AC e AP dell anno scelto');
assert.ok(/importStoreWeeklyRevenue:\['holiday','audit'\]/.test(api),'Dopo l import il planning si rilegge dal centrale');
assert.ok(/\.with-revenue thead tr:nth-child\(3\) th\{top:73px\}/.test(css),'Le intestazioni fisse restano allineate con la riga piu alta');

if(process.env.FATTURATO_JSON){const J=JSON.parse(readFileSync(process.env.FATTURATO_JSON,'utf8'));Object.assign(fogli,J.sheets);const v=ctx.weeklyRevenueParseWorkbook({SheetNames:J.names,Sheets:Object.fromEntries(J.names.map(x=>[x,x]))});
 console.log('FILE VERO:',v.format,'anni',v.years,'parziale',JSON.stringify(v.partial),'negozi',v.stores,'righe',v.rows.length);
 for(const k of ['35877|2026','35877|2025','31258|2026'])console.log(' ',k,JSON.stringify(Object.entries(v.rows.find(x=>x.code+'|'+x.year===k)?.weeks||{}).slice(0,3)),'... W47',v.rows.find(x=>x.code+'|'+x.year===k)?.weeks[47]);}
console.log('PASS: fatturato settimanale, lettura file, scelta anno e celle del planning');
