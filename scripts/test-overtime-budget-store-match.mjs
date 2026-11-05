/* Due verifiche sul CHECK STRAORDINARI:
   1. il nome del punto vendita viene ricondotto all'anagrafica solo quando e' univoco;
   2. il messaggio di budget non calcolabile dice quale presupposto manca. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
const src=readFileSync('assets/js/personnel-hours.js','utf8');
const app=readFileSync('assets/js/app.js','utf8');

// --- 1. l'import delle ore usa il risolutore condiviso (logica provata in
//        test-store-name-resolution.mjs: una sola implementazione per i tre import) ---
assert.ok(src.includes('window.agendaResolveStoreName(name,code)'),'Le ore lavorate devono usare il risolutore condiviso');
assert.ok(src.includes('store_name:canonicalStoreName(r.store_name,r.store_code)'),'La riconduzione deve essere applicata alle righe inviate');
assert.ok(!/function canonicalStoreName\s*\(/.test(src),'Non deve esistere una seconda implementazione divergente');

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