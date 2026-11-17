/* Voci riservate nel menu del profilo NEGOZIO.
   Overview DM vive sotto AGENDA DM, sezione che al negozio serve: nascondere
   la sezione non bastava, e la voce restava visibile pur portando a una pagina
   che switchPage rifiutava. Il negozio vedeva quindi un comando inerte su dati
   che non lo riguardano.
   La funzione viene eseguita davvero, su una finta barra di navigazione, perche'
   il difetto non stava nel markup ma in chi rimetteva in chiaro il pulsante. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync('assets/js/app.js','utf8'),html=readFileSync('index.html','utf8');
const righe=app.split('\n');
const estrai=inizio=>{const i=righe.findIndex(x=>x.startsWith(inizio));assert.notEqual(i,-1,`Manca ${inizio}`);
 for(let n=1;n<=60;n++){const f=righe.slice(i,i+n).join('\n');try{new vm.Script(f);return f}catch{}}
 assert.fail(`Frammento non compilabile: ${inizio}`)};

/* Una voce del menu ridotta all'osso: classi e pagina, come nel documento. */
function voce(page,...classi){
 const set=new Set(['nav-btn',...classi]);
 return {dataset:{page},classList:{
  contains:c=>set.has(c),add:c=>set.add(c),remove:c=>set.delete(c),
  toggle:(c,v)=>{const on=v===undefined?!set.has(c):!!v;on?set.add(c):set.delete(c);return on}},
  nascosta(){return set.has('hidden')}};
}

function applica(ruolo,{profile_role=ruolo}={}){
 const voci=[voce('calendar'),voce('dmoverview','admin-only'),voce('holidays'),
  voce('actionplans'),voce('storemenu','super-admin-only'),voce('report')];
 const sezioni=[];
 const ctx={console,String,Array,Object,Set,
  currentUser:{role:ruolo,profile_role,store_id:ruolo==='STORE'?'S1':null},
  isSuperAdmin:()=>profile_role==='ADMIN',
  isRetailManager:()=>ruolo==='RM',
  profileMenuAllowed:()=>true,applyProfileLinkVisibility:()=>{},
  $$:sel=>sel.includes('nav-section')?sezioni:voci};
 vm.createContext(ctx);
 vm.runInContext(estrai('function applyProfileMenuVisibility()'),ctx);
 ctx.applyProfileMenuVisibility();
 return voci;
}

// --- il negozio non deve vedere Overview DM ---
const negozio=applica('STORE');
const overview=negozio.find(v=>v.dataset.page==='dmoverview');
assert.ok(overview.nascosta(),'Il profilo NEGOZIO non deve vedere Overview DM');
/* profileMenuAllowed torna true per tutto: se la voce riemerge lo stesso,
   significa che l unica difesa era la configurazione del menu, che puo cambiare. */
assert.ok(negozio.find(v=>v.dataset.page==='calendar').nascosta()===false,
 'Le voci che al negozio servono devono restare: la sezione AGENDA DM gli occorre');
assert.ok(negozio.find(v=>v.dataset.page==='actionplans').nascosta()===false,
 'Action Plan resta al negozio');
assert.ok(negozio.find(v=>v.dataset.page==='report').nascosta(),
 'I report di distretto restano fuori, come prima');

// --- gli altri profili non devono perdere nulla ---
for(const [ruolo, opt] of [['ADMIN',{profile_role:'ADMIN'}],['ADMIN',{profile_role:'DM'}]]){
 const v=applica(ruolo,opt).find(x=>x.dataset.page==='dmoverview');
 assert.equal(v.nascosta(),false,`Il profilo ${opt.profile_role} deve continuare a vedere Overview DM`);
}
/* Il profilo RM ha un menu proprio: la guardia non deve toccarlo. */
const rm=applica('RM');
assert.equal(rm.find(v=>v.dataset.page==='dmoverview').nascosta(),false,
 'La guardia riguarda il solo profilo NEGOZIO, non il RM');

/* La voce riservata al solo ADMIN non deve cambiare comportamento. */
assert.equal(applica('STORE').find(v=>v.dataset.page==='storemenu').nascosta(),false,
 'Le voci super-admin-only mantengono la loro gestione, invariata');

// --- l ancora nel documento ---
assert.ok(/data-page="dmoverview"[^>]*>/.test(html)||/admin-only[^>]*data-page="dmoverview"/.test(html),
 'La voce Overview DM deve restare nel documento: viene nascosta, non rimossa');
assert.ok(/class="[^"]*admin-only[^"]*"[^>]*data-page="dmoverview"/.test(html),
 'E deve portare la classe admin-only, che e cio su cui si basa la guardia');

/* Raggiungerla per altra via resta impedito, come prima. */
assert.ok(estrai('function switchPage(page){').includes("currentUser.role==='STORE'&&!storePageEnabled(page)"),
 'Il blocco di navigazione del profilo NEGOZIO deve restare');
assert.ok(!app.includes("STORE_MENU_ELIGIBLE_PAGES=Object.freeze(['calendar','holidays','holidayconsolidated','overtimecheck','actionplans','dmoverview'"),
 'Overview DM non deve entrare fra le pagine abilitabili al negozio');

console.log('PASS: Overview DM fuori dal menu del profilo NEGOZIO, invariato per DM, ADMIN e RM');
