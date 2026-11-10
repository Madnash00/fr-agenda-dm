/* OVERVIEW DM: stessa vista del CALENDARIO DM del profilo RM, resa disponibile al
   profilo DM. Una sola implementazione per due pagine: gli id si scelgono dal
   profilo di chi guarda, cosi' le due viste non possono divergere. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
const app=readFileSync('assets/js/app.js','utf8');
const html=readFileSync('index.html','utf8');

// --- voce di menu al posto richiesto ---
const nav=html.slice(html.indexOf('data-nav-section="agenda"'),html.indexOf('data-nav-section="store-holidays"'));
const voci=[...nav.matchAll(/data-page="([a-z]+)"/g)].map(m=>m[1]);
assert.deepEqual(voci,['calendar','agenda','dmoverview','report'],'Overview DM va sotto Agenda, dentro AGENDA DM');
assert.ok(/data-page="dmoverview">Overview DM</.test(nav),'La voce deve chiamarsi Overview DM');
assert.ok(/class="nav-btn nav-sub-btn admin-only" data-page="dmoverview"/.test(nav),'La voce e riservata al profilo DM');

// --- la pagina replica quella RM, con gli stessi elementi ---
const sezione=t=>{const i=html.indexOf(`id="page-${t}"`);const j=html.indexOf('<section ',i);return html.slice(i,j>i?j:html.length)};
const rm=sezione('rmcalendar'),dm=sezione('dmoverview');
assert.ok(dm.includes('class="page admin-only hidden"'),'La pagina e riservata al profilo DM');
/* Differiscono per i soli id, il titolo della scheda e la classe di profilo: il
   resto, comandi e struttura, deve coincidere carattere per carattere. */
const struttura=s=>s.replace(/id="[^"]*"/g,'id').replace(/<h3>[^<]*<\/h3>/,'<h3/>')
 .replace(/class="page (?:rm-only|admin-only) hidden"/,'class="page RUOLO hidden"').replace(/\s+/g,' ').trim();
assert.equal(struttura(dm),struttura(rm),'Le due pagine devono avere la stessa struttura');
for(const id of ['dmOvPrev','dmOvToday','dmOvNext','dmOvView','dmOvDate','dmOvDm','dmOvFitBtn','reloadDmOverviewBtn','dmOvKpis','dmOvRangeLabel','dmOvGrid'])
 assert.ok(html.includes(`id="${id}"`),`Manca il comando ${id}`);
assert.ok(dm.includes('SOLA CONSULTAZIONE'),'La vista resta dichiarata in sola consultazione');

// --- una sola implementazione, nessun riferimento rimasto a id fissi ---
assert.ok(app.includes('const RM_CAL_IDS=')&&app.includes('function rmCalEl(k)'),'Gli id devono essere scelti dal profilo');
for(const id of ['rmCalendarGrid','rmCalendarKpis','rmCalendarRangeLabel','rmCalendarDm'])
 assert.ok(!app.includes(`$('#${id}')`),`${id} non deve piu essere cercato direttamente`);
assert.ok(app.includes("Object.values(RM_CAL_IDS).forEach"),'I comandi di entrambe le pagine devono essere collegati');
assert.ok(!/function renderDmOverview|function loadDmOverview/.test(app),'Non deve nascere una seconda implementazione');

// --- instradamento e intestazioni ---
assert.ok(app.includes("page==='rmcalendar'||page==='dmoverview')loadRMCalendar()"),'La nuova pagina deve caricare i dati');
assert.ok(app.includes("dmoverview:['AGENDA DM','Overview DM']"),'Serve il titolo di pagina, altrimenti la navigazione fallisce');
assert.ok(/PAGE_NAV_GROUP=\{[^}]*dmoverview:'agenda'/.test(app),'La pagina deve appartenere al gruppo AGENDA DM');

// --- accesso: il DM puo caricare, il NEGOZIO no ---
const loader=app.slice(app.indexOf('async function loadRMCalendar('),app.indexOf('async function loadRMCalendar(')+200);
assert.ok(loader.includes("currentUser.role!=='ADMIN'&&!isRetailManager()"),'Il caricamento deve valere per DM e RM');
assert.ok(!loader.includes('if(!isRetailManager())return'),'Il vincolo di solo RM non deve restare');
console.log('PASS: Overview DM replica il Calendario DM con una sola implementazione');
