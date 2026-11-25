/* Richiesta del 25/11/2026: IMPOSTAZIONI > Gestione Link per DM e RM. Ogni tasto dei
   Collegamenti apre il link assegnato all'account; vuoto = link predefinito. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync('assets/js/app.js','utf8'),html=readFileSync('index.html','utf8'),api=readFileSync('assets/js/cloud-api.js','utf8');
// menu: DM in IMPOSTAZIONI, RM in una nuova sezione IMPOSTAZIONI
const dmSet=html.slice(html.indexOf('data-nav-section="settings"'),html.indexOf('id="changePasswordBtn"'));
assert.ok(dmSet.includes('<button class="nav-btn nav-sub-btn" data-page="links">Gestione Link</button>'),'voce DM in IMPOSTAZIONI');
assert.ok(/data-nav-section="rm-settings"[\s\S]*?<span>IMPOSTAZIONI<\/span>[\s\S]*?data-page="links">Gestione Link</.test(html),'voce RM in IMPOSTAZIONI');
assert.ok(html.includes('<section id="page-links" class="page">')&&html.includes('id="linksAccountSelect"')&&html.includes('id="linksSave"'),'pagina Gestione Link');
assert.ok(app.includes("'rmactionplans','storemenu','links'].includes(page))return;if(page==='links'&&!canManageLinks())return;"),'pagina ammessa a RM, negata al NEGOZIO');
assert.ok(app.includes("links:['IMPOSTAZIONI','Gestione Link']")&&app.includes("const group=page==='links'&&isRetailManager()?'rm-settings':PAGE_NAV_GROUP[page];"),'titolo e gruppo di menu');
// apertura del tasto: link dell'account, altrimenti predefinito (DM DASHBOARD con le sue regole)
const r=app.split('\n'),grab=n=>{const i=r.findIndex(x=>x.startsWith(n));assert.notEqual(i,-1,n);for(let k=1;k<30;k++){const f=r.slice(i,i+k).join('\n');try{new vm.Script(f);return f}catch{}}assert.fail(n)};
const ctx={currentUser:null,URL,location:{href:'https://x.github.io/'},Date,Set,String,Number};vm.createContext(ctx);
for(const n of ['const DM_DASHBOARD_URL_NEW=','const DM_DASHBOARD_NEW_ACCOUNTS_FROM=','const DM_DASHBOARD_SPECIAL_NAMES=','function dmDashboardNormalizeName(','function dmDashboardTargetUrl(','let accountLinks=','function isRetailManager(','function canManageLinks(','function linkAppDefault(','function linkButtonDefault(','function applyAccountLinkTo(','function linksValidUrl('])vm.runInContext(grab(n).replace(/^(const|let) /,'var '),ctx);
const btn=(k,url,dm)=>({dataset:{profileLink:k,externalUrl:url},hasAttribute:a=>a==='data-dm-dashboard'&&!!dm});
ctx.currentUser={role:'ADMIN',profile_role:'DM',display_name:'Dm Prova',created_at:'2026-01-01T00:00:00Z'};
const wop=btn('link-wop','https://madnash00.github.io/wop-app/');
assert.equal(ctx.applyAccountLinkTo(wop),'https://madnash00.github.io/wop-app/','senza link: predefinito');
vm.runInContext("accountLinks={'link-wop':'https://wop.example.it/a'}",ctx);
assert.equal(ctx.applyAccountLinkTo(wop),'https://wop.example.it/a','link dell account');
vm.runInContext('accountLinks={}',ctx);assert.equal(ctx.applyAccountLinkTo(wop),'https://madnash00.github.io/wop-app/','cambio account: torna il predefinito');
const dash=btn('link-dmdashboard','https://claude.ai/artifact/OLD',true);
ctx.currentUser={role:'ADMIN',profile_role:'DM',display_name:'Dm Nuovo',created_at:'2026-11-20T00:00:00Z'};
assert.equal(ctx.applyAccountLinkTo(dash),vm.runInContext('DM_DASHBOARD_URL_NEW',ctx),'DM DASHBOARD predefinito segue le regole per account');
vm.runInContext("accountLinks={'link-dmdashboard':'https://claude.ai/artifact/MIO'}",ctx);assert.equal(ctx.applyAccountLinkTo(dash),'https://claude.ai/artifact/MIO','DM DASHBOARD personalizzato');
// predefinito per tutti: prevale sul predefinito dell'app, non sul link personale
vm.runInContext("accountLinks={};accountLinkDefaults={'link-wop':'https://wop.tutti.it','link-dmdashboard':'https://claude.ai/artifact/TUTTI'}",ctx);
assert.equal(ctx.applyAccountLinkTo(wop),'https://wop.tutti.it','predefinito per tutti');assert.equal(ctx.applyAccountLinkTo(dash),'https://claude.ai/artifact/TUTTI','anche sopra la regola DM DASHBOARD');
vm.runInContext("accountLinks={'link-wop':'https://wop.mio.it'}",ctx);assert.equal(ctx.applyAccountLinkTo(wop),'https://wop.mio.it','il link personale resta');vm.runInContext('accountLinks={};accountLinkDefaults={}',ctx);
assert.ok(app.includes('Predefinito per tutti i profili</label>')&&app.includes("if(Object.keys(defaults).length)payload.defaults=defaults;")&&app.includes('il link diventerà il predefinito per tutti i profili DM e RM'),'opzione ADMIN con conferma');
assert.ok(app.includes("${admin?`<div class=\"links-admin-tools\">")&&app.includes('admin=!!linksState.manage_all'),'opzione visibile solo all ADMIN');
for(const [u,ok] of [[{role:'ADMIN',profile_role:'DM'},true],[{role:'RM',profile_role:'RM'},true],[{role:'STORE',profile_role:'NEGOZIO'},false],[null,false]]){ctx.currentUser=u;assert.equal(ctx.canManageLinks(),ok,JSON.stringify(u))}
assert.equal(ctx.linksValidUrl('https://a.it/x?y=1'),true);assert.equal(ctx.linksValidUrl('javascript:alert(1)'),false);assert.equal(ctx.linksValidUrl('https://a b.it'),false);
assert.ok(app.includes("if(b.dataset.profileLink)applyAccountLinkTo(b);const w=window.open(b.dataset.externalUrl,'_blank');"),'il click usa il link dell account');
assert.ok(app.includes('setAccountLinks(boot?.account_links,boot?.account_link_defaults);return app;')&&app.includes('if(boot)setAccountLinks(boot.account_links,boot.account_link_defaults);'),'link caricati al login (RM e DM)');
assert.ok(app.includes("accountLinks={};accountLinkDefaults={};linksState=null;linksAccountId='';linksDirty=false;"),'logout: i link non passano all account successivo');
assert.ok(api.includes("saveAccountLinks:['directory','audit']")&&api.includes("'getRMMulti','getAccountLinks']"),'cache API');
console.log('PASS: Gestione Link per DM e RM con link per account');
