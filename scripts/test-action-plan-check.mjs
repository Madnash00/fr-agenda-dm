/* CHECK · sessioni di monitoraggio dell'obiettivo.
   Il TIMING a cadenza fissa non diceva quando si e' guardato davvero il
   risultato. Al suo posto si fissano sessioni datate: per ogni azione un
   semaforo, e il rosso apre una nuova azione che entra nell'elenco e viene
   monitorata dalla sessione successiva.
   Non nasce un secondo archivio: ogni riga diventa un checkpoint della propria
   azione, la struttura che PDF e backend conoscono gia'. Le funzioni di
   conversione sono il punto delicato e vengono eseguite davvero. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const guided=readFileSync('assets/js/action-plan-guided.js','utf8'),css=readFileSync('assets/css/app.css','utf8');
const estrai=inizio=>{const r=guided.split('\n'),i=r.findIndex(x=>x.startsWith(inizio));
 assert.notEqual(i,-1,`Manca ${inizio}`);
 for(let n=1;n<=60;n++){const f=r.slice(i,i+n).join('\n');try{new vm.Script(f);return f}catch{}}
 assert.fail(`Frammento non compilabile: ${inizio}`)};

const ctx={String,Number,Array,Object,Map,console,esc:s=>String(s==null?'':s)};
vm.createContext(ctx);
for(const n of ['const AP_CHECK_LIGHTS=','function apChecksFromTasks(','function apChecksAllActions(',
 'function apChecksToCheckpoints(','function apCheckValidate(','function apCheckDateLabel(','function apCheckHtml('])
 vm.runInContext(estrai(n),ctx);

// --- il semaforo ha i tre colori richiesti, con il significato richiesto ---
assert.deepEqual(vm.runInContext('AP_CHECK_LIGHTS',ctx).map(x=>[x[0],x[2]]),
 [['GREEN','Consolida'],['YELLOW','Intensifica'],['RED','Inserisci nuova azione']],
 'I tre esiti devono essere verde/consolida, giallo/intensifica, rosso/nuova azione');

// --- una sessione diventa un checkpoint per ciascuna azione ---
const checks=[{date:'2026-11-20',note:'Prima verifica',saved:true,rows:[
 {action:'Accoglienza',light:'GREEN',newAction:''},
 {action:'Camerino',light:'RED',newAction:'Secondo capo in prova'}]}];
assert.deepEqual(ctx.apChecksToCheckpoints('Accoglienza',checks,[]),
 [{date:'2026-11-20',note:'Prima verifica',contingency:'GREEN'}],
 'Ogni azione riceve il proprio checkpoint, con data e nota della sessione');
assert.deepEqual(ctx.apChecksToCheckpoints('Camerino',checks,[])[0].contingency,'RED',
 'E il proprio semaforo, non quello di un altra azione');
/* Un azione mai toccata da una sessione non deve perdere la propria storia. */
const storici=[{task:'Vetrina',checkpoints:[{date:'2026-10-01',note:'vecchio',contingency:'YELLOW'}]}];
assert.deepEqual(ctx.apChecksToCheckpoints('Vetrina',checks,storici),storici[0].checkpoints,
 'I checkpoint preesistenti di un azione non monitorata restano');
assert.deepEqual(ctx.apChecksToCheckpoints('Accoglienza',[{date:'2026-11-20',saved:false,rows:[
 {action:'Accoglienza',light:'GREEN'}]}],[]),[],
 'Una sessione non salvata non deve finire nell obiettivo');
assert.deepEqual(ctx.apChecksToCheckpoints('Accoglienza',[{date:'',saved:true,rows:[
 {action:'Accoglienza',light:'GREEN'}]}],[]),[],'Nemmeno una sessione senza data');

// --- il rosso genera l azione da monitorare la volta dopo ---
const base=['Accoglienza','Camerino'];
assert.deepEqual(ctx.apChecksAllActions(base,checks),
 ['Accoglienza','Camerino','Secondo capo in prova'],
 'L azione nata dal rosso entra nell elenco monitorato');
assert.deepEqual(ctx.apChecksAllActions(base,[{...checks[0],saved:false}]),base,
 'Finche la sessione non e salvata, la nuova azione non compare');
assert.deepEqual(ctx.apChecksAllActions(base,[{date:'x',saved:true,rows:[
 {action:'Accoglienza',light:'GREEN',newAction:'ignorata'}]}]),base,
 'Un testo lasciato in un campo poi passato a verde non deve creare azioni');
assert.deepEqual(ctx.apChecksAllActions(base,[{date:'x',saved:true,rows:[
 {action:'Accoglienza',light:'RED',newAction:'Camerino'}]}]),base,
 'Una nuova azione gia presente non va ripetuta');

// --- riaprendo un obiettivo salvato, le sessioni si ricompongono ---
const tasks=[
 {task:'Accoglienza',checkpoints:[{date:'2026-11-20',note:'Prima verifica',contingency:'GREEN'},
                                  {date:'2026-12-04',note:'Seconda',contingency:'YELLOW'}]},
 {task:'Camerino',checkpoints:[{date:'2026-11-20',note:'Prima verifica',contingency:'RED'}]}];
const ricomposte=ctx.apChecksFromTasks(tasks);
assert.equal(ricomposte.length,2,'Due date distinte, due sessioni');
assert.deepEqual(ricomposte.map(c=>c.date),['2026-11-20','2026-12-04'],'In ordine di data');
assert.equal(ricomposte[0].rows.length,2,'La prima sessione raccoglie entrambe le azioni');
assert.equal(ricomposte[0].note,'Prima verifica','La nota della sessione viene recuperata');
assert.ok(ricomposte.every(c=>c.saved),'Le sessioni gia memorizzate risultano salvate');
assert.deepEqual(ctx.apChecksFromTasks(undefined),[],'Un obiettivo nuovo non ha sessioni');

// --- cosa impedisce di salvare un CHECK ---
assert.ok(/data/i.test(ctx.apCheckValidate({date:'',rows:[{action:'a',light:'GREEN'}]})),
 'Senza data il CHECK non si salva');
assert.ok(/semaforo/i.test(ctx.apCheckValidate({date:'2026-11-20',rows:[{action:'a',light:''}]})),
 'Ogni azione deve avere un semaforo');
assert.ok(/rosso/i.test(ctx.apCheckValidate({date:'2026-11-20',rows:[{action:'a',light:'RED',newAction:''}]})),
 'Il rosso senza nuova azione non si salva: resterebbe senza seguito');
assert.equal(ctx.apCheckValidate({date:'2026-11-20',rows:[{action:'a',light:'RED',newAction:'Nuova'}]}),'',
 'Compilato, il CHECK si salva');

// --- la scheda del CHECK ---
const html=ctx.apCheckHtml({date:'2026-11-20',note:'',rows:[{action:'Accoglienza',light:'RED',newAction:'Nuova'}]},0,['Accoglienza']);
assert.ok(html.includes('DATA MONITORAGGIO')&&html.includes('type="date"'),
 'La data si inserisce da calendario o a mano');
assert.ok(html.includes('>Accoglienza<'),'Le azioni scelte prima vanno elencate');
for(const etichetta of ['Consolida','Intensifica','Inserisci nuova azione'])
 assert.ok(html.includes(etichetta),`Manca l esito ${etichetta}`);
assert.ok(html.includes('NOTE')&&html.includes('data-ap-check-note'),'Sotto le azioni serve il campo NOTE');
assert.ok(html.indexOf('data-ap-check-note')>html.indexOf('>Accoglienza<'),'Che sta sotto le azioni, non sopra');
assert.ok(html.includes('SALVA CHECK'),'Serve il comando di salvataggio');
/* Col rosso il campo della nuova azione e aperto; negli altri casi e chiuso. */
assert.ok(/class="ap-check-new"[^>]*>NUOVA AZIONE/.test(html),'Col rosso il campo nuova azione deve essere visibile');
const verde=ctx.apCheckHtml({date:'',note:'',rows:[{action:'A',light:'GREEN'}]},0,['A']);
assert.ok(verde.includes('class="ap-check-new hidden"'),'Senza rosso il campo nuova azione resta chiuso');
const salvato=ctx.apCheckHtml({date:'2026-11-20',saved:true,rows:[{action:'A',light:'GREEN'}]},0,['A']);
assert.ok(salvato.includes('20/11/2026'),'Una sessione salvata mostra la data in forma leggibile');
assert.ok(salvato.includes('data-ap-check-edit'),'E si puo riaprire: le sessioni vengono riviste dalla SM');

// --- aggancio e stile ---
assert.ok(guided.includes('id="apAddCheckBtn"'),'Serve il tasto AGGIUNGI CHECK');
assert.ok(estrai('function apChecksHtml(').includes('+ AGGIUNGI CHECK'),'Con la sua etichetta');
const passo3=guided.slice(guided.indexOf('3. MONITORAGGIO'));
assert.ok(passo3.includes('apChecksHtml(data)'),'La sezione CHECK deve stare nella scheda obiettivo');
/* L'aggancio va cercato nella chiamata, non nella definizione della funzione,
   che comparirebbe comunque piu avanti nel file e farebbe passare il controllo. */
const chiamata=passo3.slice(0,passo3.indexOf('function apChecksWire('));
assert.ok(chiamata.includes('apChecksWire(editor,data,draw);'),
 'La sezione va agganciata dentro il disegno del passo 3: senza, i tasti esisterebbero senza fare nulla');
assert.ok(guided.includes("if(data.checks.some(c=>!c.saved))"),
 'Un CHECK lasciato aperto non deve sparire in silenzio alla conferma dell obiettivo');
assert.ok(guided.includes("timing_monitoraggio:''"),'Il TIMING non viene piu scritto sulle azioni');
assert.ok(css.includes('.ap-check-light{'),'Manca lo stile del semaforo');
for(const c of ['.ap-check-green.selected','.ap-check-yellow.selected','.ap-check-red.selected'])
 assert.ok(css.includes(c),`Manca il colore ${c}`);
assert.ok(/max-width:720px\)\{[\s\S]*ap-check-light\{[^}]*min-height:36px/.test(css),
 'Sul telefono i semafori devono restare toccabili');

console.log('PASS: CHECK con semaforo per azione, nuova azione dal rosso e note di sessione');
