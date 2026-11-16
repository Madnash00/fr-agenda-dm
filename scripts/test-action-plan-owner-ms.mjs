/* Maschera ACTION PLAN · unita della MS e referente a livello di piano.
   La MS si digita come quota di mercato, in percentuale, ma nel grafico
   IMPATTO ECONOMICO e' uno scostamento in euro: le colonne si confrontano
   fra loro e devono avere la stessa unita.
   L'OWNER si chiedeva su ogni obiettivo: ora si indica una volta sola
   sull'Action Plan e le azioni lo ereditano. */
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

// --- la MS: percentuale in ingresso, scostamento in euro nei grafici ---
const ctx={Number,String,Math,console};
vm.createContext(ctx);
vm.runInContext(estrai(app,'function apYtdEuro('),ctx);
assert.ok(ctx.apYtdEuro(1000).includes('\u20ac'),'Gli importi restano in euro');

const def=estrai(app,'const AP_YTD_DEF=');
/* Il campo che si compila e una quota di mercato: si digita in percentuale. */
assert.ok(def.includes("['ms','MS AC','%']"),'MS AC si inserisce come percentuale');
for(const atteso of ["['sales','INCASSATO AC','\u20ac']","['asp','ASP AC','\u20ac']","['atv','ATV AC','\u20ac']"])
 assert.ok(def.includes(atteso),`${atteso} deve restare in euro`);

/* Nel grafico IMPATTO ECONOMICO, invece, la MS e uno scostamento in euro:
   le colonne si confrontano fra loro e devono quindi avere la stessa unita. */
const grafico=estrai(app,'function apYtdImpactChart(');
assert.ok(grafico.includes("amount=(value>0?'+':'')+apYtdEuro(value);"),
 'Nel grafico d impatto anche la MS si legge in euro');
assert.ok(!grafico.includes('apYtdPercent'),'Nessuna formattazione percentuale nel grafico d impatto');
assert.ok(app.includes("const v=unit==='ms'?num(val,0):num(val/1000,1)+'k';"),
 'Anche nel PDF la colonna MS resta un importo');
assert.ok(app.includes("'Impatto vs AP (k EUR); MS: EUR'"),'E la didascalia del PDF lo dichiara');
assert.ok(!app.includes('function apYtdPercent('),
 'Il formattatore percentuale non serve piu: lasciarlo sarebbe codice morto');

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
assert.ok(guided.includes("if(!data.nextSteps)"),'NEXT STEPS resta obbligatorio');
/* Le azioni conservano un referente: quello del piano. Senza, il PDF
   stamperebbe un trattino al posto del nome. */
assert.ok(guided.includes('owner:apPlanOwner()'),'Le azioni ereditano il referente del piano');
assert.ok(guided.includes("document.getElementById('apOwner')"),
 'Che viene letto dal campo della schermata iniziale');

// --- le due domande guida ---
/* La domanda su TIMING e caduta insieme al campo. */
assert.ok(!guided.includes('apGuidedTiming'),'Il campo TIMING va eliminato dalla scheda obiettivo');
assert.ok(guided.includes('Quali sono i prossimi passi che mi possono portare al raggiungimento dell\\\'obiettivo?'),
 'E NEXT STEPS la propria');
/* Devono stare dentro la label del campo giusto, non in fondo alla schermata. */
const schermata=guided.slice(guided.indexOf('3. MONITORAGGIO'));
const posNext=schermata.indexOf('Quali sono i prossimi passi'),posArea=schermata.indexOf('id="apGuidedNextSteps"');
assert.ok(posNext>=0&&posArea>posNext,'La domanda su NEXT STEPS precede il suo campo');
assert.ok(schermata.includes('class="ap-guided-hint"'),'Le domande devono avere la classe che le rende piccole');
assert.ok(css.includes('.ap-guided-hint{'),'Manca lo stile delle domande guida');
assert.ok(/\.ap-guided-hint\{[^}]*font-size:10px/.test(css),'Le domande vanno in piccolo, come richiesto');

console.log('PASS: MS in euro nei grafici, OWNER sul piano, TIMING rimosso e domanda su NEXT STEPS');
