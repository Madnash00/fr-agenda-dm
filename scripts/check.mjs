import assert from 'node:assert/strict';
import {readFileSync, existsSync, statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const read = p => readFileSync(p, 'utf8');
function fp(v) {
 let h=0xcbf29ce484222325n;
 for(let i=0;i<v.length;i++){h^=BigInt(v.charCodeAt(i));h=BigInt.asUintN(64,h*0x100000001b3n)}
 return h.toString(16).padStart(16,'0');
}
const html=read('index.html');
assert.ok(Buffer.byteLength(html,'utf8')<100000, 'HTML must remain compact; keep application assets external');
assert.doesNotMatch(html,/<style(?:\s|>)/i,'Application CSS must be in the CSS asset');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
assert.equal(scripts.length,4,'Expected three ordered external scripts and one data-only seed script');
for(const i of [0,1,2]) {
 assert.match(scripts[i][1],/\bdefer\b/,'Application script must use defer');
 assert.equal(scripts[i][2].trim(),'','Inline executable JS is forbidden');
}
assert.ok(scripts[0][1].includes('cloud-api.js') && scripts[1][1].includes('app.js'),'Cloud API must execute before app');
assert.ok(scripts[2][1].includes('personnel-hours.js'),'Personnel module must execute after app.js');
assert.match(scripts[3][1],/type="application\/json"/,'Expected inline JSON-only seed script');
const seed=JSON.parse(scripts[3][2]);
for(const key of ['stores','users','events','audit','exports']) assert.ok(Array.isArray(seed[key]),'Missing seed field: '+key);
for(const path of ['assets/css/app.css','assets/css/personnel-hours.css','assets/js/cloud-api.js','assets/js/app.js','assets/js/personnel-hours.js']) {
 assert.ok(existsSync(path),'Missing resource: '+path);
 assert.ok(statSync(path).size>100,'Empty asset: '+path);
 assert.ok(html.includes('./'+path+'?v='+fp(read(path))),'Stale cache version: '+path+'; run node scripts/bump-asset-versions.mjs');
}
for(const path of ['assets/js/cloud-api.js','assets/js/app.js','assets/js/personnel-hours.js'])execFileSync(process.execPath,['--check',path],{stdio:'pipe'});
const api=read('assets/js/cloud-api.js'),app=read('assets/js/app.js');
for(const feature of ['function createAgendaApi(', 'window.agendaCloudApi=createAgendaApi('])assert.ok(api.includes(feature),'Cloud API feature missing: '+feature);
for(const feature of ['async function boot()', 'function renderRMCalendar()', 'function renderHolidayConsolidated()', 'function applyRoleNavigation()', 'function showApp()'])assert.ok(app.includes(feature),'Existing app feature missing: '+feature);
assert.match(app,/boot\(\);\s*$/,'Application boot must remain the last operation');
// RM login regression: navigation lists require $$(), not the single-element $() helper.
const rmNavigation = app.split('\n').find(line => line.startsWith('function applyRoleNavigation(){'));
assert.ok(rmNavigation, 'RM navigation entrypoint missing');
assert.ok(rmNavigation.includes("$$('.admin-only,.store-only,.super-admin-only').forEach("), 'RM role buttons must use $$');
assert.ok(rmNavigation.includes("$$('.nav-launch-btn.rm-launch-access').forEach("), 'RM shortcut buttons must use $$');

assert.ok(html.includes('mode=store-calendar'),'Missing store-only WOP link');
assert.ok(html.includes('claude.ai/artifact/K9MFsMHmYkw8yFqw8h4qc4'),'DM Dashboard link missing');
for(const m of html.matchAll(/(?:href|src)="\.\/([^"?#]+)(?:\?[^"]*)?"/g)) assert.ok(existsSync(m[1]),'Broken local resource: '+m[1]);
const manifest=JSON.parse(read('manifest.webmanifest'));
for(const icon of manifest.icons||[])if(icon.src?.startsWith('./'))assert.ok(existsSync(icon.src.slice(2)),'PWA icon missing: '+icon.src);

// Session lifecycle regression invariants.
assert.ok(app.includes("$('.nav-section:not(.rm-only):not(.admin-only):not(.super-admin-only)').forEach("), 'Menus must be rebuilt for every role');
assert.ok(app.includes('const prefetchActive=()'), 'Idle work must retain session identity');
assert.ok(api.includes('assertCurrentSession()'), 'Old session API replies must be discarded');
assert.ok(api.includes('requestEpoch++'), 'Logout must invalidate pending requests');

const incorrectSingleSelectorIterations = [...app.matchAll(/(?<!\$)\$\(\s*(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\x60(?:[^\x60\\]|\\.)*\x60)\s*\)\s*\.forEach\s*\(/g)];
assert.equal(incorrectSingleSelectorIterations.length, 0, 'DOM selector error: $() returns one element; use $$() before .forEach()');
// Focused regressions: ADMIN inherits DM, STORE self-service credentials and RM calendar fit.
assert.ok(html.includes('id="storeChangePasswordBtn"') && html.indexOf('id="storeChangePasswordBtn"')<html.indexOf('id="logoutBtn"'),'STORE password menu must precede logout');
assert.ok(app.includes("$('#storeChangePasswordBtn').onclick=changeOwnPassword"),'Store self-password change must use existing authenticated API');
assert.ok(app.includes("(currentUser?.profile_role==='DM'||currentUser?.profile_role==='ADMIN')"),'ADMIN must inherit DM store visit visibility');
assert.ok(html.includes('id="rmCalFitBtn"') && app.includes('function applyRMCalendarFit()') && app.includes('requestAnimationFrame(applyRMCalendarFit)'),'RM fit control must reflow calendar without altering rows');
assert.ok(html.includes('visual-dashboard-link')&&read('assets/css/app.css').includes('.nav-launch-btn.visual-dashboard-link{justify-content:center'),'Visual Dashboard title should be centered');
assert.ok(app.includes('function outlookSvUid(e)')&&app.includes("latestVisitByDate.get(e.event_date)===e"),'Outlook SVs must be deduplicated per day and use stable identities');
assert.ok(html.includes('sv-visibility-label'),'Store visibility control needs explicit state label');
assert.ok(app.includes("if(typeof cal?.store_visits_visible_to_stores!=='boolean')"),'Store calendar must enforce visibility policy');
console.log('PASS: markup, external assets, script order, cache versions, JavaScript syntax, seed data and required features');
