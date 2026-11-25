/* Gestione Profili. L'elenco delle voci configurabili era fermo a una versione
   precedente: Overview DM e Ferie DM erano visibili ma non configurabili, e i
   collegamenti non lo erano per nessuno. Qui si eseguono le funzioni vere della
   maschera e dei collegamenti, e si verifica che ogni voce abbia la propria
   descrizione: un interruttore senza spiegazione non dice cosa si sta togliendo. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync('assets/js/app.js','utf8'),html=readFileSync('index.html','utf8');
const estrai=inizio=>{const r=app.split('\n'),i=r.findIndex(x=>x.startsWith(inizio));
 assert.notEqual(i,-1,`Manca ${inizio}`);
 for(let n=1;n<=80;n++){const f=r.slice(i,i+n).join('\n');try{new vm.Script(f);return f}catch{}}
 assert.fail(`Frammento non compilabile: ${inizio}`)};

const stato={rm:false,adm:false,role:'ADMIN'};
const ctx={Object,Array,String,Set,JSON,console,profileMenuConfig:null,
 isSuperAdmin:()=>stato.adm,isRetailManager:()=>stato.rm,get currentUser(){return {role:stato.role}}};
vm.createContext(ctx);
for(const n of ['function esc(','const PROFILE_MENU_GROUPS=','const PROFILE_MENU_DEFAULT_OFF=','function profileMenuDefaultOn(','const PROFILE_INFO=','const PROFILE_SECTION_INFO=',
 'const PROFILE_LINK_INFO=','const PROFILE_ADMIN_INFO=','function normalizeProfileMenuClient(','function profileMenuAllowed(','function applyProfileLinkVisibility(',
 'function profileMenuItemMarkup(','function profileMenuCounts('])vm.runInContext(estrai(n),ctx);
const G=vm.runInContext('PROFILE_MENU_GROUPS',ctx),SEZ=vm.runInContext('PROFILE_SECTION_INFO',ctx),LINK=vm.runInContext('PROFILE_LINK_INFO',ctx),INFO=vm.runInContext('PROFILE_INFO',ctx);
const chiavi=r=>G[r].flatMap(g=>g[2].map(x=>x[0]));

// --- l'audit: le voci visibili oggi sono tutte configurabili ---
assert.deepEqual(chiavi('RM').filter(k=>!k.startsWith('link-')),['rmcalendar','dmholidays','rmholidays','rmovertime','rmactionplans'],'RM: le cinque voci del suo menu');
assert.deepEqual(chiavi('DM').filter(k=>!k.startsWith('link-')),['calendar','agenda','dmoverview','dmholidays','report','holidays','holidayperiods','holidayconsolidated','holidayreport','overtimecheck','actionplans','actionplanreport','stores','users','audit'],
 'DM: le voci del suo menu, Overview DM e Ferie DM comprese');
assert.deepEqual(chiavi('NEGOZIO'),['calendar','holidays','holidayconsolidated','overtimecheck','actionplans','link-wopstore'],'NEGOZIO: le sue cinque voci e il WOP del negozio');
assert.equal(G.RM[0][2][0][1],'Overview DM','La voce del RM porta il nome nuovo');
for(const r of ['RM','DM','NEGOZIO'])for(const k of chiavi(r).filter(k=>!k.startsWith('link-')))
 assert.ok(html.includes(`data-page="${k}"`),`${r}: ${k} deve essere una pagina vera`);
const linkPagina=[...html.matchAll(/data-profile-link="([a-z-]+)"/g)].map(m=>m[1]);
assert.deepEqual([...new Set(linkPagina)].sort(),['link-dmdashboard','link-sfsdashboard','link-sfstool','link-stockmonitor','link-teamsystem','link-visualdashboard','link-wop','link-wopstore'],
 'Ogni collegamento del menu ha la propria chiave');
for(const k of linkPagina)assert.ok(['RM','DM','NEGOZIO'].some(r=>chiavi(r).includes(k)),`${k} deve essere configurabile per almeno un profilo`);

// --- ogni voce ha la sua spiegazione ---
for(const r of ['RM','DM','NEGOZIO']){
 assert.ok(INFO[r].chi&&INFO[r].confronto.length>=2&&INFO[r].escluse.length>=2,`${r}: servono descrizione, confronto ed esclusioni`);
 for(const k of chiavi(r)){
  if(k.startsWith('link-')){assert.ok(LINK[k],`Manca la descrizione del collegamento ${k}`);continue}
  const d=SEZ[r+'|'+k];assert.ok(d&&d.vede&&d.fa&&d.nonfa,`Manca vede/fa/non fa per ${r} · ${k}`);
 }
}
assert.ok(SEZ['DM|dmholidays'].nonfa.includes('registro'),'La scheda DM dice che il registro Ferie DM non e suo');

// --- stato di oggi senza configurazione salvata ---
ctx.profileMenuConfig=null;
const n=ctx.normalizeProfileMenuClient(null);
assert.ok(n.DM.dmholidays&&n.DM.dmoverview&&n.RM.dmholidays,'Le voci visibili oggi risultano attive');
assert.equal(n.RM['link-sfsdashboard'],false,'SFS DASHBOARD per il RM risulta spento, come oggi');
assert.equal(n.DM['link-sfsdashboard'],true,'per il DM acceso, come oggi');
const salvata=ctx.normalizeProfileMenuClient({enabled:{DM:{report:false},RM:{rmovertime:false}}});
assert.ok(salvata.DM.report===false&&salvata.RM.rmovertime===false&&salvata.DM.dmholidays===true,'Le scelte salvate restano, le voci nuove arrivano come oggi');
stato.rm=true;assert.equal(ctx.profileMenuAllowed('link-sfsdashboard'),false,'Con un backend che non conosce la voce, il RM non vede SFS DASHBOARD');stato.rm=false;

// --- collegamenti: la configurazione decide ---
const bottoni=['link-wop','link-sfsdashboard','link-wopstore'].map(k=>{const set=new Set(k==='link-sfsdashboard'?['hidden']:[]);return {k,dataset:{profileLink:k},classList:{toggle:(c,v)=>v?set.add(c):set.delete(c)},nascosto:()=>set.has('hidden')}});
ctx.$$=sel=>sel==='[data-profile-link]'?bottoni:[];
const prova=(ruolo,cfg)=>{stato.rm=ruolo==='RM';stato.role=ruolo==='NEGOZIO'?'STORE':ruolo==='RM'?'RM':'ADMIN';ctx.profileMenuConfig={enabled:cfg};bottoni.forEach(b=>b.classList.toggle('hidden',b.k==='link-sfsdashboard'));ctx.applyProfileLinkVisibility();return Object.fromEntries(bottoni.map(b=>[b.k,!b.nascosto()]))};
assert.equal(prova('RM',{})['link-sfsdashboard'],false,'RM oggi: SFS DASHBOARD nascosto');
assert.equal(prova('RM',{RM:{'link-sfsdashboard':true}})['link-sfsdashboard'],true,'Attivandolo, il RM lo vede');
assert.equal(prova('DM',{DM:{'link-wop':false}})['link-wop'],false,'Spegnendo WOP per il DM, sparisce');
assert.equal(prova('DM',{})['link-wopstore'],true,'Un collegamento non previsto per il profilo resta alle regole di ruolo');
stato.adm=true;assert.equal(prova('DM',{DM:{'link-wop':false}})['link-wop'],true,'ADMIN non e limitato dalla configurazione');stato.adm=false;
assert.ok(estrai('function applyProfileMenuVisibility(').includes('applyProfileLinkVisibility()'),'La configurazione dei collegamenti si applica all avvio, dopo le regole di ruolo');

// --- maschera ---
ctx.profileMenuConfig=null;const st=ctx.normalizeProfileMenuClient(null);
const voce=ctx.profileMenuItemMarkup('RM','link-sfsdashboard','SFS DASHBOARD',st);
assert.ok(voce.includes('ATTIVABILE')&&!voce.includes('checked'),'Una funzione disponibile ma spenta e segnalata come attivabile');
assert.ok(!ctx.profileMenuItemMarkup('DM','dmholidays','Ferie DM',st).includes('ATTIVABILE'),'Le voci attive non portano il segno');
const d=ctx.profileMenuItemMarkup('DM','dmholidays','Ferie DM',st);
assert.ok(d.includes('<dt>Vede</dt>')&&d.includes('<dt>Fa</dt>')&&d.includes('<dt>Non fa</dt>'),'Ogni voce dice cosa vede, cosa fa e cosa non fa');
assert.ok(d.includes('data-profile-key="DM|dmholidays"'),'L interruttore resta quello letto dal salvataggio');
assert.deepEqual(ctx.profileMenuCounts('RM',st),{on:11,tot:12},'Il conteggio della scheda RM dice 11 attive su 12');
const render=estrai('function renderStoreMenuSettings(');
assert.ok(render.includes("'ADMIN'")&&render.includes('PROFILE_ADMIN_INFO.esclusive'),'C e anche la scheda ADMIN, descrittiva');
assert.ok(render.includes('Non disponibile per questo profilo'),'Ogni scheda dice cosa il profilo non puo avere');
assert.ok(estrai('async function saveStoreMenuSettings(').includes("document.querySelectorAll('[data-profile-key]')"),'Il salvataggio raccoglie tutti gli interruttori, anche delle schede non aperte');
console.log('PASS: Gestione Profili con voci dell audit, collegamenti configurabili e descrizioni per profilo');
