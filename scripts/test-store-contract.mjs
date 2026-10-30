import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync('assets/js/app.js','utf8');
const cloud=fs.readFileSync('assets/js/cloud-api.js','utf8');
const start=app.indexOf('function calendarLegacyStore('),end=app.indexOf('function storeCalendarReady()',start);
assert.ok(start>=0&&end>start&&end-start<6500,'STORE calendar contract isolation failed');
const policyId=cloud.match(/id:'(STORE_[^']+)'/)?.[1];
const scope=cloud.match(/scope:'([^']+)'/)?.[1];
const view=cloud.match(/view:'([^']+)'/)?.[1];
const version=Number(cloud.match(/contractVersion:(\d+)/)?.[1]);
assert.ok(policyId&&scope&&view&&version);
const ctx={Map,String,Number,Array,Object,console,
 currentUser:{role:'STORE',admin_id:'DM-1',store_id:'STORE-A'},
 STORE_CALENDAR_POLICY:{id:policyId,scope,view,contractVersion:version},
 storeVisitsVisibleToStores:false,storeVisitsVisibilityReady:false,storeCalendarDirectory:[],storeCalendarContract:null,app:{stores:[]},
 AgendaApiError:class extends Error{constructor(code,message){super(message);this.code=code}}
};
vm.createContext(ctx);
vm.runInContext(app.slice(start,end)+';this.validate=setStoreCalendarContract;this.snapshot=()=>({visible:storeVisitsVisibleToStores,ready:storeVisitsVisibilityReady,directory:storeCalendarDirectory.map(s=>s.id),appStores:app.stores.map(s=>s.id)});',ctx);
const valid={store_visits_visible_to_stores:true,store_calendar_policy:policyId,calendar_scope:scope,store_calendar_view:view,calendar_contract_version:version,admin_id:'DM-1',own_store_id:'STORE-A',regions:[],stores:[{store_id:'STORE-A',admin_id:'DM-1',active:true},{store_id:'STORE-B',admin_id:'DM-1',active:true}],store_count:2};
ctx.validate(valid);
assert.equal(ctx.snapshot().ready,true);
assert.equal(ctx.snapshot().visible,true);
assert.equal(ctx.snapshot().directory.length,2);
function rejectMutation(change,expectedCode){
 const before=JSON.stringify(ctx.snapshot()),beforeContract=ctx.storeCalendarContract;
 assert.throws(()=>ctx.validate({...valid,...change}),e=>e.code===expectedCode,'Expected '+expectedCode);
 assert.equal(JSON.stringify(ctx.snapshot()),before,'Invalid contract mutated STORE visibility or directory');
 assert.equal(ctx.storeCalendarContract,beforeContract,'Invalid contract replaced verified policy');
}
rejectMutation({store_count:3},'STORE_CALENDAR_SCOPE_INVALID');
rejectMutation({admin_id:'OTHER-DM'},'STORE_CALENDAR_ADMIN_INVALID');
rejectMutation({stores:[...valid.stores,{store_id:'STORE-C',admin_id:'OTHER-DM',active:true}],store_count:3},'STORE_CALENDAR_SCOPE_INVALID');
rejectMutation({store_visits_visible_to_stores:null},'STORE_VISIBILITY_CONTRACT_INVALID');
rejectMutation({own_store_id:'STORE-B'},'STORE_CALENDAR_OWN_STORE_INVALID');
rejectMutation({calendar_contract_version:version+1},'STORE_CALENDAR_VERSION_INVALID');
ctx.validate({...valid,store_visits_visible_to_stores:false});
assert.equal(ctx.snapshot().visible,false,'Valid hidden-SV policy must be accepted');
console.log('PASS: real STORE contract validation rejects cross-DM scopes and commits only complete verified policy');
