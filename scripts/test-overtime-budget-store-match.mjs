/* Due verifiche sul CHECK STRAORDINARI:
   1. il nome del punto vendita viene ricondotto all'anagrafica solo quando e' univoco;
   2. il messaggio di budget non calcolabile dice quale presupposto manca. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
const src=readFileSync('assets/js/personnel-hours.js','utf8');
const app=readFileSync('assets/js/app.js','utf8');

// --- 1. canonicalStoreName, estratta ed eseguita con un'anagrafica di prova ---
const start=src.indexOf('const backendStoreKey=');
const end=src.indexOf('\n }',src.indexOf('function canonicalStoreName('))+3;
const norm=v=>String(v??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLocaleUpperCase('it-IT').replace(/\s+/g,' ').trim();
const make=stores=>new Function('norm','window',src.slice(start,end)+';return canonicalStoreName;')(norm,{app:{stores}});

const registry=[{name:'RAVENNA',code:'',active:1},{name:'PISTOIA C.C.',code:'33900',active:1},
 {name:'PARMA EUROSIA C.C.',code:'',active:1},{name:'PARMA EUROTORRI C.C.',code:'',active:1}];
const fn=make(registry);
// Il caso reale: nelle ore lavorate il negozio si chiama RAVENNA C.C.ESP, negli straordinari RAVENNA.
assert.strictEqual(fn('RAVENNA C.C.ESP',''),'RAVENNA','Il nome esteso deve ricondursi al negozio in anagrafica');
// Corrispondenza gia' esatta: nessuna riscrittura.
assert.strictEqual(fn('PISTOIA C.C.','33900'),'PISTOIA C.C.','Un nome gia allineato non va toccato');
// Prefisso ambiguo fra due negozi: si lascia il nome originale e il backend lo segnala.
assert.strictEqual(fn('PARMA C.C.',''),'PARMA C.C.','Un prefisso ambiguo non deve essere assegnato a indovinare');
// Negozio estraneo al distretto: invariato.
assert.strictEqual(fn('TORINO LINGOTTO C.C.',''),'TORINO LINGOTTO C.C.','Un negozio non in anagrafica resta invariato');
// Senza anagrafica caricata non si riscrive nulla.
assert.strictEqual(make([])('RAVENNA C.C.ESP',''),'RAVENNA C.C.ESP','Senza anagrafica il nome resta quello del file');
// Il codice negozio resta prioritario: se combacia, nessuna riscrittura per nome.
assert.strictEqual(fn('QUALSIASI NOME','33900'),'QUALSIASI NOME','Con codice corrispondente il nome non va riscritto');
assert.ok(src.includes('store_name:canonicalStoreName(r.store_name,r.store_code)'),'La canonicalizzazione deve essere applicata alle righe inviate');

// --- 2. messaggi diagnostici del budget ---
const mstart=app.indexOf('function overtimeBudgetUnavailable(p){');
const msg=new Function('MONTHS','esc',app.slice(mstart,app.indexOf('\n}',mstart)+2)+';return overtimeBudgetUnavailable;')
 (['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'],String);
assert.match(msg(null),/IMPORTA ORE PERSONALE/,'Senza import deve indicare il file mancante');
assert.match(msg({available:true,work_hours:0,coverage_complete:true,budget_pct:3,overtime_hours:10}),/nome del punto vendita/,
 'Negozio senza ore: deve indicare il probabile disallineamento del nome');
assert.match(msg({available:true,work_hours:100,coverage_complete:false,months_missing:[3,4],budget_pct:3,overtime_hours:1}),/Marzo, Aprile/,
 'Copertura incompleta: deve elencare i mesi mancanti');
assert.match(msg({available:true,work_hours:100,coverage_complete:true,budget_pct:0,overtime_hours:1}),/PARAMETRI/,
 'Budget non configurato: deve rimandare ai parametri');
assert.ok(!/mancano ore lavorate YTD o mesi di straordinari confrontabili/.test(app),'Il messaggio generico non deve sopravvivere');
assert.ok(app.includes('store-budget-incidence'),'Overtime budget must render the incidence chart');
console.log('PASS: aggancio negozio nelle ore lavorate e diagnosi del budget straordinari');