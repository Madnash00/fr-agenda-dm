import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync('assets/js/app.js','utf8');
const guided=fs.readFileSync('assets/js/action-plan-guided.js','utf8');
const calc=app.slice(app.indexOf('const AP_YTD_DEF='),app.indexOf('function apYtdEuro(x)'));
const funcs=guided.slice(guided.indexOf('function apGuidedMeta('),guided.indexOf('function apGuidedChoiceHtml('));
assert.ok(calc.startsWith('const AP_YTD_DEF=')&&funcs.startsWith('function apGuidedMeta('),'KPI extraction changed');
const ctx={Number,String,JSON,Array,Math,RegExp,Error,isFinite,atob,btoa,encodeURIComponent,decodeURIComponent};
vm.createContext(ctx);
vm.runInContext(calc+'\n'+funcs+';this.api={apYtdCalculate,apGuidedProjection,apGuidedMeta,apGuidedNotes};',ctx);
const {apYtdCalculate,apGuidedProjection,apGuidedMeta,apGuidedNotes}=ctx.api;
const v={sales:100000,salesD:-10,visD:-10,cr:20,crD:-5,upt:2,uptD:-5,asp:50,aspD:-5,atv:100,atvD:-5,ms:40,msD:-5};
const ac=apYtdCalculate(v);assert.ok(ac&&ac.visitsAC===5000,'Fixture AC invalida');
const scenarios=[['sales',110000],['visits',5500],['cr',22],['upt',2.2],['asp',55],['atv',110]];
for(const [name,target] of scenarios){
 const result=apGuidedProjection(name,target,v);
 assert.ok(result&&Math.abs(result.sales-100000)<.01,'Baseline AC modificata per '+name);
 assert.ok(Math.abs(result.forecast-110000)<1e-5,'Fatturato ipotetico errato per '+name);
 assert.ok(Math.abs(result.delta-10000)<1e-5,'Impatto KPI errato per '+name);
}
assert.equal(apGuidedProjection('upt',v.upt,v).delta,0,'Nessuna variazione richiesta');
assert.equal(apGuidedProjection('ms',60,v).forecast,null,'MS non ha proiezione causalmente determinabile');
assert.equal(apGuidedProjection('ms',60,v).base,40,'MS baseline AC');
for(const [k,target] of [['cr',101],['cr',0],['visits',5500.5],['upt',-1],['atv',0],['nonexistent',10]])assert.equal(apGuidedProjection(k,target,v),null,'Target non valido: '+k);
const meta={kpi:'cr',target:22,actions:['Accogliere'],tools:['Scheda cliente'],otherAction:'Invio promemoria',otherTool:'Altro sistema'};
const nextSteps='Rivedere gli indicatori ogni settimana.\nVerificare insieme i risultati.';
const stored=nextSteps+'\n[APOBJ2:'+btoa(encodeURIComponent(JSON.stringify(meta)))+']';
assert.equal(apGuidedNotes(stored),nextSteps,'NEXT STEPS non ripristinati');
assert.equal(JSON.stringify(apGuidedMeta(stored)),JSON.stringify(meta),'Metadati KPI non ripristinati');
assert.equal(apGuidedNotes('Nota storica'), 'Nota storica','Note legacy alterate');
assert.equal(apGuidedMeta('Nota storica'),null,'Nota legacy erroneamente trattata come wizard');
assert.ok(guided.includes("length>3"),'Limite 3 selezioni mancante');
assert.ok(guided.includes("if(currentUser?.role==='STORE'){actionPlanStoreDirty=true;++actionPlanStoreRevision}"),'Confermare un obiettivo deve avanzare la revisione del form NEGOZIO');
assert.ok(app.includes('actionPlanStoreRevision!==submittedRevision'),'Salvataggi in volo non devono perdere modifiche successive');
assert.ok(guided.includes("['SETTIMANALE','BISETTIMANALE','MENSILE','BIMESTRALE']"),'Frequenze monitoraggio mancanti');
for(const name of ['sales','visits','cr','upt','asp','atv','ms']){
 const pattern=new RegExp('(?:^|\\n) '+name+':\\{actions:\\[(.*?)\\],tools:\\[(.*?)\\]\\}', 's');
 const match=guided.match(pattern);assert.ok(match,'Mancano idee per '+name);
 assert.equal((match[1].match(/','/g)||[]).length+1,6,'Numero azioni errato per '+name);
 assert.equal((match[2].match(/','/g)||[]).length+1,6,'Numero strumenti errato per '+name);
}
console.log('PASS: KPI projections, guards, 6x6 suggestions, legacy notes, wizard metadata round-trip');
