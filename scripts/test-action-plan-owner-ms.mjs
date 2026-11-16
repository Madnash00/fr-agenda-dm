/* Maschera ACTION PLAN · MS percentuale e referente a livello di piano.
   La MS e' una quota di mercato: era dichiarata e mostrata in euro, quindi il
   grafico d'impatto e il PDF leggevano "€ 1" dove si intendeva "1,0%".
   L'OWNER si chiedeva su ogni obiettivo: ora si indica una volta sola
   sull'Action Plan e le azioni lo ereditano.
   Le funzioni di formattazione vengono eseguite davvero. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync('assets/js/app.js','utf8'),css=readFileSync('assets/css/app.css','utf8'),
      guided=readFileSync('assets/js/action-plan-guided.js','utf8');
const righe=app.split('\n');
const estrai=(testo,inizio)=>{const r=testo.split('\n'),i=r.findIndex(x=>x.startsWith(inizio));
 assert.notEqual(i,-1,`Manca ${inizio}`);
 for(let n=1;n<=60;n++){const f=r.slice(i,i+n).join('\n');try{new vm.Script(f);return f}catch{}}
 assert.fail(`Frammento non compilabile: ${inizio}`)};

// --- la MS si legge in percentuale ---
const ctx={Number,String,Math,console};
vm.createContext(ctx);
for(const n of ['function apYtdPercent(','function apYtdEuro('])vm.runInContext(estrai(app,n),ctx);
assert.equal(ctx.apYtdPercent(0.3),'0,3%','La variazione MS si esprime in percentuale');
assert.equal(ctx.apYtdPercent(-1.25),'-1,3%','Anche negativa, con un decimale');
assert.ok(!ctx.apYtdPercent(2).includes('€'),'E senza simbolo di valuta');
assert.ok(ctx.apYtdEuro(1000).includes('€'),'Gli altri KPI restano in euro');

const def=estrai(app,'const AP_YTD_DEF=');
assert.ok(def.includes("['ms','MS AC','%']"),'MS AC va dichiarata come percentuale');
assert.ok(!/\['ms','MS AC','€'\]/.test(def),'Non deve restare dichiarata in euro');
/* Gli altri importi non devono essere stati convertiti per errore. */
for(const atteso of ["['sales','INCASSATO AC','€']","['asp','ASP AC','€']","['atv','ATV AC','€']"])
 assert.ok(def.includes(atteso),`${atteso} deve restare in euro`);

const grafico=estrai(app,'function apYtdImpactChart(');
assert.ok(grafico.includes("unit==='ms'?apYtdPercent(value):apYtdEuro(value)"),
 'Nel grafico la colonna MS va formattata in percentuale, le altre in euro');
assert.ok(app.includes("const v=unit==='ms'?num(val,1)+'%':num(val/1000,1)+'k';"),
 'Anche nel PDF la MS va in percentuale');
assert.ok(app.includes("'Impatto vs AP (k EUR); MS: %'"),'E la didascalia del PDF deve dirlo');
assert.ok(!app.includes("MS: EUR"),'Nessun residuo della vecchia unita');

// --- OWNER: una volta sola, sull Action Plan ---
assert.ok(app.includes('id="apOwner"'),'La schermata iniziale deve avere il campo OWNER');
assert.ok(/id="apOwner"[^>]*placeholder="Nome - Cognome"/.test(app),
 'Con il formato richiesto come suggerimento');
assert.ok(/id="apOwner"[^>]*value="\$\{esc\(plan\?\.owner\|\|''\)\}"/.test(app),
 'E deve rileggere il valore salvato, o si svuota a ogni riapertura');
const salvataggio=estrai(app,'async function saveActionPlanForm(');
assert.ok(salvataggio.includes("owner:$('#apOwner')?.value.trim()||''"),
 'Il referente va inviato al backend insieme al piano');
assert.ok(salvataggio.indexOf("owner:$('#apOwner')")<salvataggio.indexOf('is_draft:!!isDraft'),
 'Deve stare nel payload del piano, non altrove');

// --- la schermata 3/3 dell obiettivo non chiede piu il referente ---
assert.ok(!guided.includes('apGuidedOwner'),'Il campo OWNER va eliminato dalla schermata 3/3');
assert.ok(!/Compila OWNER/.test(guided),'E non deve piu essere richiesto nella validazione');
assert.ok(guided.includes("if(!data.timing||!data.nextSteps)"),
 'TIMING e NEXT STEPS restano obbligatori');
/* Le azioni conservano un referente: quello del piano. Senza, il PDF
   stamperebbe un trattino al posto del nome. */
assert.ok(guided.includes('owner:apPlanOwner()'),'Le azioni ereditano il referente del piano');
assert.ok(guided.includes("document.getElementById('apOwner')"),
 'Che viene letto dal campo della schermata iniziale');

// --- le due domande guida ---
assert.ok(guided.includes('Ogni quanto monitoriamo questo obiettivo?'),
 'TIMING deve portare la propria domanda');
assert.ok(guided.includes('Quali sono i prossimi passi che mi possono portare al raggiungimento dell\\\'obiettivo?'),
 'E NEXT STEPS la propria');
/* Devono stare dentro la label del campo giusto, non in fondo alla schermata. */
const schermata=guided.slice(guided.indexOf('3. MONITORAGGIO'));
const posTiming=schermata.indexOf('Ogni quanto monitoriamo'),posSelect=schermata.indexOf('id="apGuidedTiming"');
assert.ok(posTiming>=0&&posSelect>posTiming,'La domanda su TIMING precede il suo campo');
const posNext=schermata.indexOf('Quali sono i prossimi passi'),posArea=schermata.indexOf('id="apGuidedNextSteps"');
assert.ok(posNext>=0&&posArea>posNext,'La domanda su NEXT STEPS precede il suo campo');
assert.ok(schermata.includes('class="ap-guided-hint"'),'Le domande devono avere la classe che le rende piccole');
assert.ok(css.includes('.ap-guided-hint{'),'Manca lo stile delle domande guida');
assert.ok(/\.ap-guided-hint\{[^}]*font-size:10px/.test(css),'Le domande vanno in piccolo, come richiesto');

console.log('PASS: MS in percentuale, OWNER sul piano e domande guida su TIMING e NEXT STEPS');
