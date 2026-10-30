import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const appSource=fs.readFileSync('assets/js/app.js','utf8');
const start=appSource.indexOf('async function submitNewCalendarEvent('),end=appSource.indexOf('function restoreLocalEvent(',start);
assert.ok(start>=0&&end>start);
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
let user={role:'ADMIN',id:'a'},state={events:[]},token='one',renderCount=0;
const replies=[],messages=[];
const env={window:{AgendaSession:{getToken:()=>token},agendaCloudApi:{request(){const d=deferred();replies.push(d);return d.promise}}},currentUser:user,app:state,
 confirmedCalendarEventId:response=>response?.event_id||'',
 optimisticReplaceEvent:(id,saved)=>{env.app.events=env.app.events.filter(x=>x.id!==id);env.app.events.push({id:saved.event_id})},
 calendarEventRequiresVerification:error=>['API_UNAVAILABLE','WRITE_CONFIRMATION_MISSING'].includes(error?.code),
 renderCalendar:()=>{renderCount++},toast:(message,error)=>messages.push({message,error}),
 removeSavedEvent:id=>{env.app.events=env.app.events.filter(x=>x.id!==id)},
 AgendaApiError:class extends Error{constructor(code,message){super(message);this.code=code}},String};
vm.createContext(env);
vm.runInContext(appSource.slice(start,end)+';this.submit=submitNewCalendarEvent;',env);
const temp=(id)=>({id});
const first=temp('TMP:one');state.events.push(first);
const old=env.submit({client_key:'one'},first,'Salvato');
const nextState={events:[]};env.currentUser={role:'ADMIN',id:'b'};env.app=nextState;token='two';
replies[0].resolve({event_id:'SERVER-OLD'});
await old;
assert.equal(nextState.events.length,0,'Old session creation acknowledgement must not insert into new account');
assert.equal(renderCount,0,'Old session acknowledgement must not render new account');
const current=temp('TMP:two');nextState.events.push(current);
const ok=env.submit({client_key:'two'},current,'Salvato');replies[1].resolve({event_id:'SERVER-NEW'});await ok;
assert.deepEqual(nextState.events.map(e=>e.id),['SERVER-NEW']);
const missing=temp('TMP:three');nextState.events.push(missing);
const noId=env.submit({client_key:'three'},missing,'Salvato');replies[2].resolve({});await noId;
assert.equal(nextState.events.find(e=>e.id==='TMP:three')?.pending_status,'unconfirmed');
assert.ok(messages.at(-1).error,'Missing server ID must not announce successful creation');
const failure=temp('TMP:four');nextState.events.push(failure);
const fail=env.submit({client_key:'four'},failure,'Salvato');replies[3].reject({code:'FORBIDDEN',message:'Non autorizzato'});await fail;
assert.ok(!nextState.events.some(e=>e.id==='TMP:four'),'Explicit server rejection removes optimistic entry');
console.log('PASS: calendar creation rejects previous sessions, missing IDs and denied writes');
