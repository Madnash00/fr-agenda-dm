/* Negozio abbinato a piu' DM.
   Lo stesso codice LOGIN identifica un solo negozio: i dati sono comuni ai DM
   che lo hanno abbinato, e l'interfaccia deve dirlo in due punti, perche'
   altrimenti si vedono dati altrui senza sapere di chi sono: l'icona nella
   tabella negozi e il nome del DM sul passaggio del cursore nel calendario.
   Le funzioni vengono eseguite davvero: e' il testo prodotto che conta. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync('assets/js/app.js','utf8'),css=readFileSync('assets/css/app.css','utf8');
const righe=app.split('\n');
const estrai=inizio=>{const i=righe.findIndex(x=>x.startsWith(inizio));assert.notEqual(i,-1,`Manca ${inizio}`);
 for(let n=1;n<=60;n++){const f=righe.slice(i,i+n).join('\n');try{new vm.Script(f);return f}catch{}}
 assert.fail(`Frammento non compilabile: ${inizio}`)};

const ctx={String,Array,Object,Number,console,calendarPendingLabel:()=>''};
vm.createContext(ctx);
for(const n of ['function esc(','function storeSharedBadge(','function eventHoverTitle('])
 vm.runInContext(estrai(n),ctx);

// --- l'icona compare solo dove serve ---
assert.equal(ctx.storeSharedBadge({linked_dms:[]}),'','Un negozio senza abbinamenti non mostra nulla');
assert.equal(ctx.storeSharedBadge({linked_dms:[{display_name:'Lorenzo Riccomi'}]}),'',
 'Nemmeno con un solo DM: l icona segnala la condivisione, non l esistenza del DM');
assert.equal(ctx.storeSharedBadge({}),'','Un negozio senza il campo non deve rompere la tabella');
const badge=ctx.storeSharedBadge({linked_dms:[{display_name:'Lorenzo Riccomi'},{display_name:'Samanta Icario'}]});
assert.ok(badge.includes('multi-dm-badge'),'Con due DM compare l icona');
assert.ok(/title="[^"]*DM abbinati: Lorenzo Riccomi, Samanta Icario/.test(badge),
 'Il titolo deve elencare i nomi: e cio che si legge passandoci sopra');
assert.ok(badge.includes('aria-label'),'E deve essere leggibile anche senza cursore');
assert.ok(badge.includes('>2<'),'Il numero degli abbinati va mostrato');
/* Un nome con le virgolette non deve uscire dall attributo. */
assert.ok(!ctx.storeSharedBadge({linked_dms:[{display_name:'A"B'},{display_name:'C'}]}).includes('A"B'),
 'I nomi vanno passati da esc: una virgoletta chiuderebbe l attributo a meta');

// --- la colonna esiste davvero nella tabella ---
const tabella=estrai('function renderStoresRegions(){');
assert.ok(tabella.includes('<th>Multi-DM</th>'),'Serve l intestazione della nuova colonna');
assert.ok(tabella.includes('storeSharedBadge(st)'),'E la cella corrispondente su ogni riga');
/* Una colonna in piu' nell intestazione senza la cella sposterebbe tutte le righe. */
const intestazioni=(tabella.match(/<th>/g)||[]).length;
const celle=(tabella.match(/<td>|<td /g)||[]).length;
assert.equal(intestazioni,celle,`Intestazioni (${intestazioni}) e celle (${celle}) devono corrispondere`);
assert.ok(tabella.indexOf('storeSharedBadge(st)')>tabella.indexOf('edit-store-page'),
 'L icona va dopo l ultima colonna, come richiesto');

// --- di chi e' questa SV ---
assert.equal(ctx.eventHoverTitle({event_type:'STORE_VISIT',note:'Focus camerino',dm_name:'Samanta Icario'},'Store Visit'),
 'Store Visit · Focus camerino · DM: Samanta Icario',
 'Il titolo deve portare tipo, nota e DM');
assert.equal(ctx.eventHoverTitle({event_type:'SM_HOLIDAY',note:'',dm_name:'Lorenzo Riccomi'},'Ferie SM'),
 'Ferie SM · DM: Lorenzo Riccomi','Senza nota resta il tipo e il DM');
assert.equal(ctx.eventHoverTitle({note:'Call'},'Nota'),'Nota · Call',
 'Se il backend non manda il nome del DM non deve comparire un DM vuoto');
assert.equal(ctx.eventHoverTitle({note:'Nota'},'Nota'),'Nota','Una nota uguale all etichetta non si ripete');
ctx.calendarPendingLabel=()=>'IN SOSPESO';
assert.ok(ctx.eventHoverTitle({note:'x',dm_name:'Y'},'Nota').endsWith('IN SOSPESO'),
 'Lo stato in sospeso resta in coda, come prima');
ctx.calendarPendingLabel=()=>'';

/* Il titolo deve stare sulle pastiglie vere, non solo esistere come funzione:
   la SV, la nota e le FERIE sono i tre casi citati. */
for(const ancora of ['data-track="NOTE" title="${esc(eventHoverTitle(filtered[0],\'Nota\'))}"',
 'data-track="${track}" title="${esc(eventHoverTitle(e,m.label))}"'])
 assert.ok(app.includes(ancora),`La pastiglia deve portare il titolo: ${ancora.slice(0,40)}`);
assert.equal((app.match(/title="\$\{esc\(eventHoverTitle\(e,m\.label\)\)\}"/g)||[]).length,2,
 'Sia gli eventi sia le FERIE devono dire a quale DM si riferiscono');

// --- i nomi dei DM devono arrivare fino all interfaccia ---
assert.equal((app.match(/linked_dms:Array\.isArray\(st\.linked_dms\)\?st\.linked_dms:\[\]/g)||[]).length,2,
 'Entrambe le mappature del negozio devono conservare i DM abbinati, o la tabella li perde');

// --- creando un negozio gia esistente, dirlo ---
const creazione=estrai('function addStore(){');
assert.ok(creazione.includes('created.linked_to_existing'),
 'Alla creazione va riconosciuto il caso del negozio gia abbinato');
assert.ok(creazione.includes('created.message'),
 'E va mostrato il messaggio del backend, che nomina il DM a cui e gia abbinato');
assert.ok(creazione.indexOf('created.linked_to_existing')<creazione.indexOf('login_adjusted'),
 'Il caso dell abbinamento va controllato prima, altrimenti vince il vecchio avviso');

// --- stile ---
assert.ok(css.includes('.multi-dm-badge{'),'Manca lo stile dell icona');
assert.ok(/\.multi-dm-badge\{[^}]*cursor:help/.test(css),'Il cursore deve segnalare che si puo passarci sopra');

console.log('PASS: negozio condiviso fra piu DM, con icona in anagrafica e DM sul calendario');
