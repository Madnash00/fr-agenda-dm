import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync('assets/js/app.js','utf8');
const css=fs.readFileSync('assets/css/app.css','utf8');
const html=fs.readFileSync('index.html','utf8');
assert.ok(html.includes('data-page="holidayperiods">Periodi Negozi'),'Nome voce menu');
assert.ok(!html.includes('id="globalBusyTitle"')&&!html.includes('id="globalBusyText"'),'Non mostrare testi nel logo globale');
assert.ok(!html.includes('<span>Carico i dati</span>'),'Non mostrare testi nel caricamento letture');
assert.ok(css.includes('#pageLoading,#globalBusy{left:var(--desktop-sidebar-w,182px)'),'Spinner allineati alla superficie principale desktop');
assert.ok(css.includes('#hoverTooltip.calendar-cell-tip'),'Stile tooltip discreto');
assert.ok(css.includes('#calendarWrap .calendar.transposed thead :is(th,.store-name-vertical'),'Tipografia intestazioni unificata');

const tooltipStart=app.indexOf('function calendarCellHoverText('),tooltipEnd=app.indexOf('\nfunction wireHoverTooltip(',tooltipStart);
assert.ok(tooltipStart>0&&tooltipEnd>tooltipStart,'Hover text helper');
const context={DAYS:['DOM','LUN','MAR','MER','GIO','VEN','SAB'],storeById:id=>id==='S1'?{code:'1001',name:'Negozio Demo'}:null};
vm.createContext(context);
vm.runInContext(app.slice(tooltipStart,tooltipEnd)+';this.hover=calendarCellHoverText;',context);
const cell=(date,track,store)=>({dataset:{date,track,store}});
assert.equal(context.hover(cell('2026-11-04','DM','S1')),'DM · MER 4\n1001 · Negozio Demo');
assert.equal(context.hover(cell('2026-11-05','SM','S1')),'SM · GIO 5\n1001 · Negozio Demo');
assert.equal(context.hover(cell('2026-11-06','NOTE','DM')),'NOTE · VEN 6\nDISTRETTO');
assert.equal(context.hover(cell('invalid','DM','S1')),'');
assert.equal(context.hover(cell('2026-11-04','UNKNOWN','S1')),'');

const start=app.indexOf('let agendaPageLoadCount=0,'),end=app.indexOf("window.addEventListener('agenda-page-loading-start'",start);
assert.ok(start>0&&end>start,'Lifecycle loading helper');
let id=0;const timers=new Map(),visible=new Set();
const el={classList:{add:x=>visible.add(x),remove:x=>visible.delete(x),contains:()=>false}};
const loadingContext={
  $:selector=>selector==='#appShell'||selector==='#pageLoading'?el:null,
  setTimeout:(fn,ms)=>{const k=++id;timers.set(k,{fn,ms});return k},
  clearTimeout:k=>timers.delete(k),
  console:{warn(){}}
};
vm.createContext(loadingContext);
vm.runInContext(app.slice(start,end)+';this.loading={start:agendaPageLoadStart,end:agendaPageLoadEnd,reset:resetAgendaPageLoading};',loadingContext);
const fire=ms=>{const match=[...timers].find(([,v])=>v.ms===ms);assert.ok(match,'Expected timer '+ms);timers.delete(match[0]);match[1].fn()};
loadingContext.loading.start();loadingContext.loading.start();fire(220);
assert.ok(visible.has('show'),'Indicatore visibile per letture lente');
loadingContext.loading.end();assert.ok(visible.has('show'),'Resta visibile per lettura ancora pendente');
loadingContext.loading.end();assert.ok(!visible.has('show'),'Nessun caricamento residuo dopo ultima lettura');
loadingContext.loading.start();fire(220);fire(20000);
assert.ok(!visible.has('show'),'Watchdog rimuove animazione che si blocca');
loadingContext.loading.end();assert.ok(!visible.has('show'),'Lettura terminata in ritardo non deve riattivare spinner');
assert.ok(app.includes('resetAgendaPageLoading();resetGlobalBusy();const badgeStore='),'Entrata app ripulisce le animazioni pendenti');
assert.ok(app.includes("const ownTooltip=e.target.closest?.('[data-tooltip]'),cell=e.target.closest?.('#calendarWrap .calendar tbody [data-cell]')"),'Tooltip sulla singola cella');
console.log('PASS: caricamento concorrente, recupero watchdog, logo non invasivo, menu, intestazioni e tooltip calendario');
