import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('assets/js/app.js','utf8');
const start=source.indexOf('const calendarSyncLatestByDate=new Map();'),end=source.indexOf('async function syncCalendarDateFromServer(',start);
assert.ok(start>0&&end>start);
function deferred(){let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j});return {promise,resolve,reject}}
const responses=[],cache=new Map(),state={events:[]};let envToken='session-one';
const env={Map,Set,Date,String,Number,Promise,console,app:state,calendarRangeFreshUntil:cache,currentUser:{role:'ADMIN'},window:{AgendaSession:{getToken:()=>envToken},agendaCloudApi:{request(){const d=deferred();responses.push(d);return d.promise}}},storeVisitsVisibilityReady:false,storeVisitsVisibleToStores:true,AgendaApiError:class extends Error{},syncStoreVisitVisibilityState(){},localEventFromServer:e=>({...e,id:String(e.event_id)}),setStoreCalendarContract(){}};
vm.createContext(env);
vm.runInContext(source.slice(start,end)+';this.syncTest=syncCalendarRangeFromServer;',env);
const old=env.syncTest('2026-10-01','2026-10-31',null,{force:true});
const newer=env.syncTest('2026-10-01','2026-10-31',null,{force:true});
responses[1].resolve({events:[{event_id:'NEW',event_date:'2026-10-04'}]});
await newer;
responses[0].resolve({events:[{event_id:'OLD',event_date:'2026-10-04'}]});
await old;
assert.deepEqual(state.events.map(e=>e.id),['NEW'],'Stale calendar range response must not overwrite newer data');
state.events.push({id:'TMP:KEY',client_key:'KEY',event_date:'2026-10-04',pending_status:'unconfirmed'});
const verified=env.syncTest('2026-10-01','2026-10-31',null,{force:true});
responses[2].resolve({events:[{event_id:'SERVER',client_key:'KEY',event_date:'2026-10-04'}]});
await verified;
assert.deepEqual(state.events.map(e=>e.id),['SERVER'],'Exact client key must reconcile a pending local event');
state.events.push({id:'TMP:ANOTHER',client_key:'ANOTHER',event_date:'2026-10-04',pending_status:'unconfirmed'});
const unmatched=env.syncTest('2026-10-01','2026-10-31',null,{force:true});
responses[3].resolve({events:[{event_id:'SERVER-2',event_date:'2026-10-04'}]});
await unmatched;
assert.ok(state.events.some(e=>e.id==='TMP:ANOTHER'),'An unrelated event must not reconcile by matching date');

const overlapOld=env.syncTest('2026-11-01','2026-11-03',null,{force:true});
const overlapNew=env.syncTest('2026-11-02','2026-11-04',null,{force:true});
responses[5].resolve({events:[{event_id:'NEW-OVERLAP',event_date:'2026-11-02'}]});
await overlapNew;
responses[4].resolve({events:[{event_id:'OLD-ONLY',event_date:'2026-11-01'},{event_id:'OLD-OVERLAP',event_date:'2026-11-02'}]});
await overlapOld;
assert.ok(state.events.some(e=>e.id==='NEW-OVERLAP'),'Newer overlapping date must survive');
assert.ok(state.events.some(e=>e.id==='OLD-ONLY'),'Non-overlapping date from older request must remain available');
assert.ok(!state.events.some(e=>e.id==='OLD-OVERLAP'),'Older overlapping result must not overwrite');


const beforeSessionEvents=state.events.map(e=>e.id);
const obsolete=env.syncTest('2026-12-01','2026-12-02',null,{force:true});
envToken='session-two';
responses[6].resolve({events:[{event_id:'FOREIGN',event_date:'2026-12-01'}]});
await obsolete;
assert.deepEqual(state.events.map(e=>e.id),beforeSessionEvents,'Old account response must not mutate calendar');
envToken='session-one';
console.log('PASS: calendar range overlap, session isolation and exact-key reconciliation');

const storeRequests=[];
let storeToken='store-session',storeRenders=0;
const storeState={events:[{id:'SV-OLD',event_date:'2026-11-05',event_type:'STORE_VISIT'},{id:'NOTE-OLD',event_date:'2026-11-05',event_type:'NOTE'}],stores:[{id:'S1'}]};
const storeEnv={
 Map,Set,Date,String,Number,Promise,console,
 app:storeState,currentUser:{role:'STORE',store_id:'S1'},calendarRangeFreshUntil:new Map(),
 storeVisitsVisibilityReady:true,storeVisitsVisibleToStores:true,calendarSyncContractRevision:0,
 window:{AgendaSession:{getToken:()=>storeToken},agendaCloudApi:{request(){const d=deferred();storeRequests.push(d);return d.promise}}},
 AgendaApiError:class extends Error{},localEventFromServer:e=>({...e,id:String(e.event_id)}),
 setStoreCalendarContract(cal){if(typeof cal?.store_visits_visible_to_stores!=='boolean')throw new Error('invalid contract');storeEnv.storeFlagsUpdate(cal.store_visits_visible_to_stores)},syncStoreVisitVisibilityState(){},
 storeCalendarReady:()=>true,renderCalendar:()=>{storeRenders++},toast(){}
};
vm.createContext(storeEnv);
vm.runInContext(source.slice(start,end)+';this.syncStoreTest=syncCalendarRangeFromServer;this.storeFlags=()=>({ready:storeVisitsVisibilityReady,visible:storeVisitsVisibleToStores});',storeEnv);
storeEnv.storeFlagsUpdate=visible=>{storeEnv.storeVisitsVisibilityReady=Boolean(visible||!visible);storeEnv.storeVisitsVisibleToStores=visible};
const oldStore=storeEnv.syncStoreTest('2026-11-05','2026-11-05',null,{force:true});
const newStore=storeEnv.syncStoreTest('2026-11-05','2026-11-05',null,{force:true});
storeRequests[0].reject(new Error('old response failure'));
await assert.rejects(oldStore);
assert.equal(storeEnv.storeFlags().ready,true);assert.equal(storeEnv.storeFlags().visible,true,'Superseded failure must not revoke newer policy');
storeRequests[1].reject(new Error('current contract unavailable'));
await assert.rejects(newStore);
assert.equal(storeEnv.storeFlags().ready,false);assert.equal(storeEnv.storeFlags().visible,false,'Current contract failure must fail closed');
assert.ok(!storeState.events.some(e=>e.event_type==='STORE_VISIT'),'Old SV must be removed on current STORE failure');
assert.ok(storeState.events.some(e=>e.event_type==='NOTE'),'Non-SV events should not be indiscriminately discarded');
assert.ok(storeRenders>0,'The UI should reflect fail-closed state');
// After an outage, a verified response must restore visibility and reconcile the affected range.
const recovery=storeEnv.syncStoreTest('2026-11-05','2026-11-05',null,{force:true});
storeRequests[2].resolve({store_visits_visible_to_stores:true,events:[
 {event_id:'SV-RECOVERED',event_date:'2026-11-05',event_type:'STORE_VISIT'},
 {event_id:'NOTE-RECOVERED',event_date:'2026-11-05',event_type:'NOTE'}
]});
await recovery;
assert.equal(storeEnv.storeFlags().ready,true,'A verified response must restore readiness');
assert.equal(storeEnv.storeFlags().visible,true,'A verified visible policy must restore SV display');
assert.ok(storeState.events.some(e=>e.id==='SV-RECOVERED'),'Recovered SV must reappear after authorized refresh');
const hidden=storeEnv.syncStoreTest('2026-11-05','2026-11-05',null,{force:true});
storeRequests[3].resolve({store_visits_visible_to_stores:false,events:[
 {event_id:'SV-MUST-NOT-RENDER',event_date:'2026-11-05',event_type:'STORE_VISIT'},
 {event_id:'NOTE-VISIBLE',event_date:'2026-11-05',event_type:'NOTE'}
]});
await hidden;
assert.equal(storeEnv.storeFlags().visible,false,'A verified hidden policy must be respected');
assert.ok(!storeState.events.some(e=>e.event_type==='STORE_VISIT'),'SV must be filtered even if backend returns SV with hidden policy');
assert.ok(storeState.events.some(e=>e.id==='NOTE-VISIBLE'),'Authorized notes should remain usable');
console.log('PASS: STORE visibility fails closed and superseded failures cannot revoke newer state');

