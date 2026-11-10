/* CALENDARIO DM / OVERVIEW DM: lettura della griglia.
   Le settimane devono alternarsi e i periodi non operativi (sabato, domenica e
   festivita') devono essere riconoscibili. Il test esegue il renderer vero in un
   contesto isolato: un'asserzione sul testo del sorgente non proverebbe che il
   markup prodotto sia quello atteso. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync('assets/js/app.js','utf8');
const css=readFileSync('assets/css/app.css','utf8');
const riga=inizio=>{const i=app.indexOf(inizio);assert.notEqual(i,-1,`Manca ${inizio}`);const a=app.lastIndexOf('\n',i)+1,b=app.indexOf('\n',i);return app.slice(a,b<0?app.length:b)};

// --- contesto minimo: tutto cio' che il renderer trova nella pagina e' finto, il renderer no ---
const giorni=[];for(let d=new Date(2026,11,21);d<=new Date(2027,0,10);d.setDate(d.getDate()+1))
 giorni.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
const host={innerHTML:''},nulla={innerHTML:'',textContent:'',value:''};
const ctx={
 rmCalendarCache:{dms:[{dm_id:'1',display_name:'DM TEST'}],events:[]},
 rmCalendarDmId:'',rmCalendarView:'month',
 rmCalEl:k=>k==='grid'?host:nulla,
 rmCalendarRange:()=>({label:'21/12/2026 – 10/01/2027',dates:giorni}),
 parseDate:ds=>new Date(`${ds}T00:00:00`),
 rmEventLabel:e=>String(e&&e.event_type||''),
 esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
 applyRMCalendarFit:()=>{},requestAnimationFrame:fn=>fn(),
 window:{},Date,Map,Math,String,Number,isNaN,JSON
};
vm.createContext(ctx);
for(const sorgente of [riga('function isoWeekInfo(date){'),riga("const IT_FIXED_HOLIDAYS={'01-01'"),
 riga('const itEasterCache='),riga('function itEasterSunday(year){'),riga('function itHolidayName(date){'),riga('const IT_HOLIDAY_SHORT='),riga('function itHolidayShort(name){'),
 riga('function renderRMCalendar(){')]) vm.runInContext(sorgente,ctx);

// --- il calcolo delle festivita' ---
const nome=k=>ctx.itHolidayName(new Date(`${k}T00:00:00`));
for(const [k,atteso] of [['2026-01-01','Capodanno'],['2026-01-06','Epifania'],['2026-04-25','Festa della Liberazione'],
 ['2026-05-01','Festa del Lavoro'],['2026-06-02','Festa della Repubblica'],['2026-08-15','Ferragosto'],
 ['2026-11-01','Ognissanti'],['2026-12-08','Immacolata Concezione'],['2026-12-25','Natale'],['2026-12-26','Santo Stefano']])
 assert.equal(nome(k),atteso,`${k} deve risultare ${atteso}`);
/* Pasqua e' mobile: senza un riscontro esterno un errore nel calcolo passerebbe inosservato. */
for(const [anno,pasqua] of [[2024,'2024-03-31'],[2025,'2025-04-20'],[2026,'2026-04-05'],[2027,'2027-03-28'],
 [2028,'2028-04-16'],[2029,'2029-04-01'],[2030,'2030-04-21']]){
 assert.equal(nome(pasqua),'Pasqua',`Pasqua ${anno} cade il ${pasqua}`);
 const l=new Date(`${pasqua}T00:00:00`);l.setDate(l.getDate()+1);
 assert.ok(ctx.itHolidayName(l).startsWith('Luned'),`Il lunedi dell'Angelo ${anno} segue la Pasqua`);
}
for(const k of ['2026-11-10','2026-12-24','2026-12-27','2027-01-07'])
 assert.equal(nome(k),'',`${k} non e' una festivita'`);

// --- il markup prodotto ---
ctx.renderRMCalendar();
const out=host.innerHTML;
assert.ok(out.includes('<table class="rm-calendar-table month-view"'),'La griglia deve essere renderizzata');

const bande=[...out.matchAll(/<th class="rm-week-band([^"]*)"/g)].map(m=>m[1].includes('rm-week-alt'));
assert.ok(bande.length>=3,'Il periodo di prova deve coprire piu settimane');
bande.forEach((alt,i)=>assert.equal(alt,i%2===1,`La banda della settimana ${i+1} deve alternarsi`));

const intestazioni=[...out.matchAll(/<th class="(rm-date-col[^"]*)"([^>]*)>/g)];
assert.equal(intestazioni.length,giorni.length,'Una intestazione per giorno');
const celle=[...out.matchAll(/<td class="(rm-date-col[^"]*)"/g)].map(m=>m[1]);
assert.deepEqual(celle,intestazioni.map(m=>m[1]),'Intestazione e cella devono avere le stesse classi: una sola fonte');

giorni.forEach((ds,i)=>{
 const classi=intestazioni[i][1],d=new Date(`${ds}T00:00:00`),festa=nome(ds);
 assert.equal(classi.includes('rm-weekend'),d.getDay()===0||d.getDay()===6,`${ds}: sabato e domenica vanno marcati`);
 assert.equal(classi.includes('rm-sunday'),d.getDay()===0,`${ds}: la domenica va distinta`);
 assert.equal(classi.includes('rm-holiday'),!!festa,`${ds}: la festivita' va marcata`);
 if(festa){
  assert.ok(intestazioni[i][2].includes(`title="${festa}"`),`${ds}: la festivita' va nominata nel tooltip`);
  assert.ok(out.includes(`<span class="rm-day-holiday">${ctx.itHolidayShort(festa)}</span>`),`${ds}: la festivita' va scritta in intestazione`);
  assert.ok(ctx.itHolidayShort(festa).length<=14,`${ds}: l'etichetta in intestazione deve restare leggibile`);
 }
});
/* Il 26/12/2026 e' sabato: il periodo di festivita' comprende il fine settimana. */
const i26=giorni.indexOf('2026-12-26');
assert.ok(intestazioni[i26][1].includes('rm-holiday')&&intestazioni[i26][1].includes('rm-weekend'),
 'Una festivita di sabato deve risultare insieme festiva e di fine settimana');

// --- lo stile vale per entrambe le pagine ---
const occorrenze=(css.match(/#page-rmcalendar/g)||[]).length;
assert.equal(occorrenze,(css.match(/:is\(#page-rmcalendar,#page-dmoverview\)/g)||[]).length,
 'Ogni regola del calendario RM deve valere anche per OVERVIEW DM, altrimenti le due viste divergono');
assert.ok(occorrenze>0,'Le regole del calendario devono esistere');
for(const regola of ['th.rm-week-band.rm-week-alt','tbody td.rm-week-alt','th.rm-holiday','tbody td.rm-holiday','.rm-day-holiday'])
 assert.ok(css.includes(regola),`Manca la regola di stile ${regola}`);

console.log('PASS: alternanza settimane, festivita con fine settimana, stile condiviso fra CALENDARIO DM e OVERVIEW DM');
