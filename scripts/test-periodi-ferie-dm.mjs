/* Richiesta del 25/11/2026: PERIODI FERIE anche per il DM nel menu FERIE NEGOZI,
   come per l'ADMIN (ognuno gestisce gli alert del proprio distretto). */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync('assets/js/app.js','utf8'),html=readFileSync('index.html','utf8');
assert.ok(html.includes('<button class="nav-btn nav-sub-btn admin-only" data-page="holidayperiods">Periodi Negozi</button>'),'voce nel menu FERIE NEGOZI per ADMIN e DM');
assert.ok(html.includes('<section id="page-holidayperiods" class="page admin-only hidden">'),'pagina visibile ai profili ADMIN/DM');
const menu=html.slice(html.indexOf('data-nav-section="store-holidays"'),html.indexOf('data-nav-section="store-overtime"'));
assert.ok(menu.indexOf('data-page="holidays"')<menu.indexOf('data-page="holidayperiods"')&&menu.indexOf('data-page="holidayperiods"')<menu.indexOf('data-page="holidayconsolidated"'),'stessa posizione dell ADMIN, dopo Planning Ferie');
const ctx={currentUser:null};vm.createContext(ctx);
const r=app.split('\n');for(const n of ['function isSuperAdmin(','function canEditHolidayPeriods('])vm.runInContext(r.find(x=>x.startsWith(n)),ctx);
const can=u=>{ctx.currentUser=u;return ctx.canEditHolidayPeriods()};
assert.equal(can({role:'ADMIN',profile_role:'ADMIN'}),true,'ADMIN');assert.equal(can({role:'ADMIN',profile_role:'DM'}),true,'DM');
assert.equal(can({role:'STORE',profile_role:'NEGOZIO'}),false,'NEGOZIO');assert.equal(can({role:'RM',profile_role:'RM'}),false,'RM');assert.equal(can(null),false,'senza sessione');
assert.ok(app.includes("if(page==='holidayperiods'&&!canEditHolidayPeriods())return;")&&app.includes("function holidayPeriodPointerDown(e){if(!canEditHolidayPeriods()||")&&app.includes("async function loadHolidayPeriodsEditor(force=false){\n if(!canEditHolidayPeriods())return;")&&app.includes("async function saveHolidayPeriodsEditor(){\n if(!canEditHolidayPeriods()||holidayPeriodSaving)return;"),'pagina, trascinamento, caricamento e salvataggio abilitati al DM');
assert.ok(app.includes("['holidays','Planning Ferie'],['holidayperiods','Periodi Negozi'],['holidayconsolidated'"),'voce gestibile in Gestione Profili (DM)');
assert.ok(app.includes("'Vengono importati solo i tuoi negozi: gli altri presenti nel file vengono ignorati.'"),'import fatturato del DM limitato ai suoi negozi');
console.log('PASS: Periodi Ferie per il DM nel menu FERIE NEGOZI, come per l ADMIN');
