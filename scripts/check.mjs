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
const hoursModule=read('assets/js/personnel-hours.js');
assert.ok(hoursModule.includes('monthly_hours')&&hoursModule.includes('const periods=(check?.periods||[])'),'Personnel import retains per-employee monthly totals and uses overtime months');
// Performance regressions: delegated clicks, one date calculation per day, last-request-wins.
assert.ok(app.includes("dayMeta={ds,isWeekend,isSunday,isToday}") && app.includes("renderTransposedStoreCell(st,d,idx,track,regionStartIds.has(st.id),dayMeta)"),'Calendar date metadata must be reused per row');
assert.ok(app.includes("const flag=e.target.closest?.('[data-info-flag]')") && !app.includes("$('[data-info-flag]').forEach"),'Calendar flags use click delegation');
assert.ok(app.includes('ensureMobileAgendaClickDelegation()') && !app.includes("$('[data-mobile-cell]').forEach"),'Store mobile agenda uses click delegation');
for(const k of ['reportRequestSequence','overtimeCheckRequestSequence','rmCalendarRequestSequence','holidayConsolidatedRequestSequence'])assert.ok(app.includes(k),'Latest request guard missing: '+k);
assert.ok(api.includes("if(keys.length<=48)return"),'Avoid parsing persistent cache entries when pruning is not required');
assert.ok(app.includes("if(ev?.event_type==='STORE_VISIT'&&(!storeVisitsVisibilityReady||!storeVisitsVisibleToStores))"),'STORE SV must fail closed before verified visibility');
const storeContractSource=app.slice(app.indexOf('function setStoreCalendarContract('),app.indexOf('function storeCalendarReady()'));assert.ok(storeContractSource.indexOf("if(dir.some(st=>String(st.admin_id||'')!==serverAdmin))")>=0&&storeContractSource.indexOf('storeVisitsVisibleToStores=cal.store_visits_visible_to_stores;')>storeContractSource.indexOf("if(dir.some(st=>String(st.admin_id||'')!==serverAdmin))"),'STORE privacy must be applied only after DM ownership and store scope checks');
// Store-only holiday and overtime UX regression locks.
assert.ok(html.includes('store-holiday-disclaimer')&&html.includes('La proiezione dei saldi al 31/12 ha valore esclusivamente indicativo'),'Consolidated holiday disclaimer must remain');
assert.ok(app.includes('store-disposal-badge')&&app.includes('SPETTANTE AC 31/12')&&app.includes('<th>GODUTO</th>'),'Store employee consolidated columns must remain');
const overtimeDetail=app.slice(app.indexOf('function renderOvertimeDetailTable()'),app.indexOf('function normalizeOvertimeImportHeader('));
assert.ok(overtimeDetail.includes("currentUser?.role==='STORE'?'':'<th>Livello</th>'")&&overtimeDetail.includes("currentUser?.role==='STORE'?'':`<td>"),'Only DM retains LIVELLO; NEGOZIO cannot render it');
assert.ok(app.includes('function wireHolidayEmployeeDrag()')&&app.includes("request('saveHolidayEmployeeOrder'"),'Persistent employee ordering required');
assert.ok(app.includes('function renderStoreOvertimeBudget()')&&app.includes("String(d?.store_id||'')!==String(currentUser.store_id||'')")||app.includes("String(d.store_id||'')!==String(currentUser.store_id||'')"),'Store budget must be restricted to authenticated store');
// Strict regression locks: requested overtime filter and consolidated formatting.
const hoursUI=read('assets/js/personnel-hours.js');
assert.ok(hoursUI.includes("employee?sourceRows.filter(x=>Number(x.work_hours)!==0):sourceRows"),'DM selected-store employee report must exclude zero worked hours only');
const consolidated=app.slice(app.indexOf('function renderHolidayConsolidated()'),app.indexOf('async function loadHolidayConsolidatedReport(',app.indexOf('function renderHolidayConsolidated()')));
assert.ok(consolidated.includes('consolidated-disposal-kpi')&&consolidated.includes('consolidated-regular-kpi'),'Holiday KPI colors must share disposal logic');
assert.ok(consolidated.includes('<th>Smaltimento 31/12</th>')&&consolidated.includes("store-disposal-badge ${paceClass(x.disposal_pct)}"),'Store summary percent must use employee disposal badge');
assert.ok(consolidated.includes("if(legend)legend.classList.remove('hidden')"),'DM must see year-progress disposal legend');
const budgetView=app.slice(app.indexOf('function overtimeBudgetPanelMarkup(p)'),app.indexOf('function renderStoreOvertimeBudget()',app.indexOf('function overtimeBudgetPanelMarkup(p)')));
assert.ok(budgetView.includes("['Budget disponibile fino ad oggi',budget]")&&budgetView.includes("['Risparmiato',remaining]")&&!budgetView.includes("['Scostamento',delta]"),'NEGOZIO budget cards should have requested labels and no scostamento');
assert.ok(budgetView.includes("n<0?'saved-red':'saved-green'"),'RISPARMIATO negative red, nonnegative green');
assert.ok(html.includes('id="rmOvertimeBudgetPanel"')&&html.includes('id="rmHolidayConsolidatedLegend"'),'RM layout panels must exist');
assert.ok(app.includes('function renderRMOvertimeBudget()')&&app.includes('function overtimeBudgetPanelMarkup(p)'),'Shared overtime UI must exist');
assert.ok(!app.slice(app.indexOf('function overtimeBudgetPanelMarkup(p)'),app.indexOf('function renderStoreOvertimeBudget()')).includes('<strong>${usage'),'Do not show oversized budget usage percentage');
assert.ok(app.includes('function rmDisposalColor(v,year)')&&app.includes('consolidated-disposal-kpi'),'RM holiday colors must follow the same progress rules');
assert.ok(app.includes('function placeDmOvertimeBudget()')&&app.includes('toolbar.after(panel)')&&app.includes('incidence.after(panel)'),'DM budget should follow filters and STORE layout should remain unchanged');
assert.ok(!read('assets/js/personnel-hours.js').includes('class="personnel-summary"')&&!read('assets/js/personnel-hours.js').includes("const stats=[["),'Incidence KPI cards should be removed, table retained');
// Targeted UI regressions: holiday period source and DM eye button geometry.
assert.ok(app.includes('function holidayConsolidatedPeriodName(meta)')&&app.includes('function holidayConsolidatedPeriodBadge(meta)'),'Clear consolidated month/year required');
assert.ok(app.includes('rmHolidayConsolidatedPeriodBadge(d?.sources)')&&app.includes('PERIODI DIVERSI PER DM'),'RM needs explicit uniform/mixed-period indication');
assert.ok(!app.includes("icon.textContent=storeVisitsVisibleToStores?'👁':'◉̸'"),'Do not replace the eye with an unrelated glyph');
assert.ok(html.includes('class="sv-eye-cross"')&&html.includes('class="sv-eye-svg"'),'DM button uses shared SVG eye with centered X');
assert.ok(read('assets/css/app.css').includes('#page-calendar #todayBtn,#page-calendar #storeVisitVisibilityBtn'),'Calendar Today and SV visibility buttons must share height');
// Neutral period badges share one renderer, sourced from actual imported months.
for(const id of ['holidayConsolidatedPeriod','holidayConsolidatedReportPeriod','rmHolidayConsolidatedPeriod','overtimePeriod','rmOvertimePeriod'])assert.ok(html.includes('id="'+id+'" class="period-toolbar-slot'),'Missing filter-toolbar period slot: '+id);
assert.ok(app.includes('function periodBadge(label,value,mixed=false)')&&app.includes('function overtimePeriodBadge(months)')&&app.includes('PERIODI DIVERSI PER DM'),'Period badges and mixed RM sources must be supported');
assert.ok(app.includes('period.innerHTML=overtimePeriodBadge(d?.months)')&&app.includes('period.innerHTML=holidayConsolidatedPeriodBadge(d?.meta)'),'Period from actual dataset required');
assert.ok(read('assets/css/app.css').includes('.consolidated-period-highlight{display:inline-flex;flex-direction:row')&&read('assets/css/app.css').includes('background:#f5f6f7'),'Shared horizontal gray styling required');

// YTD regression: original store permissions and shared Action Plan schema remain untouched.
assert.ok(app.includes('function apYtdCalculate(v)')&&app.includes('function apYtdSetup(plan)'),'Store YTD analysis missing');
assert.ok(app.includes("apYtdSetup(plan);renderActionPlanObjectivesDraft()"),'STORE analysis must open first');
assert.ok(app.includes("btoa(JSON.stringify({...apYtdRead(),period:apYtdRead('app-')}))"),'YTD and Action Plan period must persist in the existing premise');
assert.ok(!app.includes('actionPlanPdfWrap(plan.premise,premiseW-20,font)'),'PDF must omit structured YTD metadata');
const calcCode=app.slice(app.indexOf('const AP_YTD_DEF='),app.indexOf('function actionPlanStore(id){'));
const calc=new Function(calcCode+';return apYtdCalculate;')();
const base=calc({sales:100000,salesD:-10,visD:-10,cr:20,crD:-5,upt:2,uptD:-5,asp:50,aspD:-5,atv:100,atvD:-5,ms:40,msD:-5});
assert.ok(base&&base.ticketsAC===1000&&base.visitsAC===5000,'AC ticket / visit derivation incorrect');
assert.ok(Math.abs(base.visitsAP-5000/.9)<1e-8&&Math.abs(base.ticketsAP-5000/.9*.2/.95)<1e-8,'AP ticket / visit derivation incorrect');
assert.ok(base.levers.length===7&&base.levers[6][1]===null,'MS must not have an invented value');

// Action Plan: standalone period-analysis step must not overwrite historical YTD input.
assert.ok(app.includes("periodSaved=saved.period&&typeof saved.period==='object'?saved.period:{}"),'Legacy YTD plans must open with a blank action-period analysis');
assert.ok(app.includes("body('apy-',saved)")&&app.includes("body('app-',periodSaved)"),'Independent YTD and action-period input sets required');
assert.ok(app.includes("apYtdRender('app-')")&&app.includes("apYtdCalculate(apYtdRead('app-'))"),'Action-period calculations and validation required');
assert.ok(app.includes("period:apYtdRead('app-')"),'Action-period KPI values must persist independently of legacy YTD fields');
assert.ok(app.includes('STEP 01 / 03')&&app.includes('STEP 02 / 03')&&app.includes('STEP 03 / 03'),'Three-stage workflow required');
assert.ok(app.includes("document.getElementById('app-next').onclick")&&app.includes("document.getElementById('app-back').onclick"),'Back/forward navigation must be available on period analysis');
assert.ok(read('assets/css/app.css').includes('.apy-workflow .apy-period-hero'),'Dedicated period-analysis presentation missing');

// Action Plan in-flight changes must remain editable and target the confirmed plan ID.
assert.ok(app.includes('actionPlanStoreRevision!==submittedRevision'),'Must preserve unsaved in-flight Action Plan edits');
assert.ok(app.includes('editorForm.dataset.planId=String(saved.plan_id)'),'Second submit must reuse confirmed plan ID');
assert.ok(app.includes('planForm.dataset.planId||null'),'Submit handler must read updated ID');
assert.ok(app.includes('if(!saved?.plan_id||!String(saved.plan_id).trim())'),'Cannot confirm Action Plan without server plan ID');

assert.ok(app.includes('function submitNewCalendarEvent(payload,temp,successMessage)'),'Shared event-create handler missing');
assert.ok(app.includes('calendarEventRequiresVerification(err)'),'Unconfirmed event state missing');
assert.ok(app.includes('function confirmedCalendarEventId(saved)'),'Server event ID confirmation missing');
assert.ok(app.includes('function unresolvedCalendarEvents()'),'Pending-event unload guard missing');
assert.ok(app.includes('await submitNewCalendarEvent(payload,temp,'),'Event creation must use shared handler');
assert.ok(app.includes("if(!dir.length)throw new AgendaApiError('STORE_CALENDAR_SCOPE_EMPTY'") && app.indexOf('storeVisitsVisibleToStores=cal.store_visits_visible_to_stores;',app.indexOf('function setStoreCalendarContract('))>app.indexOf('if(!dir.length)throw new AgendaApiError',app.indexOf('function setStoreCalendarContract(')),'STORE policy must validate store directory before committing visibility');
assert.ok(app.includes('calendar-pending-event'),'Calendar pending events need desktop state');
console.log('PASS: markup, external assets, script order, cache versions, JavaScript syntax, seed data and required features');
