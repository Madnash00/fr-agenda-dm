import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/js/app.js','utf8');
const a=source.indexOf('const AP_YTD_DEF=');
const b=source.indexOf('/* Adatta un solo step',a);
assert.ok(a>=0&&b>a,'YTD module bounds changed');
const valueSet={sales:'150.000,00',salesD:'−10,5%',visD:'−8,9%',cr:'11.2%',crD:'−3,2%',upt:'1.75',uptD:'2,1%',asp:'59.50',aspD:'1,2%',atv:'104,13',atvD:'3,3%',ms:'25.000,00',msD:'1,1%'};
const field={classList:{toggle(){}}};
const nodes={};
for(const prefix of ['apy-','app-']){
 for(const [key,value] of Object.entries(valueSet))nodes[prefix+key]={value,closest:()=>field};
 nodes[prefix+'output']={innerHTML:''};
 nodes[prefix+'next']={disabled:true};
}
let paints=0;
const context={document:{getElementById:id=>nodes[id]||null},requestAnimationFrame:()=>{paints++},esc:x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;'),Number,String,Math,Array,Object,JSON,RegExp,Intl,console};
vm.createContext(context);
vm.runInContext(source.slice(a,b)+';this.api={apYtdParse,apYtdRead,apYtdCalculate,apYtdValidation,apYtdRender};',context);
const {apYtdParse,apYtdRead,apYtdCalculate,apYtdRender}=context.api;
assert.equal(apYtdParse('1.75','upt'),1.75,'UPT decimal with point');
assert.equal(apYtdParse('1,75','upt'),1.75,'UPT decimal with comma');
assert.equal(apYtdParse('1.500','sales'),1500,'Sales thousands with point');
assert.equal(apYtdParse('−8,9%','visD'),-8.9,'Unicode minus from copied report');
assert.equal(apYtdParse('€ 1.234,50','sales'),1234.5,'Localized money');
assert.equal(apYtdParse('—','cr'),Number.NaN,'Unfilled placeholder must be invalid');
for(const prefix of ['apy-','app-']){
 apYtdRender(prefix);
 assert.equal(nodes[prefix+'next'].disabled,false,'Proceed button disabled for '+prefix);
 assert.ok(nodes[prefix+'output'].innerHTML.includes('apy-impact-chart'),'Impact missing for '+prefix);
 assert.ok(apYtdCalculate(apYtdRead(prefix)), 'Calculation invalid for '+prefix);
}
assert.ok(paints>=2,'Chart should trigger a viewport fit after updating');
nodes['apy-upt'].value='';
apYtdRender('apy-');
assert.equal(nodes['apy-next'].disabled,true,'Missing UPT must disable next');
assert.match(nodes['apy-output'].innerHTML,/UPT AC/,'Error must identify specific missing KPI');
nodes['apy-upt'].value='1,75';
apYtdRender('apy-');
assert.equal(nodes['apy-next'].disabled,false,'Fixed UPT must enable next again');
assert.ok(nodes['apy-output'].innerHTML.includes('apy-impact-chart'),'Chart must return when values fixed');
nodes['apy-cr'].value='125';
apYtdRender('apy-');
assert.equal(nodes['apy-next'].disabled,true,'Invalid CR must block next');
assert.match(nodes['apy-output'].innerHTML,/CR AC/);
nodes['apy-cr'].value='11,2';
apYtdRender('apy-');
assert.equal(nodes['apy-next'].disabled,false,'Valid CR must restore next');
assert.ok(source.includes("el.addEventListener('input',()=>apYtdRender())"),'Live YTD input listener must remain connected');
assert.ok(source.includes("el.addEventListener('change',()=>apYtdRender())"),'YTD change listener must remain connected');
assert.ok(source.includes("el.addEventListener('input',()=>apYtdRender('app-'))"),'Period inputs must also recalculate');
assert.ok(source.includes("if(step===1)apYtdRender()"),'Opening YTD must update current values');
console.log('PASS: Action Plan YTD auto impact, localized values, field-level errors and next-step recovery');
