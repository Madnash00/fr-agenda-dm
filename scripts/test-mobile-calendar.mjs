/* Calendario sul telefono. La griglia giorni per negozi non entra in 390px: per
   il DM diventa un elenco per giorno. Il costruttore dell'elenco viene eseguito
   davvero, perche' il punto delicato e' quali eventi finiscono in quale giorno. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync('assets/js/app.js','utf8'),css=readFileSync('assets/css/app.css','utf8'),html=readFileSync('index.html','utf8');
const righe=app.split('\n');
const estrai=inizio=>{const k=righe.findIndex(x=>x.startsWith(inizio));assert.notEqual(k,-1,`Manca ${inizio}`);
 for(let n=1;n<=60;n++){const f=righe.slice(k,k+n).join('\n');try{new vm.Script(f);return f}catch{}}
 assert.fail(`Frammento non compilabile: ${inizio}`)};

// --- l'elenco, eseguito ---
const ctx={Number,String,Math,Array,JSON,Object,Date,console,
 DAYS:['DOM','LUN','MAR','MER','GIO','VEN','SAB'],
 typeMeta:{STORE_VISIT:{abbr:'SV',cls:'sv',label:'Store Visit'},SM_HOLIDAY:{abbr:'F',cls:'f',label:'Ferie SM'},NOTE:{abbr:'N',cls:'note',label:'Nota'}},
 calendarPendingLabel:()=>'', calendarLocked:false,
 calendarFilteredStores:()=>[{id:'S1',name:'PISTOIA'},{id:'S2',name:'RAVENNA'}],
 isoDate:d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
 fmtDate:d=>d.toLocaleDateString('it-IT')};
vm.createContext(ctx);
for(const n of ['function esc(','function eventDateKey(','function isoWeekInfo(','function mobileAgendaEntry(','function mobileAgendaDmMarkup('])
 vm.runInContext(estrai(n),ctx);

const giorni=[];for(let k=0;k<7;k++){const d=new Date(2026,10,16);d.setDate(d.getDate()+k);giorni.push(d)}
const ds=ctx.isoDate(giorni[0]);
const idx=new Map([
 [`S1|${ds}`,[{event_type:'STORE_VISIT',note:'Visita con focus camerino'}]],
 [`S2|${ds}`,[{event_type:'SM_HOLIDAY',note:''}]],
 [`DM|${ds}`,[{event_type:'NOTE',note:'Call distretto'}]]]);
const out=ctx.mobileAgendaDmMarkup(giorni,idx);

assert.ok(out.includes('agenda-week'),'L elenco si raggruppa per settimana');
assert.equal((out.match(/class="agenda-day/g)||[]).length,7,'Una riga per ogni giorno della settimana');
assert.equal((out.match(/data-mobile-entry/g)||[]).length,3,'Ogni evento del giorno deve comparire una volta sola');
/* Un evento senza negozio e' del distretto: senza questa riga sparirebbe dall elenco,
   perche' nella griglia vive in una colonna propria. */
assert.ok(out.includes('>Distretto<'),'Gli eventi di distretto devono restare visibili');
assert.ok(out.includes('>PISTOIA<')&&out.includes('>RAVENNA<'),'Ogni voce deve dire a quale negozio si riferisce');
assert.ok(out.includes('Visita con focus camerino'),'La nota va mostrata per esteso');
assert.ok(out.includes('>Ferie SM<'),'Senza nota si mostra il tipo di evento');
assert.ok(/data-mobile-entry data-store="S1" data-date="2026-11-16"/.test(out),
 'La voce deve portare negozio e data: e cio che apre la cella giusta al tocco');
assert.ok(/data-mobile-entry data-store="" /.test(out),'La voce di distretto non ha negozio');
assert.equal((out.match(/class="muted">—/g)||[]).length,6,'I giorni senza eventi restano visibili con un trattino');
assert.ok(ctx.mobileAgendaDmMarkup([],new Map()).includes('empty'),'Senza date si mostra un messaggio, non il vuoto');

/* Inserire dal telefono: ogni giorno ha il proprio comando, che non deve
   comparire quando il calendario e' in sola consultazione. */
assert.equal((out.match(/data-mobile-add/g)||[]).length,7,'Ogni giorno deve avere il comando di inserimento');
assert.ok(/data-mobile-add data-date="2026-11-16"/.test(out),'Il comando deve portare la data del giorno');
ctx.calendarLocked=true;
assert.equal((ctx.mobileAgendaDmMarkup(giorni,idx).match(/data-mobile-add/g)||[]).length,0,
 'Col calendario bloccato il comando di inserimento non deve comparire');
ctx.calendarLocked=false;

const picker=estrai('function mobileAgendaOpenPicker(');
assert.ok(picker.includes("openCell(id,ds)")&&picker.includes("openCell(null,ds,null,'NOTE')"),
 'Scelto il destinatario si apre lo stesso editor del desktop');
/* Senza traccia, openCell per il distretto non offre il modulo di inserimento:
   la traccia NOTE e' cio che apre il modulo INFO VARIE con i suoi tre tipi. */
assert.ok(picker.includes('INFO VARIE'),'Deve essere possibile inserire anche sul distretto');
assert.ok(picker.includes('calendarFilteredStores()'),'La scelta segue i negozi filtrati, come la griglia');
const delegaAdd=estrai('function ensureMobileAgendaClickDelegation()');
assert.ok(delegaAdd.includes("closest?.('[data-mobile-add]')")&&delegaAdd.includes('mobileAgendaOpenPicker(piu.dataset.date)'),
 'Il comando deve aprire la scelta del destinatario');

// --- il tocco apre la cella ---
const delega=estrai('function ensureMobileAgendaClickDelegation()');
assert.ok(delega.includes("closest?.('[data-mobile-entry]')")&&delega.includes('openCell(voce.dataset.store,voce.dataset.date)'),
 'Toccando una voce si deve aprire la cella corrispondente');
assert.ok(delega.includes("currentUser?.role==='STORE'"),'Il comportamento del profilo NEGOZIO non deve cambiare');

// --- attivazione e ritorno alla griglia ---
assert.ok(app.includes("const elencoTelefono=currentUser.role==='ADMIN'||currentUser.role==='STORE';"),
 'L elenco si attiva per i profili DM e NEGOZIO');
/* La vecchia classe store-mobile non veniva mai aggiunta: se ricompare e' un
   secondo meccanismo per lo stesso scopo, e uno dei due restera' morto. */
assert.ok(!app.includes('store-mobile'),'store-mobile e superata da phone-agenda');
assert.ok(app.includes("classList.toggle('phone-agenda',elencoTelefono)"),'Serve la classe che accende l elenco');
assert.ok(html.includes('id="phoneViewToggle"'),'Serve il pulsante per tornare alla griglia');
assert.ok(app.includes("document.body.classList.toggle('phone-grid')"),'Il pulsante deve commutare la vista');

const i=css.indexOf('/* --------- calendario sul telefono');
assert.notEqual(i,-1,'Manca il blocco di stile del calendario telefono');
const blocco=css.slice(i);
for(const regola of ['.calendar-card.phone-agenda{display:none}','.mobile-agenda.phone-agenda{display:block}',
 'body.phone-grid .calendar-card.phone-agenda{display:block}','body.phone-grid .mobile-agenda.phone-agenda{display:none}'])
 assert.ok(blocco.includes(regola),`Manca ${regola}`);
assert.ok(css.includes('.phone-view-toggle{display:none}'),'Fuori dal telefono il pulsante non deve comparire');
assert.ok(blocco.includes('.mobile-agenda .agenda-entry{')&&/min-height:44px/.test(blocco.slice(blocco.indexOf('.agenda-entry{'))),
 'Le voci si toccano: servono 44px');
/* Calendario DM e Overview DM restano griglie, ma il testo non puo restare a 8px. */
assert.ok(blocco.includes(':is(#page-rmcalendar,#page-dmoverview) .rm-calendar-table{font-size:11px}'),
 'Le griglie di supervisione vanno rese leggibili sul telefono');

console.log('PASS: calendario DM a elenco sul telefono, con ritorno alla griglia');
