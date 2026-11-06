/* Esecuzione reale dei parser di FERIE e STRAORDINARI sui tracciati aziendali.
   Un controllo testuale non basta: la riconduzione del nome negozio era stata
   applicata a un solo ramo del parser straordinari, quello del tracciato
   alternativo, mentre il tracciato FR_MalStrInf continuava a inviare il nome
   grezzo. Qui i parser vengono eseguiti e si verifica cosa finisce nelle righe. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const src=readFileSync('assets/js/app.js','utf8');
const pezzo=(da,a)=>{const i=src.indexOf(da);assert.ok(i>=0,'manca: '+da);const j=src.indexOf(a,i);return src.slice(i,j>i?j:i+9000)};
const codice=[
 pezzo('function agendaStoreMatchKey(','function agendaUnmatchedStoreReport('),
 pezzo('function agendaResolveStoreName(',"if(typeof window!=='undefined')window.agendaResolveStoreName"),
 /^function normalizeHolidayImportHeader\(.*$/m.exec(src)[0],
 /^function normalizeOvertimeImportHeader\(.*$/m.exec(src)[0],
 /^function overtimeNum\(.*$/m.exec(src)[0],
 pezzo('async function parseHolidayConsolidatedWorkbook(','async function importHolidayConsolidatedFile('),
 pezzo('async function parseOvertimeWorkbook(','async function importOvertimeFile('),
].join('\n');

// Anagrafica: il negozio e' registrato con il nome esteso, il file usa quello breve.
const anagrafica=[{name:'RAVENNA ESP',code:'',active:1},{name:'PISTOIA C.C.',code:'',active:1}];
let matrice=[];
const sandbox={console,Math,Number,String,Object,Array,Boolean,JSON,Date,Set,Map,Error,RegExp,isFinite,isNaN,parseInt,parseFloat,Promise,
 app:{stores:anagrafica},ensureXlsx:async()=>{},
 XLSX:{read:()=>({Sheets:{F:{}},SheetNames:['F']}),utils:{sheet_to_json:()=>matrice}}};
sandbox.window=sandbox; sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(codice+'\n;globalThis.__p={parseHolidayConsolidatedWorkbook,parseOvertimeWorkbook,agendaResolveStoreName};',sandbox);
const P=sandbox.__p;
const file={arrayBuffer:async()=>new Uint8Array(4).buffer};

// --- STRAORDINARI, tracciato FR_MalStrInf (quello realmente importato) ---
matrice=[
 ['ANNO','MESE','BRAND','PUNTO VENDITA','RM','DM','MATRIC','DIPENDENTE','RUOLO','DATA CESS.NE',
  'STR.GEN','MAL.GEN','INF.GEN','STR.FEB','MAL.FEB','INF.FEB'],
 [2026,2,'FR','RAVENNA','','RICCOMI LORENZO','1','GIUSTI ELISABETTA','SA','',3,0,0,1.5,2,0],
 [2026,2,'FR','PISTOIA C.C.','','RICCOMI LORENZO','2','ROSSI MARIA','SA','',1,0,0,0,0,0],
];
const ot=await P.parseOvertimeWorkbook(file);
const nomiOt=[...new Set(ot.map(r=>r.store_name))].sort();
assert.deepEqual(nomiOt,['PISTOIA C.C.','RAVENNA ESP'],
 'Il tracciato FR_MalStrInf deve inviare il nome dell\'anagrafica, non quello grezzo del file');
const gen=ot.find(r=>r.store_name==='RAVENNA ESP'&&r.month===1);
assert.equal(gen.overtime_total_hours,3,'Le ore di gennaio devono essere conservate');
assert.equal(ot.find(r=>r.store_name==='RAVENNA ESP'&&r.month===2).sickness_hours,2,'Le malattie di febbraio devono essere conservate');
assert.equal(ot.filter(r=>r.store_name==='RAVENNA ESP').length,2,'Una riga per mese fino al mese dichiarato');

// --- FERIE CONSOLIDATE ---
matrice=[
 ['ANNO','MESE','BRAND','PUNTO VENDITA','Descr.ne DM','DIPENDENTE','RUOLO','LIVELLO','TOT.GODUTO',
  'RESIDUO A.C.MESE','RESIDUO A.C.F/ANNO','SPETT.31/12','RESIDUO A.P.','% SMALT.31/12','MATRIC','DATA ASS.NE','DATA CESS.NE'],
 [2026,9,'FR','RAVENNA','RICCOMI LORENZO','GIUSTI ELISABETTA','SA','3',122,10,110.12,232.12,27.5,52.56,'1','',''],
];
const fer=await P.parseHolidayConsolidatedWorkbook(file);
assert.equal(fer.length,1,'Una riga ferie attesa');
assert.equal(fer[0].store_name,'RAVENNA ESP','Anche le ferie devono inviare il nome dell\'anagrafica');
assert.equal(fer[0].entitlement_year_end,232.12,'I valori devono restare intatti');

// --- Senza anagrafica il nome resta quello del file: nessuna invenzione ---
sandbox.app.stores=[];
matrice=[
 ['ANNO','MESE','BRAND','PUNTO VENDITA','DM','DIPENDENTE','RUOLO','STR.GEN','MAL.GEN','INF.GEN'],
 [2026,1,'FR','RAVENNA','RICCOMI LORENZO','GIUSTI ELISABETTA','SA',2,0,0],
];
assert.equal((await P.parseOvertimeWorkbook(file))[0].store_name,'RAVENNA','Senza anagrafica si invia il nome del file');
console.log('PASS: entrambi i parser riconducono il nome negozio all\'anagrafica');
