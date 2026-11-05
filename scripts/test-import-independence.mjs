/* Indipendenza degli import.
   FERIE CONSOLIDATE deve poter essere caricato da solo e aggiornare tutto cio'
   che il file contiene, senza dipendere da straordinari o ore lavorate.
   L'unica interdipendenza ammessa e' fra STRAORDINARI e ORE LAVORATE: le ore
   vengono confrontate solo sui mesi in cui esistono straordinari. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
const app=readFileSync('assets/js/app.js','utf8');
const personnel=readFileSync('assets/js/personnel-hours.js','utf8');

const slice=(src,from,to)=>{const i=src.indexOf(from);assert.ok(i>=0,'Blocco non trovato: '+from);
 const j=to?src.indexOf(to,i):-1;return src.slice(i,j>i?j:i+6000)};

// --- FERIE: nessun riferimento agli altri due flussi ---
const ferieParse=slice(app,'async function parseHolidayConsolidatedWorkbook(file){','async function importHolidayConsolidatedFile(');
const ferieImport=slice(app,'async function importHolidayConsolidatedFile(file){','let holidayConsolidatedRequestSequence');
for(const [label,block] of [['parser ferie',ferieParse],['import ferie',ferieImport]]){
 for(const forbidden of ['getGlobalImportOvertimePeriods','getStoreOvertimeCheck','importStoreOvertimeCheck',
                         'importPersonnelWorkHoursYtd','overtimeCheckCache','personnel_hours','loadOvertimeCheck']){
  assert.ok(!block.includes(forbidden),
   `Il ${label} non deve dipendere da straordinari o ore lavorate: trovato "${forbidden}"`);
 }
}
// L'import ferie chiama solo la propria azione e ricarica le proprie viste.
assert.ok(ferieImport.includes("request('importHolidayConsolidated'"),'Import ferie deve chiamare la propria azione');
assert.ok(ferieImport.includes('loadHolidayConsolidated(true)'),'Import ferie deve ricaricare la propria pagina');

// --- L'aggancio del negozio si basa sull'anagrafica, non sugli altri file ---
const resolver=slice(app,'function agendaResolveStoreName(sourceName,sourceCode){','if(typeof window!==\'undefined\')window.agendaResolveStoreName');
assert.ok(resolver.includes('app?.stores'),'Il risolutore deve basarsi sull\'anagrafica negozi');
for(const forbidden of ['overtimeCheckCache','holidayConsolidatedCache','getGlobalImportOvertimePeriods'])
 assert.ok(!resolver.includes(forbidden),`Il risolutore non deve leggere dati di altri import: "${forbidden}"`);

// --- ORE LAVORATE: l'interdipendenza con gli straordinari resta, ed e' solo qui ---
assert.ok(personnel.includes("request('getGlobalImportOvertimePeriods'"),
 'Le ore lavorate devono continuare a confrontarsi con i mesi degli straordinari');
assert.ok(!app.includes("request('getGlobalImportOvertimePeriods'"),
 'La dipendenza dai mesi di straordinario deve restare confinata alle ore lavorate');
console.log('PASS: ferie indipendente; interdipendenza limitata a straordinari e ore lavorate');
