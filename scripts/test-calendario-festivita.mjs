/* Richiesta del 24/11/2026: nel Calendario le festivita nazionali sono
   evidenziate in verde chiarissimo su tutta la riga del giorno, come sabato e domenica. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync('assets/js/app.js','utf8'),css=readFileSync('assets/css/app.css','utf8');
const estrai=inizio=>{const r=app.split('\n'),i=r.findIndex(x=>x.startsWith(inizio));assert.notEqual(i,-1,'Manca '+inizio);for(let n=1;n<=30;n++){const f=r.slice(i,i+n).join('\n');try{new vm.Script(f);return f}catch{}}assert.fail(inizio)};
const ctx={String,Number,Date,Map,isNaN};vm.createContext(ctx);
for(const n of ['const IT_FIXED_HOLIDAYS=','const itEasterCache=','function itEasterSunday(','function itHolidayName('])vm.runInContext(estrai(n).replace(/^const /,'var '),ctx);
const h=s=>ctx.itHolidayName(new Date(s+'T12:00:00'));
for(const [d,n] of [['2026-01-01','Capodanno'],['2026-01-06','Epifania'],['2026-04-05','Pasqua'],['2026-04-06','Lunedì dell\'Angelo'],['2026-04-25','Festa della Liberazione'],['2026-05-01','Festa del Lavoro'],['2026-06-02','Festa della Repubblica'],['2026-08-15','Ferragosto'],['2026-10-04','San Francesco d\'Assisi'],['2026-11-01','Ognissanti'],['2026-12-08','Immacolata Concezione'],['2026-12-25','Natale'],['2026-12-26','Santo Stefano'],['2027-03-29','Lunedì dell\'Angelo']])assert.equal(h(d),n,d);
for(const d of ['2025-10-04','2026-11-24','2026-12-24','2026-04-07'])assert.equal(h(d),'',d+' non festivo');
// riga del giorno
assert.ok(app.includes("dayMeta={ds,isWeekend,isSunday,isToday},holidayName=itHolidayName(d);"),'festivita calcolata per ogni giorno');
assert.ok(app.includes("isSunday?'sunday-row':'',holidayName?'holiday-row':''"),'classe holiday-row su tutte e tre le righe del giorno');
assert.ok(app.includes("${holidayName?'holiday':''} ${isToday?'today':''}\"${holidayName?` title=\"${esc(holidayName)}\"`:''}"),'cella data con nome della festivita');
const i=css.lastIndexOf('tr.holiday-row :is(.store-cell,.dm-absence-cell,.id-track,.key-point-cell)');
assert.ok(i>css.lastIndexOf('tr.sunday-row :is(.store-cell')&&i>css.lastIndexOf('tr.sunday-row .key-point-cell'),'regola verde dopo quelle di sabato/domenica');
assert.ok(/\.calendar\.transposed \.date-day\.holiday\{background:#eef8f0\}/.test(css),'verde chiarissimo');
console.log('PASS: festivita nazionali evidenziate su tutta la riga del Calendario');
