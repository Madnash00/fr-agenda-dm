/* Esecuzione reale del modulo ORE LAVORATE.
   I controlli statici non intercettano un identificatore mancante usato dentro una
   funzione: il modulo viene quindi eseguito davvero, con un foglio di prova, fino a
   produrre le righe da inviare. Un riferimento non definito (es. "round is not
   defined") fa fallire questo test invece di arrivare all'utente. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const src=readFileSync('assets/js/personnel-hours.js','utf8');
const body=src.slice(src.indexOf("'use strict';")+13,src.lastIndexOf('})();'));

// Foglio DB YTD minimo: due venditrici, due mesi, un negozio.
const matrix=[
 ['MAGA','DESC','COMM','NOME','DATA','PVNA','OREL','INSEPREV','AM','NOMEAM','DM','NOMEDM','STATUS','TIGE','SOTI','MESE'],
 ['41980','RAVENNA C.C.ESP','','GIUSTI ELISABETTA',260103,'',6,'','','','','','APERTO','','','Gennaio'],
 ['41980','RAVENNA C.C.ESP','','GIUSTI ELISABETTA',260210,'',4.5,'','','','','','APERTO','','','Febbraio'],
 ['41980','RAVENNA C.C.ESP','','PIOLI KIMBERLEY',260104,'',5,'','','','','','APERTO','','','Gennaio'],
 ['41980','RAVENNA C.C.ESP','','TOTALE',260104,'',99,'','','','','','APERTO','','','Gennaio'],
 ['41980','RAVENNA C.C.ESP','','CHIUSA SILVIA',260105,'',8,'','','','','','CHIUSO','','','Gennaio'],
];
const el=()=>({addEventListener(){},click(){},querySelectorAll:()=>[],classList:{add(){},remove(){},toggle(){}},files:[],value:'',set innerHTML(v){},set textContent(v){}});
const sandbox={
 console,assert,Math,Number,String,Object,Array,Boolean,JSON,Date,Set,Map,Error,RegExp,isFinite,isNaN,parseInt,parseFloat,Promise,
 btoa:s=>Buffer.from(s,'binary').toString('base64'),
 document:{querySelector:()=>el(),querySelectorAll:()=>[]},
 XLSX:{read:()=>({Sheets:{'DB YTD':{}},SheetNames:['DB YTD'],Workbook:{Names:[]}}),utils:{sheet_to_json:()=>matrix}},
 ensureXlsx:async()=>{},esc:String,toast(){},showModal(){},renderOvertimeCheck(){},
 overtimeCheckCache:null,currentUser:{role:'ADMIN'},app:{stores:[{name:'RAVENNA',code:'',active:1}]},
 loadOvertimeCheck:async()=>{},
};
/* Il risolutore vive in app.js: qui si usa quello vero, cosi' il test verifica
   anche che le due parti restino collegate. */
const appSrc=readFileSync('assets/js/app.js','utf8');
const rs=appSrc.indexOf('function agendaStoreMatchKey(');
const re=appSrc.indexOf('\n}',appSrc.indexOf('function agendaResolveStoreName('))+2;
sandbox.agendaResolveStoreName=new Function('app',appSrc.slice(rs,re)+';return agendaResolveStoreName;')({stores:[{name:'RAVENNA',code:'',active:1}]});
sandbox.window=sandbox; sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(body+'\n;globalThis.__test={parseWorkbook,encodeFile,round,canonicalStoreName};',sandbox);
const api=sandbox.__test;
assert.equal(typeof api.round,'function','round deve essere definita');
assert.equal(typeof api.encodeFile,'function','encodeFile deve essere definita');
assert.equal(typeof sandbox.agendaPersonnelBase64,'function','L\'export agendaPersonnelBase64 deve restare disponibile');

// Percorso completo: e' qui che l'assenza di round faceva fallire l'import.
const file={arrayBuffer:async()=>new Uint8Array(8).buffer,name:'Fatturato.xlsx',size:1024};
const parsed=await api.parseWorkbook(file,2026,new Set([1,2]));
assert.equal(parsed.rows.length,2,'Due venditrici attese, escluse TOTALE e la riga CHIUSO');
const giusti=parsed.rows.find(r=>r.employee_name==='GIUSTI ELISABETTA');
assert.ok(giusti,'La venditrice deve essere presente');
assert.equal(giusti.work_hours,10.5,'Le ore dei due mesi devono essere sommate e arrotondate');
assert.deepEqual(giusti.monthly_hours,{1:6,2:4.5},'Le ore vanno tenute per mese');
assert.equal(giusti.store_name,'RAVENNA','Il nome deve essere ricondotto all\'anagrafica');
assert.ok(!parsed.rows.some(r=>/TOTALE/i.test(r.employee_name)),'Le righe di totale vanno escluse');

// Mesi fuori dal perimetro degli straordinari: esclusi, non sommati.
const ridotto=await api.parseWorkbook(file,2026,new Set([1]));
assert.equal(ridotto.rows.find(r=>r.employee_name==='GIUSTI ELISABETTA').work_hours,6,'Solo il mese confrontabile');
assert.deepEqual(ridotto.monthsExcluded,[2],'Il mese escluso va segnalato');

// La codifica del file non deve regredire.
assert.equal(api.encodeFile(new Uint8Array([72,105])),'SGk=','encodeFile deve restituire base64');
assert.throws(()=>api.encodeFile({length:18500001}),/18 MB/,'Il limite di dimensione deve restare');
console.log('PASS: il modulo ORE LAVORATE si esegue e produce le righe attese');
