import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync('assets/js/app.js','utf8');
const guide=readFileSync('assets/js/action-plan-guided.js','utf8');
const start=app.indexOf('function actionPlanPdfImageFit('),end=app.indexOf('\nfunction actionPlanPdfBytesToBase64(',start);
const calcStart=app.indexOf('const AP_YTD_DEF='),calcEnd=app.indexOf('function apYtdEuro(',calcStart);
const notesStart=guide.indexOf('function apGuidedMeta('),notesEnd=guide.indexOf('function apGuidedAmount(',notesStart);
assert.ok(start>=0&&end>start&&calcStart>=0&&calcEnd>calcStart&&notesStart>=0&&notesEnd>notesStart);
const dates=Array.from({length:13},(_,i)=>i);
const v={sales:147500,salesD:-6.1,visD:-8.3,cr:16.2,crD:-3.5,upt:1.9,uptD:1.5,asp:48.5,aspD:2.2,atv:92.15,atvD:3.7,ms:24000,msD:-1.1};
const b64=x=>Buffer.from(x,'utf8').toString('base64');
const objective=(i)=>({
 objective_text:'Aumentare UPT e completamento outfit '+i,
 actions:'Presentare secondo capo coerente, usare abbinamenti in cabina e allenare il team con simulazioni. '.repeat(2),
 tools:'Lookbook, scheda outfit, agenda briefing, monitoraggio KPI',
 status:i===1?'ACHIEVED':'IN_PROGRESS',
 notes:'Verificare ogni settimana i progressi con lo store manager. '+i,
 tasks:[{task:'Follow-up clienti e formazione settimanale '+i,owner:'Store Manager',timing_monitoraggio:'SETTIMANALE',tools:'CRM clienti, report UPT',checkpoints:[{date:'2026-11-10',contingency:'GREEN',note:'Controllare andamento'}]}]
});
const ctx={
 actionPlanStore:()=>({code:'1001',name:'Negozio Dimostrativo',region:'Nord Italia'}),
 actionPlanPeriodLabel:()=> 'NOVEMBRE 2026',
 fmtDate:()=> '03/11/2026',
 actionPlanStatusKey:s=>s||'IN_PROGRESS',
 actionPlanStatusLabel:s=>s==='ACHIEVED'?'Raggiunto':'In corso',
 actionPlanPct:(ach,total)=>total?ach/total*100:0,
 actionPlanPctFmt:n=>String(Math.round(n))+'%',
 Uint8Array,Number,String,Math,Array,Object,JSON,RegExp,atob,decodeURIComponent,encodeURIComponent,console
};
vm.createContext(ctx);
vm.runInContext(app.slice(calcStart,calcEnd)+'\n'+guide.slice(notesStart,notesEnd)+'\n'+app.slice(start,end)+'\nthis.build=buildActionPlanPdfBytes;',ctx);
function inspect(plan){
 const b=ctx.build(plan),src=Buffer.from(b).toString('latin1');
 assert.ok(b.length>4000,'PDF deve includere loghi e contenuto');
 assert.ok(src.startsWith('%PDF-1.4'),'Firma PDF');
 assert.ok(src.includes('/MediaBox [0 0 595.28 841.89]'),'Pagina A4 verticale');
 assert.ok(src.includes('/Count 1'),'Esattamente una pagina');
 assert.ok(src.includes('(ACTION PLAN)'),'Titolo PDF');
 assert.ok(src.includes('INCASSATO AC'),'Importi AC in grafico');
 assert.ok(src.includes('OBIETTIVI, AZIONI E MONITORAGGIO'),'Dettaglio obiettivi');
 assert.ok(src.includes('OWNER / TIMING'),'Responsabilita e frequenza');
 assert.ok(src.includes('NEXT STEPS / NOTE'),'Note di monitoraggio');
 assert.ok(src.includes('(YTD '),'Grafico YTD');
 assert.ok(src.includes('(PERIODO ACTION PLAN)'),'Grafico periodo');
 return src;
}
const premise='Analisi del distretto con situazione economica, traffico, conversione e opportunita. '.repeat(14);
const base={store_id:'1001',plan_date:'2026-11-03',period_year:2026,period_fraction:'NOVEMBRE',premise:premise+'\n[APYTD1:'+b64(JSON.stringify({...v,period:v})) +']'};
const simple=inspect({...base,objectives:[objective(1),objective(2)]});
assert.ok(simple.includes('(OBJ 1'),'Primo obiettivo');
const heavy=inspect({...base,premise:premise.repeat(5)+'\n[APYTD1:'+b64(JSON.stringify({...v,period:v}))+']',objectives:[1,2,3,4,5].map(objective)});
assert.ok(heavy.includes('(OBJ 5'),'Ultimo obiettivo non deve essere omesso');
assert.ok(!heavy.includes('NaN')&&!heavy.includes('Infinity'),'Coordinate PDF valide');
console.log('PASS: PDF A4 verticale 1 pagina, grafici YTD e periodo, analisi, obiettivi, azioni, strumenti, owner, timing e note');
