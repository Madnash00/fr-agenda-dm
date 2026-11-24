/* Action Plan, richiesta 23/11/2026 (2): DISATTIVA al posto di elimina,
   storico modifiche dell'obiettivo, DATA CHECK non retroattiva, alert con
   NEXT STEPS e utente. Le funzioni vere girano su dati finti. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync('assets/js/app.js','utf8'),guided=readFileSync('assets/js/action-plan-guided.js','utf8');
const ctx={Number,String,Math,Object,Array,Set,Map,JSON,console,Date,atob,btoa,encodeURIComponent,decodeURIComponent,
 currentUser:{display_name:'Dm Prova',username:'dm1',role:'ADMIN'},isoDate:()=> '2026-11-23',
 esc:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')};
vm.createContext(ctx);
vm.runInContext(app.slice(app.indexOf('const AP_YTD_DEF='),app.indexOf('function apYtdImpactChart(')),ctx);
vm.runInContext(guided.replace(/^const /gm,'var '),ctx);
const enc=m=>'[APOBJ2:'+btoa(encodeURIComponent(JSON.stringify(m)))+']';

// --- 1. DISATTIVA ---
const o={objective_text:'UPT 2,1',notes:'Nota libera\n'+enc({kpi:'upt',alerts:[{date:'2026-11-20'}],edits:[{at:'2026-11-01T09:00:00Z',by:'Dm Prova',type:'Obiettivo creato'}]})};
assert.ok(ctx.apObjActive(o)&&!ctx.apObjDisabled(o));
ctx.apObjSetDisabled(o);
const m=ctx.apGuidedMeta(o.notes);
assert.ok(m.disabled.at&&m.disabled.by==='Dm Prova','Disattivazione con data e utente');
assert.equal(m.edits.at(-1).type,'Obiettivo disattivato','La disattivazione entra nello storico modifiche');
assert.equal(m.kpi,'upt','Il resto dei metadati resta');
assert.equal(ctx.apGuidedNotes(o.notes),'Nota libera','Le note restano');
const at=m.disabled.at;ctx.apObjSetDisabled(o);assert.equal(ctx.apGuidedMeta(o.notes).disabled.at,at,'Disattivare due volte non cambia nulla');
assert.equal(ctx.apGuidedMeta(o.notes).edits.length,2);
const legacy={objective_text:'Vecchio',notes:''};ctx.apObjSetDisabled(legacy);assert.ok(ctx.apObjDisabled(legacy),'Anche un obiettivo senza metadati si disattiva');
// fuori dai monitoraggi: badge
assert.equal(ctx.apAlertBadgeCount([{objectives:[o,{notes:enc({alerts:[{date:'2026-11-21'}]})}]}],'2026-11-23'),1,'Il badge ignora gli obiettivi disattivati');
// tabella e PDF contano solo gli attivi
assert.ok(app.includes("activeObjs=objs.filter(apObjActive),tot=objs.length?activeObjs.length"),'N. OBJ e Raggiunti senza i disattivati');
assert.ok(app.includes("['OBJ',String(activeObjs.length)]")&&app.includes("apObjDisabled(o)?'DISATTIVATO'"),'PDF: conteggi senza disattivati, etichetta DISATTIVATO');
// il tasto
assert.ok(!app.includes('data-ap-obj-remove')&&app.includes('data-ap-obj-disable')&&app.includes('>DISATTIVA</button>'),'ELIMINA diventa DISATTIVA');
assert.ok(app.includes("apConfirmDisable('OBJ '"),'Con finestra di conferma');
assert.ok(guided.includes("ok.disabled=input.value.trim()!=='DISATTIVA'")&&guided.includes("if(input.value.trim()!=='DISATTIVA')return"),'Conferma solo scrivendo DISATTIVA');
assert.ok(guided.includes('>Consulta</button>')&&guided.includes("closed||off?(meta.kpi?"),'Il disattivato (o il piano chiuso) si consulta');
assert.ok(guided.includes("x.id!=='apAlertHistoryBtn')x.disabled=true"),'In sola lettura, storico alert consultabile');

// --- 2. storico modifiche ---
const old={objective_text:'UPT 2,1 capi/scontrino',tasks:[]},oldMeta={pairs:[{action:'A',tool:'T1'},{action:'B',tool:'T2'}],alerts:[{date:'2026-12-01'}],checks:[{id:'C1',date:'2026-11-23',history:[]}]};
const newMeta={pairs:[{action:'A',tool:'T9'},{action:'C',tool:'T3'}],alerts:[{date:'2026-12-01'},{date:'2026-12-20'}],checks:[{id:'C1',date:'2026-11-23',history:[{at:'x'}]},{id:'C2',date:'2026-11-25',history:[]}]};
const tipi=[...ctx.apObjChangeTypes(old,oldMeta,'UPT 2,3 capi/scontrino',newMeta)];
assert.deepEqual(tipi,['Obiettivo: UPT 2,1 capi/scontrino → UPT 2,3 capi/scontrino','Strumento di “A”: T1 → T9','Azione aggiunta: C (T3)','Azione tolta: B','Alert impostato per il 20/12/2026','CHECK del 23/11/2026 modificato','CHECK del 25/11/2026 registrato']);
assert.deepEqual([...ctx.apObjChangeTypes(old,oldMeta,old.objective_text,oldMeta)],[],'Nessuna modifica: nessuna riga');
const tab=ctx.apEditsHtml([{at:'2026-11-20T10:00:00Z',by:'Dm Prova',type:'Obiettivo creato'},{at:'2026-11-22T10:00:00Z',by:'339 · PISTOIA',type:'Alert impostato per il 01/12/2026'}],true);
assert.ok(tab.includes('<th>DATA</th><th>TIPO MODIFICA</th><th>UTENTE</th>')&&tab.includes('STORICO MODIFICHE (2)'),'Data, tipo modifica, utente');
assert.ok(tab.indexOf('Alert impostato')<tab.indexOf('Obiettivo creato'),'Dalla piu recente');
assert.ok(guided.includes("metadata.edits=[...data.edits,...(old?apObjChangeTypes(old,meta,objectiveText,metadata):['Obiettivo creato'])"),'Ogni conferma aggiunge le sue righe, le vecchie restano');

// --- 3. DATA CHECK non retroattiva ---
const rows=[{action:'a',light:'GREEN'}];
assert.ok(/precedente a oggi/.test(ctx.apCheckValidate({date:'2026-11-22',rows},'2026-11-23')),'Ieri: no');
assert.equal(ctx.apCheckValidate({date:'2026-11-23',rows},'2026-11-23'),'','Oggi: si');
assert.equal(ctx.apCheckValidate({date:'2026-12-01',rows},'2026-11-23'),'','Futuro: si');
assert.equal(ctx.apCheckValidate({date:'2026-11-10',rows,snapshot:{date:'2026-11-10'}},'2026-11-23'),'','Un CHECK gia salvato tiene la sua data');
assert.ok(ctx.apCheckValidate({date:'2026-11-12',rows,snapshot:{date:'2026-11-10'}},'2026-11-23'),'Ma non la si sposta nel passato');
assert.equal(ctx.apCheckMinDate({},'2026-11-23'),'2026-11-23');
assert.equal(ctx.apCheckMinDate({snapshot:{date:'2026-11-10'}},'2026-11-23'),'2026-11-10');
assert.ok(ctx.apCheckHtml({date:'2026-11-23',rows:[]},0,[]).includes('min="2026-11-23"'),'Calendario da oggi');

// --- 4. alert con NEXT STEPS e utente ---
const h=ctx.apAlertsHtml({alerts:[{date:'2026-11-20',next_steps:'Rivedere cabina',by:'Dm Prova',set_at:'2026-11-10T09:00:00Z'},{date:'2026-12-10',next_steps:'Outfit',by:'339 · PISTOIA'}],checks:[{date:'2026-11-20',saved:true}],alertHistoryOpen:true});
assert.ok(h.includes('id="apAlertNext"')&&h.includes('NEXT STEPS'),'Campo NEXT STEPS');
assert.ok(h.includes('Rivedere cabina')&&h.includes('Inserito da Dm Prova')&&h.includes('Inserito da 339 · PISTOIA'),'Storico: data, next steps, utente');
assert.ok(h.includes('STORICO ALERT (2)')&&h.includes('In programma'),'Anche gli alert futuri nello storico');
assert.ok(h.includes('hsl(125 70% 91%)'),'Colore riga: logica invariata (CHECK stesso giorno = verde)');
assert.ok(guided.includes("if(!next){toast('Scrivi i NEXT STEPS dell’alert.',true);return}")&&guided.includes('next_steps:next,by:apUserLabel()'),'NEXT STEPS obbligatori, utente registrato');
console.log('PASS: Action Plan DISATTIVA, storico modifiche, DATA CHECK da oggi, alert con NEXT STEPS');
