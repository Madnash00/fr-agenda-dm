/* FERIE DM · planning ferie dei District Manager.
   Le giornate di ferie di un DM sono gli eventi FERIE del suo calendario: la
   pagina le legge e le scrive tramite il backend. Qui si eseguono le funzioni
   vere della pagina e della maschera FERIE del calendario, con dati finti:
   nessun nome reale, nessuna ora reale. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync('assets/js/app.js','utf8'),fer=readFileSync('assets/js/ferie-dm.js','utf8');
const html=readFileSync('index.html','utf8'),css=readFileSync('assets/css/app.css','utf8');
const estrai=(testo,inizio)=>{const r=testo.split('\n'),i=r.findIndex(x=>x.startsWith(inizio));
 assert.notEqual(i,-1,`Manca ${inizio}`);
 for(let n=1;n<=80;n++){const f=r.slice(i,i+n).join('\n');try{new vm.Script(f);return f}catch{}}
 assert.fail(`Frammento non compilabile: ${inizio}`)};

/* Contesto: gli helper di app.js che la pagina usa, eseguiti davvero. */
const host={},profilo={rm:true,adm:false};
const nodo=()=>({innerHTML:'',textContent:'',className:'',value:'',classList:{toggle(){},add(){},remove(){}},querySelectorAll:()=>[]});
const ctx={Number,String,Math,Array,Object,Map,Set,Date,JSON,console,isNaN,
 DAYS:['DOM','LUN','MAR','MER','GIO','VEN','SAB'],
 MONTHS:['GENNAIO','FEBBRAIO','MARZO','APRILE','MAGGIO','GIUGNO','LUGLIO','AGOSTO','SETTEMBRE','OTTOBRE','NOVEMBRE','DICEMBRE'],
 $:sel=>host[sel]||(host[sel]=nodo()),toast:()=>{},currentUser:{role:'ADMIN'},isRetailManager:()=>profilo.rm,isSuperAdmin:()=>profilo.adm,setTimeout,clearTimeout,Promise,Intl};
vm.createContext(ctx);
for(const n of ['function esc(','function addDays(','function isoDate(','function parseDate(','function fmtDate(','function isoWeekInfo(',
 'const IT_FIXED_HOLIDAYS=','const itEasterCache=','function itEasterSunday(','function itHolidayName(',
 'function holidayHours(','function holidayHoursFmt(','function holidayPctClass(','function holidayYearDates(','function holidayRuns(',
 'function ferieHoursLabel(','function ferieHoursFieldMarkup(','function ferieHoursRead(','function mondayOf(','function isoMonday(',
 'function holidayPlanningAuditFormatValue(','function holidayPlanningAuditPlanDate(','function holidayPlanningAuditActionYear(','function holidayPlanningAuditInYear(',
 'function holidayPlanningAuditWeekKey(','function holidayPlanningAuditMonthKey(','function holidayPlanningAuditHourNumber(','function holidayPlanningAuditHoursChanged(','function holidayPlanningAuditGroupRows('])vm.runInContext(estrai(app,n),ctx);
vm.runInContext(fer,ctx);
const S=()=>vm.runInContext('dmFerieState',ctx);

// --- ore di una cella del planning ---
const parse=v=>ctx.dmFerieParseHours(v);
assert.equal(parse(''),0,'Una cella vuota vale 0: svuota la giornata');
assert.equal(parse('8'),8);assert.equal(parse('3,5'),3.5);assert.equal(parse('0,25'),0.25);
assert.equal(parse('3,'),3,'"3," e una digitazione in corso, non un errore');
for(const v of ['9','3,3','-1','abc','8,5'])assert.ok(Number.isNaN(parse(v)),`"${v}" va rifiutato`);

// --- tipo di giornata: chiusura, poi festivita, poi weekend ---
const st=S();
st.closureSet=new Set(['2026-04-03','2026-12-26']);st.closureLabel=new Map([['2026-04-03','Venerdi Santo']]);
const kind=ds=>ctx.dmFerieDayKind(ctx.parseDate(ds),ds);
assert.equal(kind('2026-04-03'),'closure','Una chiusura aziendale ha il proprio colore');
assert.equal(kind('2026-12-26'),'closure','La chiusura prevale anche su festivita e sabato: e una scelta esplicita');
assert.equal(kind('2026-12-25'),'holiday','Natale e una festivita nazionale');
assert.equal(kind('2026-04-06'),'holiday','Anche Pasquetta, che cambia ogni anno');
assert.equal(kind('2026-01-03'),'weekend','Sabato');assert.equal(kind('2026-01-04'),'weekend','Domenica');
assert.equal(kind('2026-01-07'),'','Un mercoledi qualsiasi non ha colore');
assert.ok(ctx.dmFerieDayTitle(ctx.parseDate('2026-04-03'),'2026-04-03').includes('Chiusura aziendale · Venerdi Santo'),'Il titolo della colonna dice perche e colorata');

// --- dati: indice, totali, ferie storiche ---
const dati={year:2026,self_dm_id:'D1',dms:[
 {dm_id:'D1',display_name:'Mario Rossi',residual_ap_hours:-10,projected_ac_hours:100,editable:true},
 {dm_id:'D2',display_name:'Anna Bianchi',residual_ap_hours:5,projected_ac_hours:200,editable:false}],
 plan:[{dm_id:'D1',plan_date:'2026-04-03',hours:8},{dm_id:'D1',plan_date:'2026-05-04',hours:3.5},{dm_id:'D2',plan_date:'2026-03-10',hours:8,legacy:true}],
 closures:[{date:'2026-04-03',label:'Ponte'}]};
st.data=dati;st.year=2026;ctx.dmFerieIndex();
assert.equal(st.totals.D1,11.5,'Le ore programmate sono la somma delle giornate');
assert.ok(st.legacy.has('D2|2026-03-10'),'Una ferie senza ore sul calendario e riconosciuta come storica');
const m=ctx.dmFerieMetrics(dati.dms[0]);
assert.deepEqual([m.total,m.planned,m.residual],[90,11.5,78.5],'Totale = AC + residuo AP (anche negativo); residuo = totale - programmate');

// --- griglia: solo la propria riga e modificabile ---
ctx.renderDmFerieGrid();
const g=host['#dmFerieGrid'].innerHTML;
assert.equal((g.match(/data-dm-ferie-hours/g)||[]).length,365,'Il DM ha una cella modificabile per ogni giorno, solo sulla propria riga');
assert.equal((g.match(/<tr class="dm-ferie-own">/g)||[]).length,1,'La propria riga e evidenziata');
assert.ok(/data-dm-ferie-cell="D2\|2026-03-10"[^>]*>\s*<span class="hours-value">8<\/span>/.test(g),'Le righe degli altri DM sono in sola lettura');
assert.ok(/class="[^"]*dm-day-closure[^"]*has-hours[^"]*" data-dm-ferie-cell="D1\|2026-04-03"/.test(g),'La cella di chiusura con ore resta colorata come chiusura');
assert.ok(/class="[^"]*dm-ferie-legacy[^"]*" data-dm-ferie-cell="D2\|2026-03-10" title="Ferie inserita sul calendario senza ore/.test(g),
 'La ferie storica e marcata e spiegata');
assert.ok(g.includes('value="3,5"'),'Le ore si mostrano con la virgola');
assert.equal((g.match(/<th class="day-head dm-day-holiday/g)||[]).length,
 ctx.holidayYearDates(2026).filter(d=>ctx.itHolidayName(d)&&!st.closureSet.has(ctx.isoDate(d))).length,'Ogni festivita nazionale ha la colonna verde');

// --- quadro ---
ctx.renderDmFerieSummary();
const q=host['#dmFerieSummary'].innerHTML;
assert.equal((q.match(/data-dm-ferie-quadro=/g)||[]).length,2,'Il DM modifica solo i due campi del proprio quadro');
assert.ok(q.includes('>TU</span>'),'La propria riga dice chi sei');
assert.ok(q.includes('Ore Residue AP')&&q.includes('Smaltimento Ferie'),'Le colonne sono quelle del Planning Ferie dei negozi');

// --- profilo RM: tutto in sola lettura ---
st.data={...dati,self_dm_id:'',dms:dati.dms.map(d=>({...d,editable:false}))};ctx.dmFerieIndex();
ctx.renderDmFerieGrid();ctx.renderDmFerieSummary();
assert.ok(!host['#dmFerieGrid'].innerHTML.includes('data-dm-ferie-hours'),'Il RM non ha celle modificabili');
assert.ok(!host['#dmFerieSummary'].innerHTML.includes('data-dm-ferie-quadro'),'ne campi del quadro');

// --- salvataggio: batch, errore, nuovo tentativo ---
st.data=dati;ctx.dmFerieIndex();
const chiamate=[];let fallisci=true;
ctx.window={agendaCloudApi:{request:async(a,p)=>{chiamate.push([a,p]);if(a==='saveDmHolidayPlan'&&fallisci)throw new Error('rete');return {saved:(p.entries||[]).length,events:[]}}}};
ctx.refreshCloudState=async()=>{chiamate.push(['refreshCloudState'])};
vm.runInContext("dmFerieQueue.set('2026-06-01',{plan_date:'2026-06-01',hours:8})",ctx);
assert.equal(await ctx.flushDmFerieQueue(),false,'Un errore di rete non perde la modifica');
assert.equal(vm.runInContext('dmFerieQueue.size',ctx),1,'che resta in coda');
assert.equal(await ctx.flushDmFerieQueue(),false,'e non riparte da sola');
fallisci=false;
assert.equal(await ctx.flushDmFerieQueue(true),true,'Riprova la invia');
assert.deepEqual(chiamate.filter(c=>c[0]==='saveDmHolidayPlan').pop()[1].entries,[{plan_date:'2026-06-01',hours:8}]);
assert.ok(chiamate.some(c=>c[0]==='refreshCloudState'),'Dopo il salvataggio il calendario del DM viene riletto: altrimenti mostrerebbe le ferie di prima');

// --- registro modifiche: le stesse funzioni di controllo del registro negozi ---
const righe=[
 {store_id:'DM_FERIE',action:'UPDATE_HOLIDAY_PLAN_CELL',action_label:'Ferie inserite',employee_name:'Mario Rossi',plan_date:'2026-04-20',field_label:'Ore ferie',old_value:'',new_value:8,actor_role:'DM',actor_display_name:'Mario Rossi',created_at:'2026-11-17T08:00:00Z'},
 {store_id:'DM_FERIE',action:'UPDATE_HOLIDAY_PLAN_CELL',action_label:'Ore ferie modificate',employee_name:'Anna Bianchi',plan_date:'2026-04-21',field_label:'Ore ferie',old_value:8,new_value:4,actor_role:'DM',actor_display_name:'Anna Bianchi',created_at:'2026-11-17T08:01:00Z'},
 {store_id:'DM_FERIE',action:'UPDATE_DM_HOLIDAY_QUADRO',action_label:'Quadro ferie modificato',employee_name:'Mario Rossi',plan_date:'',field_label:'Ore residue AP',old_value:0,new_value:-10,actor_role:'DM',created_at:'2026-11-17T08:02:00Z'},
 {store_id:'DM_FERIE',action:'ADD_COMPANY_CLOSURE',action_label:'Chiusura aziendale inserita',employee_name:'',plan_date:'2026-08-14',field_label:'Chiusura aziendale',new_value:'Ferragosto',actor_role:'RM',actor_display_name:'Retail Manager',created_at:'2026-11-17T08:03:00Z'}];
const ast=vm.runInContext('dmFerieAuditState',ctx);
Object.assign(ast,{rows:righe,complete:true,loading:false,error:'',year:2026,visibleLimit:150});
for(const id of ['#dmFerieAuditTable','#dmFerieAuditMore','#dmFerieAuditMeta','#dmFerieAuditWeeklyChart','#dmFerieAuditMonthlyChart','#dmFerieAuditPeaks','#loadMoreDmFerieAudit',
 '#dmFerieAuditFilterWeek','#dmFerieAuditFilterMonth','#dmFerieAuditFilterField'])host[id]=nodo();
ctx.$=sel=>host[sel]||(host[sel]=nodo());
ctx.renderDmFerieAudit();
assert.ok(host['#dmFerieAuditMeta'].textContent.startsWith('4 modifiche filtrate · 12 ore variate'),'Il riepilogo conta modifiche e ore variate: '+host['#dmFerieAuditMeta'].textContent);
assert.ok(host['#dmFerieAuditTable'].innerHTML.includes('<th>DM</th>')&&host['#dmFerieAuditTable'].innerHTML.includes('Tutti i DM'),
 'La tabella dice di quale DM e la modifica; una chiusura riguarda tutti');
assert.ok(host['#dmFerieAuditFilterMonth'].innerHTML.includes('APRILE 2026')&&host['#dmFerieAuditFilterMonth'].innerHTML.includes('AGOSTO 2026'),'Il filtro mese propone i mesi presenti');
assert.ok(host['#dmFerieAuditFilterField'].innerHTML.includes('Ore residue AP'),'Il filtro campo distingue planning, quadro e chiusure');
assert.ok(/APRILE 2026[\s\S]*2 mod\.[\s\S]*12 h/.test(host['#dmFerieAuditMonthlyChart'].innerHTML),'Il grafico mensile somma le ore variate del mese');
vm.runInContext("dmFerieAuditFilters.dm='anna'",ctx);ctx.renderDmFerieAudit();
assert.ok(host['#dmFerieAuditMeta'].textContent.startsWith('1 modifiche filtrate · 4 ore variate'),'Il filtro DM restringe righe, ore e grafici');
vm.runInContext("dmFerieAuditFilters.dm=''",ctx);

// --- il registro e' riservato a RM e ADMIN ---
{const visto=[];ctx.window={agendaCloudApi:{request:async(azione)=>{visto.push(azione);return {events:[],next_cursor:null}}}};
 for(const [chi,rm,adm,atteso] of [['un DM',false,false,false],['il RM',true,false,true],['un ADMIN',false,true,true]]){
  profilo.rm=rm;profilo.adm=adm;visto.length=0;
  assert.equal(ctx.dmFerieAuditVisible(),atteso,`Registro per ${chi}: ${atteso?'visibile':'nascosto'}`);
  await ctx.loadDmFerieAudit(true);
  assert.equal(visto.includes('getDmHolidayAudit'),atteso,`Per ${chi} il registro ${atteso?'si':'non si'} carica`);
 }
 profilo.rm=true;profilo.adm=false;}
const caricamento=fer.slice(fer.indexOf('async function loadDmHolidays('),fer.indexOf('function dmFerieIndex('));
assert.ok(caricamento.includes("$('#dmFerieAuditPanel')?.classList.toggle('hidden',!dmFerieAuditVisible());"),'Il pannello del registro si nasconde a chi non puo vederlo');
assert.ok(/id="dmFerieAuditPanel" class="card holiday-planning-audit hidden"/.test(html),'E parte nascosto: nessun lampo di contenuto prima del controllo');

// --- maschera FERIE del calendario: ore obbligatorie ---
assert.equal(ctx.ferieHoursLabel(''),'Tutto il giorno (8h)','Una ferie storica senza ore vale la giornata intera');
assert.equal(ctx.ferieHoursLabel(8),'Tutto il giorno (8h)');assert.equal(ctx.ferieHoursLabel(3.5),'3,5 h');
const nuova=ctx.ferieHoursFieldMarkup('x',null,true);
assert.ok(!nuova.includes('checked'),'Su una ferie nuova nessuna scelta e preimpostata: il DM deve indicarla');
assert.ok(nuova.includes('obbligatorio'),'E la maschera lo dice');
assert.ok(ctx.ferieHoursFieldMarkup('x','',true).match(/value="FULL" checked/),'Una ferie storica si riapre come giornata intera');
assert.ok(/value="PART" checked/.test(ctx.ferieHoursFieldMarkup('x',4,true))&&ctx.ferieHoursFieldMarkup('x',4,true).includes('value="4"'),'Una ferie di 4 ore si riapre con le sue ore');
assert.ok(ctx.ferieHoursFieldMarkup('x',null,false).includes('ferie-hours-box hidden'),'Per note e call il riquadro resta nascosto');
const leggi=(mode,val)=>{ctx.document={querySelector:()=>mode?{value:mode}:null};ctx.$=sel=>sel==='#xFerieValue'?{value:val}:null;return ctx.ferieHoursRead('x')};
assert.deepEqual(leggi('FULL',''),{ok:true,hours:8});
assert.deepEqual(leggi('PART','3,5'),{ok:true,hours:3.5});
assert.equal(leggi(null,'').ok,false,'Senza scelta non si salva');
for(const v of ['','9','0','3,3'])assert.equal(leggi('PART',v).ok,false,`Ore "${v}" rifiutate`);

// --- aggancio alla maschera e alla navigazione ---
const salvaInfo=estrai(app,'async function saveInfoVarieEvent(');
assert.ok(salvaInfo.includes("const ferieOre=type==='DM_HOLIDAY'?ferieHoursRead('infoVarie'):null;if(ferieOre&&!ferieOre.ok){toast(ferieOre.error,true);return}"),
 'Inserire FERIE dal calendario senza ore deve essere impossibile');
assert.ok(salvaInfo.includes('if(ferieOre)payload.hours=ferieOre.hours;'),'Le ore viaggiano con l evento');
const modifica=estrai(app,'function openEditEvent(');
assert.ok(modifica.includes("if(updatePayload.event_type==='DM_HOLIDAY'&&ev.store_id==null){const fo=ferieHoursRead('ee');if(!fo.ok){toast(fo.error,true);return}updatePayload.hours=fo.hours}"),
 'Anche modificando una ferie le ore sono obbligatorie');
assert.ok(app.includes('<option value="DM_HOLIDAY" ${track===\'DM\'?\'selected\':\'\'}>FERIE</option>')&&!/FERIE \/ ASSENZA|Ferie \/ Assenza/i.test(app),
 'Il tipo diventa FERIE, senza piu ASSENZA');
assert.ok(app.includes("hours:e.hours===undefined||e.hours===null?'':e.hours")&&app.includes("hours:src.hours??fallback?.hours??''"),
 'Entrambe le mappature degli eventi conservano le ore: senza, il calendario le perderebbe');
assert.ok(estrai(app,'function eventHoverTitle(').includes("if(e?.event_type==='DM_HOLIDAY')parti.push(ferieHoursLabel(e.hours));"),'Il passaggio del cursore dice le ore');
const nav=estrai(app,'function switchPage(page)');
assert.ok(nav.includes("['rmcalendar','dmholidays','rmholidays'"),'Il RM puo aprire Ferie DM');
assert.ok(nav.includes("rmcalendar:['RETAIL MANAGER','Overview DM']"),'CALENDARIO DM del RM si chiama ora Overview DM');
assert.ok(nav.includes("if(page==='dmholidays')loadDmHolidays(false);"),'Aprendo la pagina si caricano i dati');
assert.ok(html.includes('data-page="rmcalendar">Overview DM</button><button class="nav-btn nav-sub-btn" data-page="dmholidays">Ferie DM</button>'),
 'Nel menu RM, Ferie DM sta sotto Overview DM');
assert.ok(/data-page="dmoverview">Overview DM<\/button>\s*<button class="nav-btn nav-sub-btn admin-only" data-page="dmholidays">Ferie DM<\/button>/.test(html),
 'Nel menu DM, Ferie DM sta sotto Overview DM, e il negozio non la vede');
assert.ok(!html.includes('>Calendario DM<'),'Nessun residuo del vecchio nome');

/* Ogni elemento cercato dalla pagina deve esistere: un ID mancante farebbe
   sparire in silenzio una parte della schermata. */
const ids=[...new Set([...fer.matchAll(/\$\('#([A-Za-z]+)'\)/g)].map(x=>x[1]))];
const nonInPagina=ids.filter(id=>!html.includes(`id="${id}"`)&&!/Modal/.test(id));
assert.deepEqual(nonInPagina,[],'Elementi cercati ma assenti nella pagina: '+nonInPagina.join(', '));
for(const id of ['dmFerieAuditFilterDm','dmFerieAuditFilterDate','dmFerieAuditFilterWeek','dmFerieAuditFilterMonth','dmFerieAuditFilterField'])
 assert.ok(html.includes(`id="${id}"`),`Manca il filtro ${id}`);

// --- colori: solo nella pagina FERIE DM ---
for(const c of ['th.dm-day-weekend','th.dm-day-holiday','th.dm-day-closure','td.dm-day-closure'])
 assert.ok(css.includes('#page-dmholidays .dm-ferie-table '+c+'{'),`Manca il colore ${c}`);
assert.ok(!/(^|\})\s*\.holiday-plan-table [^{]*dm-day/m.test(css),'I colori FERIE DM non devono toccare il Planning Ferie dei negozi');
const verde=css.match(/#page-dmholidays \.dm-ferie-table th\.dm-day-holiday\{background:#([0-9a-f]{6})/)[1];
const rosso=css.match(/#page-dmholidays \.dm-ferie-table th\.dm-day-weekend\{background:#([0-9a-f]{6})/)[1];
const blu=css.match(/#page-dmholidays \.dm-ferie-table th\.dm-day-closure\{background:#([0-9a-f]{6})/)[1];
const tono=h=>{const [r,g,b]=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));return r>g&&r>b?'rosso':g>r&&g>b?'verde':b>r&&b>g?'blu':'?'};
assert.deepEqual([tono(rosso),tono(verde),tono(blu)],['rosso','verde','blu'],'Weekend rossi, festivita verdi, chiusure di un terzo colore');
const cssChiusura=css.indexOf('#page-dmholidays .dm-ferie-table td.dm-day-closure{'),cssOre=css.indexOf('#page-dmholidays .dm-ferie-table td.has-hours{');
assert.ok(cssOre>=0&&cssChiusura>cssOre,'Il colore della giornata viene dopo il giallo delle ore: una chiusura con 8 ore resta blu');

console.log('PASS: FERIE DM con chiusure, quadro, planning, registro e ore obbligatorie sul calendario');
