/* Il rapporto sui negozi non associati deve distinguere i negozi del proprio
   distretto, da allineare, da quelli di altri distretti, che non riguardano
   chi importa. Un elenco di nomi senza spiegazione non e' azionabile. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
const app=readFileSync('assets/js/app.js','utf8');
const start=app.indexOf('function agendaStoreMatchKey(');
const end=app.indexOf('\n}',app.indexOf('function agendaUnmatchedStoreReport('))+2;
const build=stores=>new Function('app','esc',app.slice(start,end)+';return agendaUnmatchedStoreReport;')
 ({stores},s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])));

const fn=build([{name:'RAVENNA ESP',code:'',active:1},{name:'PISTOIA C.C.',code:'',active:1},
 {name:'PARMA EUROSIA C.C.',code:'',active:1},{name:'PARMA EUROTORRI C.C.',code:'',active:1}]);

// Caso reale: 1 negozio del distretto piu' 24 di altri distretti.
const altrui=['MOLFETTA C.C.','BENEVENTO BUONVENTO C.C.','NAPOLI VOMERO'];
const r=fn(['RAVENNA',...altrui]);
assert.equal(r.mine,1,'Il negozio del distretto va isolato');
assert.equal(r.altri,3,'Gli altri vanno elencati a parte');
assert.ok(r.html.includes('in anagrafica risulta «RAVENNA ESP»'),'Deve riportare il nome esatto in anagrafica');
assert.ok(r.html.includes('Negozi del tuo distretto da allineare (1)'),'Deve contare i negozi da correggere');
assert.ok(r.html.includes('altri distretti (3)'),'Deve chiarire che gli altri non riguardano chi importa');
assert.ok(r.html.indexOf('da allineare')<r.html.indexOf('altri distretti'),'Prima cio che richiede un intervento');

// Ambiguita nel proprio distretto: va dichiarata, non risolta a caso.
const amb=fn(['PARMA']);
assert.equal(amb.mine,1,'Anche l ambiguita riguarda il distretto');
assert.ok(/piu' negozi del distretto \(PARMA EUROSIA C\.C\., PARMA EUROTORRI C\.C\.\)/.test(amb.html),'Deve nominare i negozi in conflitto');

// Nessun negozio non associato: nessun rapporto.
const vuoto=fn([]);
assert.equal(vuoto.html,'','Senza negozi non associati non si mostra nulla');
assert.equal(build([])(['RAVENNA']).altri,1,'Senza anagrafica caricata tutto finisce fra gli altri distretti');

// I due import devono usare lo stesso rapporto.
assert.ok(app.includes("showModal('Import straordinari',`<p><strong>Import completato.</strong></p>${rep.html}`)"),'Straordinari deve usare il rapporto');
assert.ok(app.includes("showModal('Import ferie consolidate',`<p><strong>Import completato.</strong></p>${rep.html}`)"),'Ferie deve usare il rapporto');
assert.ok(!app.includes('non sono stati associati in modo univoco'),'Il messaggio generico non deve sopravvivere');
console.log('PASS: rapporto sui negozi non associati distinto per distretto');
