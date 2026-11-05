import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('index.html','utf8'),js=fs.readFileSync('assets/js/app.js','utf8');
const oldUrl='https://claude.ai/artifact/K9MFsMHmYkw8yFqw8h4qc4?sk=CqVPcQL8kgBrSEtxwyWK4Q';
const newUrl='https://claude.ai/artifact/SXLxWz4S2AZxMYdoyRijNu?sk=wLpBgQwQok2enP0Jgs-xWA';
assert.ok(html.includes('data-dm-dashboard="1" data-external-url="'+oldUrl+'"'),'Legacy link must remain default in HTML');
assert.ok(js.includes("function updateDmDashboardLink()"),'Dedicated account-scoped link helper required');
assert.ok(js.includes("function showApp(){if(!currentUser)return;updateDmDashboardLink();"),'Link must refresh at every login');
assert.ok(js.includes("store_name:u.store_name||u.display_name||'',created_at:u.created_at||''"),'Creation timestamp must be preserved');
const start=js.indexOf('/* DMDASHBOARD: gli account esistenti'),end=js.indexOf('function normalizeCurrentUser(u){',start);
assert.ok(start>0&&end>start,'Isolated URL-selection functions missing');
const button={dataset:{dmDashboard:'1',externalUrl:oldUrl}};
const context={document:{querySelector:()=>button},currentUser:null,Date,Number,String,Set};
vm.createContext(context);
vm.runInContext(js.slice(start,end)+';this.api={dmDashboardTargetUrl,updateDmDashboardLink,normalize:dmDashboardNormalizeName};',context);
const api=context.api;
const specific=['Brunella Cucciniello','Salvatore Salierno','Fabio Nicosia','Veronica Giuntini'];
for(const display_name of specific)assert.equal(api.dmDashboardTargetUrl({display_name},oldUrl),newUrl,display_name);
assert.equal(api.dmDashboardTargetUrl({display_name:'  BRUNELLA  CUCCINIELLO '},oldUrl),newUrl,'Whitespace/case normalization');
for(const display_name of ['Un altro utente','Mario Rossi','Fabio Nicosia Jr.','Veronica Giuntini Test']){
 assert.equal(api.dmDashboardTargetUrl({display_name,created_at:'2026-09-15T12:00:00.000Z'},oldUrl),oldUrl,'Other existing account '+display_name);
}
assert.equal(api.dmDashboardTargetUrl({display_name:'Nuovo DM',created_at:'2026-11-04T09:00:00.000Z'},oldUrl),newUrl,'New account');
assert.equal(api.dmDashboardTargetUrl({display_name:'Nuovo RM',created_at:'2026-11-03T13:01:01.000Z'},oldUrl),newUrl,'Account created just after cutoff');
assert.equal(api.dmDashboardTargetUrl({display_name:'Utente esistente'},oldUrl),oldUrl,'Missing timestamp must preserve legacy link');
assert.equal(api.dmDashboardTargetUrl({display_name:'Utente esistente',created_at:'invalid'},oldUrl),oldUrl,'Invalid timestamp must preserve legacy link');
assert.equal(api.dmDashboardTargetUrl({display_name:'Utente esistente',created_at:'2026-10-28T09:00:00.000Z'},oldUrl),oldUrl,'Existing before cutoff');
context.currentUser={display_name:'Brunella Cucciniello'};
api.updateDmDashboardLink();assert.equal(button.dataset.externalUrl,newUrl,'Targeted account');
context.currentUser={display_name:'Utente esistente',created_at:'2026-10-01T08:00:00.000Z'};
api.updateDmDashboardLink();assert.equal(button.dataset.externalUrl,oldUrl,'Switch account must restore original link');
context.currentUser={display_name:'Nuovo DM',created_at:'2026-11-04T09:00:00.000Z'};
api.updateDmDashboardLink();assert.equal(button.dataset.externalUrl,newUrl,'New user on same browser');
console.log('PASS: DMDASHBOARD four named profiles, unchanged existing users, new-user default, switching accounts');

/* RM: collegamento dedicato, SFS DASHBOARD nascosto, SFS TOOL presente. */
const rmUrl='https://madnash00.github.io/fr-agenda-dm/';
const sfsTool='https://claude.ai/artifact/LHSvFHCrgbt53ss3r81tLp';
assert.equal(api.dmDashboardTargetUrl({profile_role:'RM',display_name:'Retail Manager'},oldUrl),rmUrl,'RM deve aprire l\'agenda di distretto');
assert.equal(api.dmDashboardTargetUrl({role:'RM',display_name:'Retail Manager'},oldUrl),rmUrl,'Anche il ruolo legacy RM');
// Il ruolo prevale sulle regole per nome e per data di creazione.
assert.equal(api.dmDashboardTargetUrl({profile_role:'RM',display_name:'Veronica Giuntini'},oldUrl),rmUrl,'RM prevale sui quattro nomi');
assert.equal(api.dmDashboardTargetUrl({profile_role:'RM',display_name:'Nuovo RM',created_at:'2026-11-04T09:00:00.000Z'},oldUrl),rmUrl,'RM prevale sul cutoff');
// I profili non RM restano invariati.
assert.equal(api.dmDashboardTargetUrl({profile_role:'DM',display_name:'Utente esistente'},oldUrl),oldUrl,'Il DM non deve cambiare collegamento');
assert.equal(api.dmDashboardTargetUrl({profile_role:'NEGOZIO',display_name:'Negozio'},oldUrl),oldUrl,'Il NEGOZIO non deve cambiare collegamento');
context.currentUser={profile_role:'RM',display_name:'Retail Manager'};
api.updateDmDashboardLink();assert.equal(button.dataset.externalUrl,rmUrl,'Il pulsante segue il profilo RM');
context.currentUser={display_name:'Utente esistente',created_at:'2026-10-01T08:00:00.000Z'};
api.updateDmDashboardLink();assert.equal(button.dataset.externalUrl,oldUrl,'Tornando a un DM il collegamento torna quello originale');

assert.ok(html.includes('class="nav-launch-btn sfs-dashboard rm-hidden"'),'SFS DASHBOARD deve essere nascosto al profilo RM');
assert.ok(js.includes("$$('.rm-hidden').forEach(x=>x.classList.toggle('hidden',rm))"),'La visibilita RM deve essere applicata al cambio ruolo');
assert.ok(js.includes('function applyRoleNavigation(){const rm=isRetailManager();updateDmDashboardLink();'),'Il collegamento deve seguire anche il passaggio RM/ADMIN');
const tool=html.slice(html.indexOf('sfs-tool')-200,html.indexOf('sfs-tool')+300);
assert.ok(tool.includes('data-external-url="'+sfsTool+'"'),'SFS TOOL deve puntare al collegamento richiesto');
assert.ok(tool.includes('admin-only')&&tool.includes('rm-launch-access'),'SFS TOOL deve essere visibile a DM e RM');
assert.ok(!tool.includes('store-only'),'SFS TOOL non e richiesto per il profilo NEGOZIO');
assert.ok(html.indexOf('sfs-tool')>html.indexOf('sfs-dashboard'),'SFS TOOL va in fondo ai tasti di lancio');
assert.ok(js.includes("window.open(b.dataset.externalUrl,'_blank')"),'I collegamenti esterni devono aprirsi in una nuova scheda');
console.log('PASS: RM dashboard link, SFS DASHBOARD nascosto per RM, SFS TOOL per DM e RM');
