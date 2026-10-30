import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync('assets/js/app.js','utf8');
const begin=code.indexOf('async function saveActionPlanForm(');
const end=code.indexOf('function actionPlanPdfImageFit(',begin);
assert.ok(begin>=0&&end>begin&&end-begin<9000,'Cannot isolate Action Plan save handler');
function deferred(){let resolve,reject;const promise=new Promise((ok,bad)=>{resolve=ok;reject=bad});return {promise,resolve,reject}}
const requests=[],toasts=[],buttons=[{disabled:false,isConnected:true},{disabled:false,isConnected:true}];
const form={dataset:{planId:''},isConnected:true,querySelectorAll:()=>buttons};
const fields={
 '#actionPlanForm':form,
 '#apDate':{value:'2026-10-30'},
 '#apYear':{value:'2026'},
 '#apFraction':{value:'Q4'},
 '#apPremise':{value:'Dati sintetici per test'}
};
let closeCount=0,renderCount=0;
const ctx={
 window:{agendaCloudApi:{request:(action,payload)=>{
  assert.equal(action,'saveActionPlan');
  const next=deferred();requests.push({payload,step:next});return next.promise;
 }}},
 currentUser:{role:'STORE'},actionPlanStoreSaving:false,actionPlanStoreDirty:true,actionPlanStoreRevision:0,
 actionPlanDraftStoreId:'SYNTHETIC',actionPlanDraftObjectives:[],actionPlanCache:{plans:[]},actionPlanLoadSequence:0,actionPlanReportCache:null,
 $:(key)=>fields[key],
 apCaptureOpenObjectiveDraft(){},
 apYtdRead(){return {sales:1000}},
 apYtdCalculate(){return {valid:true}},
 actionPlanStatusKey:x=>x,
 btoa:s=>Buffer.from(s,'utf8').toString('base64'),
 toast:(message,error=false)=>toasts.push({message,error}),
 closeModal:()=>{closeCount++;form.isConnected=false},
 renderActionPlans:()=>renderCount++,
 AP_TIMING_OPTIONS:[],
 String,Number,JSON,Boolean,Array,Promise,Error,console
};
vm.createContext(ctx);
vm.runInContext(code.slice(begin,end)+';this.saveForTest=saveActionPlanForm;',ctx);
const event={preventDefault(){}};

// New draft: rapid second click while pending must not cause duplicate API calls.
const pending=ctx.saveForTest(event,null,true);
await ctx.saveForTest(event,null,true);
assert.equal(requests.length,1,'Duplicate submit must be ignored while saving');
assert.equal(buttons[0].disabled,true,'Buttons disabled while writing');
// The user can edit while write is in flight; server reply must not close the editor.
ctx.actionPlanStoreRevision=1;
requests[0].step.resolve({plan_id:'P-001',store_id:'SYNTHETIC',plan_date:'2026-10-30'});
await pending;
assert.equal(closeCount,0,'A previous version must not close a newly edited form');
assert.equal(form.dataset.planId,'P-001','Must remember server-created ID for subsequent save');
assert.equal(ctx.actionPlanStoreDirty,true,'Later edits must stay marked dirty');
assert.equal(buttons[0].disabled,false,'Buttons must be restored after write');
assert.ok(toasts.at(-1).message.includes('modifiche successive'));

// Next save uses the server ID, not a second create.
const second=ctx.saveForTest(event,form.dataset.planId,true);
assert.equal(requests[1].payload.plan_id,'P-001');
requests[1].step.resolve({plan_id:'P-001',store_id:'SYNTHETIC',plan_date:'2026-10-30'});
await second;
assert.equal(closeCount,1,'Editor should close after fully confirmed latest version');
assert.equal(ctx.actionPlanCache.plans.length,1);
assert.equal(ctx.actionPlanCache.plans[0].plan_id,'P-001');

// Incomplete acknowledgement must not appear as success or close the editing form.
form.isConnected=true;const previousClose=closeCount;
const third=ctx.saveForTest(event,null,true);
requests[2].step.resolve({store_id:'SYNTHETIC'});
await third;
assert.equal(closeCount,previousClose);
assert.ok(toasts.at(-1).error);
assert.ok(toasts.at(-1).message.includes('Risposta di salvataggio incompleta'));
console.log('PASS: STORE Action Plan double-submit, in-flight edits, ID reuse and missing acknowledgement');
