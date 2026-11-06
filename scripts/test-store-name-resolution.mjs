/* Aggancio del negozio negli import: i file aziendali non usano lo stesso nome.
   Caso reale: lo stesso punto vendita e' "RAVENNA" in ferie e straordinari e
   "RAVENNA C.C.ESP" nelle ore lavorate; se l'anagrafica usa una terza variante
   l'import scarta il negozio e i dati restano fermi all'ultimo import riuscito. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
const app=readFileSync('assets/js/app.js','utf8');

const start=app.indexOf('function agendaStoreMatchKey(');
const end=app.indexOf('\n}',app.indexOf('function agendaResolveStoreName('))+2;
const build=stores=>new Function('app','window',app.slice(start,end)+';return agendaResolveStoreName;')({stores},{});
const keyOf=new Function(app.slice(start,app.indexOf('\n}',start)+2)+';return agendaStoreMatchKey;')();
/* Il contratto non e' "riscrivi sempre": e' che il nome inviato abbia la stessa
   chiave normalizzata del negozio in anagrafica, che e' cio' che il backend confronta. */
const agganciaA=(fn,source,registry,msg)=>assert.strictEqual(keyOf(fn(source,'')),keyOf(registry),msg);

// --- l'anagrafica usa il nome esteso, i file HR quello breve ---
const esteso=build([{name:'RAVENNA ESP',code:'',active:1},{name:'PISTOIA C.C.',code:'33900',active:1}]);
assert.strictEqual(esteso('RAVENNA',''),'RAVENNA ESP','Ferie e straordinari devono agganciare il nome esteso in anagrafica');
agganciaA(esteso,'RAVENNA C.C.ESP','RAVENNA ESP','Le ore lavorate devono agganciare lo stesso negozio');

// --- l'anagrafica usa il nome breve, le ore lavorate quello esteso ---
const breve=build([{name:'RAVENNA',code:'',active:1},{name:'PISTOIA C.C.',code:'33900',active:1}]);
agganciaA(breve,'RAVENNA C.C.ESP','RAVENNA','Il nome esteso deve ricondursi a quello breve in anagrafica');
agganciaA(esteso,'RAVENNA','RAVENNA ESP','Il nome breve deve agganciare il negozio esteso');
assert.strictEqual(breve('RAVENNA',''),'RAVENNA','Un nome gia allineato non va riscritto');

// --- nessuna assegnazione a indovinare ---
const parma=build([{name:'PARMA EUROSIA C.C.',code:'',active:1},{name:'PARMA EUROTORRI C.C.',code:'',active:1}]);
assert.strictEqual(parma('PARMA C.C.',''),'PARMA C.C.','Un prefisso che combacia con due negozi resta invariato');
assert.strictEqual(parma('PARMA EUROSIA C.C.',''),'PARMA EUROSIA C.C.','La corrispondenza esatta resta intatta');
assert.strictEqual(parma('TORINO LINGOTTO C.C.',''),'TORINO LINGOTTO C.C.','Un negozio estraneo al distretto resta invariato');
assert.strictEqual(parma('MILANO',''),'MILANO','Senza prefisso in comune non si riscrive');
assert.strictEqual(build([])('RAVENNA',''),'RAVENNA','Senza anagrafica caricata non si riscrive nulla');

// --- il codice negozio resta prioritario ---
assert.strictEqual(esteso('NOME DIVERSO','33900'),'NOME DIVERSO','Con codice corrispondente il nome non va toccato');
// --- iniziale diversa: nessun aggancio ---
assert.strictEqual(esteso('RAV',''),'RAV','Un troncone troppo corto non deve agganciare');

// --- i tre import devono usare la stessa regola ---
assert.ok(app.includes("store_name:agendaResolveStoreName(val(r,'PUNTO VENDITA'))"),'Import ferie deve ricondurre il nome');
assert.ok(app.includes("store_name:agendaResolveStoreName(store)"),'Import straordinari deve ricondurre il nome');
assert.ok(app.includes('window.agendaResolveStoreName=agendaResolveStoreName'),'Il risolutore deve essere condiviso');
assert.ok(readFileSync('assets/js/personnel-hours.js','utf8').includes('window.agendaResolveStoreName(name,code)'),'Import ore lavorate deve usare il risolutore condiviso');
console.log('PASS: aggancio del negozio coerente fra ferie, straordinari e ore lavorate');

/* Varianti reali osservate nei file aziendali: parole in piu' o in meno sulla
   stessa radice. L'aggancio deve reggere senza rinominare i negozi a mano. */
const varianti=build([{name:'RAVENNA ESP',code:'',active:1},{name:'FORLI LA PUNTA C.C.',code:'',active:1},
 {name:'ANCONA CC CONERO',code:'',active:1},{name:'MODENA G. EMILIA',code:'',active:1}]);
agganciaA(varianti,'RAVENNA','RAVENNA ESP','Nome del file piu' + ' corto della variante in anagrafica');
agganciaA(varianti,'RAVENNA C.C.ESP','RAVENNA ESP','Nome del file con sigle in piu');
agganciaA(varianti,'FORLI','FORLI LA PUNTA C.C.','Radice sola verso nome esteso');
agganciaA(varianti,'ANCONA CC IL CONERO.','ANCONA CC CONERO','Articoli e punteggiatura ignorati');
agganciaA(varianti,'MODENA G. EMILIA','MODENA G. EMILIA','Corrispondenza gia esatta');
/* Token fuori ordine: stessa radice, parole contenute. */
const fuoriOrdine=build([{name:'RAVENNA C.C. ESP',code:'',active:1}]);
agganciaA(fuoriOrdine,'RAVENNA ESP C.C.','RAVENNA C.C. ESP','Ordine diverso delle parole');
/* L'ambiguita' resta protetta anche con la regola piu' larga. */
const ambiguo=build([{name:'PARMA EUROSIA C.C.',code:'',active:1},{name:'PARMA EUROTORRI C.C.',code:'',active:1}]);
assert.strictEqual(ambiguo('PARMA',''),'PARMA','Due negozi con la stessa radice restano ambigui');
assert.strictEqual(ambiguo('PARMA C.C.',''),'PARMA C.C.','Nessuna scelta arbitraria fra i due');
/* Radice diversa: nessun aggancio, anche se una parola coincide. */
const radice=build([{name:'MODENA PORTALI C.C.',code:'',active:1}]);
assert.strictEqual(radice('REGGIO PORTALI C.C.',''),'REGGIO PORTALI C.C.','La radice deve coincidere');
console.log('PASS: varianti di nome agganciate, ambiguita preservate');
