/* Account NEGOZIO abbinato a piu DM: il browser deve accettare il perimetro
   che comprende i negozi di tutti i DM abbinati, senza rinunciare al controllo
   che il perimetro sia quello dichiarato dal backend. Nomi e codici finti. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync('assets/js/app.js','utf8'),api=readFileSync('assets/js/cloud-api.js','utf8');
const estrai=(t,inizio)=>{const r=t.split('\n'),i=r.findIndex(x=>x.startsWith(inizio));assert.notEqual(i,-1,`Manca ${inizio}`);
 for(let n=1;n<=40;n++){const f=r.slice(i,i+n).join('\n');try{new vm.Script(f);return f}catch{}}assert.fail(inizio)};
const ctx={String,Number,Array,Map,Set,Object,Error,console};vm.createContext(ctx);
for(const n of ['const STORE_CALENDAR_POLICY=','class AgendaApiError'])vm.runInContext(estrai(api,n).replace(/^const /,'var ').replace(/^class AgendaApiError/,'var AgendaApiError=class AgendaApiError'),ctx);
vm.runInContext('var storeVisitsVisibleToStores,storeVisitsVisibilityReady,storeCalendarDirectory,storeCalendarContract,app={},currentUser=null;',ctx);
for(const n of ['function calendarLegacyStore(','function setStoreCalendarContract('])vm.runInContext(estrai(app,n),ctx);
const P=vm.runInContext('STORE_CALENDAR_POLICY',ctx);
const base=extra=>({store_visits_visible_to_stores:true,store_calendar_policy:P.id,calendar_scope:P.scope,store_calendar_view:P.view,calendar_contract_version:P.contractVersion,admin_id:'ADM1',own_store_id:'STO1',regions:[],...extra});
const st=(id,admin)=>({store_id:id,admin_id:admin,store_code:id,name:id,active:true});
const prova=cal=>{vm.runInContext("currentUser={role:'STORE',admin_id:'ADM1',store_id:'STO1'}",ctx);try{ctx.setStoreCalendarContract(cal);return 'OK'}catch(e){return e.code}};

const condiviso=base({dm_ids:['ADM1','ADM2'],scope_admin_ids:['ADM1','ADM2'],stores:[st('STO1','ADM1'),st('STO2','ADM1'),st('STO3','ADM2')],store_count:3});
assert.equal(prova(condiviso),'OK','Il negozio condiviso accetta i negozi di entrambi i DM abbinati');
assert.equal(vm.runInContext('storeCalendarDirectory.length',ctx),3,'e li mostra tutti');
assert.equal(prova(base({dm_ids:['ADM1','ADM2'],scope_admin_ids:['ADM1','ADM2'],stores:[st('STO1','ADM1'),st('STO9','ADM9')],store_count:2})),'STORE_CALENDAR_SCOPE_INVALID',
 'Un negozio di un DM non dichiarato resta un errore: il controllo non e stato tolto');
assert.equal(prova(base({stores:[st('STO1','ADM1'),st('STO2','ADM1')],store_count:2})),'OK','Con il backend precedente (un solo DM) nulla cambia');
assert.equal(prova(base({stores:[st('STO1','ADM1'),st('STO3','ADM2')],store_count:2})),'STORE_CALENDAR_SCOPE_INVALID','Senza dichiarazione, negozi di altri DM restano rifiutati');
assert.equal(prova({...condiviso,admin_id:'ADM2'}),'STORE_CALENDAR_ADMIN_INVALID','Il DM proprietario del negozio deve restare quello della sessione');
assert.equal(prova({...condiviso,store_count:2}),'STORE_CALENDAR_SCOPE_INVALID','Il numero dichiarato deve coincidere');
assert.ok(/EXPECTED_BACKEND_BUILD='2026-11-20-fatturato-esito-v22'/.test(api),'Il frontend attende il backend corrente');
/* Il nome del DM arriva fino al tooltip: senza, due F nella colonna INFO VARIE non si distinguono. */
assert.ok(app.includes("dm_name:e.dm_name?String(e.dm_name):''")&&app.includes("dm_name:String(src.dm_name||fallback?.dm_name||'')"),'Entrambe le conversioni degli eventi conservano il nome del DM');
console.log('PASS: account NEGOZIO con piu DM abbinati, perimetro di tutti i DM accettato e ancora verificato');
