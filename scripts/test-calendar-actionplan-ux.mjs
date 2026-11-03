import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync('assets/js/app.js','utf8');
const css=fs.readFileSync('assets/css/app.css','utf8');
const html=fs.readFileSync('index.html','utf8');
assert.ok(app.includes("data-has-events=\"\${filtered.length?'1':'0'}\""),'Render must mark occupied cells');
assert.ok(app.includes("filtered=eventsForTrack(events,track),tip=calendarEventNoteTooltip(filtered)"),'Store cells must expose visible notes only');
assert.ok(app.includes("const tip=calendarEventNoteTooltip(filtered)"),'INFO VARIE cells must expose notes only');
assert.ok(css.includes('th.dm-absence-head .info-varie-vertical'),'INFO VARIE matching header required');
assert.ok(css.includes('#actionPlanForm :is(.apy-footer,.ap-guided-footer,.modal-actions)'),'Unified Action Plan buttons required');
assert.ok(css.includes('#actionPlanForm :is(input:not([type=checkbox]),select,textarea)'),'Unified Action Plan inputs required');
assert.ok(css.includes('#actionPlanForm :is(.apy-hero,.apy-panel,.apy-review-card'),'Unified Action Plan cards required');
assert.ok(!app.includes('data-has-events-legacy'),'Other calendar semantics unchanged');
const start=app.indexOf('function calendarEventNoteTooltip(');
const end=app.indexOf('\nfunction eventSummary(',start);
assert.ok(start>0&&end>start,'Hover helper missing');
const live={},handlers={};
const tooltipClasses=new Set();
const tooltip={
 dataset:{},style:{},offsetWidth:170,offsetHeight:55,
 classList:{add:(...c)=>c.forEach(v=>tooltipClasses.add(v)),remove:(...c)=>c.forEach(v=>tooltipClasses.delete(v)),contains:c=>tooltipClasses.has(c)},
 textContent:'',innerHTML:''
};
const eventTarget=(cell=null,ownTooltip=null,stats=null)=>({
 closest(selector){
  if(selector==='[data-store-stats-id]')return stats;
  if(selector==='#calendarWrap .calendar tbody [data-cell]')return cell;
  if(selector==='[data-tooltip]')return ownTooltip;
  if(selector==='[data-store-stats-id],[data-tooltip],#calendarWrap .calendar tbody [data-cell]')return cell||ownTooltip||stats;
  return null;
 }
});
const ctx={
 document:{
  body:{appendChild(el){live.tooltip=el}},
  createElement:()=>tooltip,
  addEventListener:(type,fn)=>{handlers[type]=fn}
 },
 $:selector=>selector==='#hoverTooltip'?live.tooltip:null,
 DAYS:['DOM','LUN','MAR','MER','GIO','VEN','SAB'],
 storeById:id=>id==='S1'?{code:'1001',name:'Negozio Demo'}:null,
 currentUser:{role:'STORE'},
 eventTextVisibleToCalendarViewer:e=>!e.isPrivate,
 window:{innerWidth:900,innerHeight:900},
 loadCalendarStoreStats:()=>{},
 calendarStoreStatsHtml:()=>'<div>stats</div>',
 console
};
vm.createContext(ctx);
vm.runInContext(app.slice(start,end)+';this.helpers={calendarEventNoteTooltip,calendarCellHoverText,wireHoverTooltip};',ctx);
const {calendarEventNoteTooltip,wireHoverTooltip}=ctx.helpers;
assert.equal(calendarEventNoteTooltip([{note:'Visita clienti'}]),'Visita clienti');
assert.equal(calendarEventNoteTooltip([{note:'Nota riservata',isPrivate:true}]),'','Private notes must be hidden');
assert.equal(calendarEventNoteTooltip([{note:'  '},{raw_text:'Ferie programmate'}]),'Ferie programmate');
assert.equal(calendarEventNoteTooltip([{note:'Prima'},{note:'Seconda'}]),'Prima\n\nSeconda');
wireHoverTooltip();
const cell=(occupied,tip='',date='2026-11-04')=>({dataset:{hasEvents:occupied?'1':'0',tooltip:tip,date,track:'DM',store:'S1'},querySelector:()=>null});
function hover(target){handlers.mouseover({target,clientX:110,clientY:85})}
hover(eventTarget(cell(false)));
assert.equal(tooltip.textContent,'DM · MER 4\n1001 · Negozio Demo','Empty cell must show location');
assert.ok(tooltipClasses.has('show'),'Empty cell tooltip shown');
hover(eventTarget(cell(true,'')));
assert.ok(!tooltipClasses.has('show'),'Occupied cell without note must hide tooltip');
hover(eventTarget(cell(true,'Cliente interessata alla nuova collezione')));
assert.equal(tooltip.textContent,'Cliente interessata alla nuova collezione','Occupied cell must show note only');
assert.ok(!tooltip.textContent.includes('DM ·'),'Position must disappear over occupied cells');
const badge={dataset:{tooltip:'NOTA CHIP'}};
hover(eventTarget(cell(true,'Nota della cella'),badge));
assert.equal(tooltip.textContent,'Nota della cella','Cell tooltip takes priority even over chip tooltip');
hover(eventTarget(null,badge));
assert.equal(tooltip.textContent,'NOTA CHIP','Non-calendar tooltips must remain unchanged');
const stats={dataset:{storeStatsId:'S1'}};
ctx.currentUser={role:'ADMIN'};
hover(eventTarget(null,null,stats));
assert.ok(tooltipClasses.has('store-stats'),'Store stats tooltip retained');
console.log('PASS: calendar empty/occupied/notes/private note hover priority; INFO VARIE and Action Plan scoped UX');
