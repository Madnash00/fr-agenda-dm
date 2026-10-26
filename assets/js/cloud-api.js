
/* CONFIGURAZIONE: dopo il deploy di Apps Script incolla qui l'URL che termina con /exec */
const AGENDA_API_ENDPOINT='https://script.google.com/macros/s/AKfycbx5aIQzE7YEwyctRMtTHPMMOxVw3vpIq2YQeayCW8LiFvKQfGf-tT98DvTU5oAJONwt0w/exec';
const EXPECTED_BACKEND_BUILD='2026-10-08-rm-iphone-icon-r31';
const STORE_CALENDAR_POLICY=Object.freeze({id:'STORE_DM_CONTEXT_OWN_SM_WRITE_V6',scope:'DM_FULL',view:'STORE_DM_ONLY_OTHER_STORES_V3',contractVersion:6,editableTrack:'SM',hideOtherStoreStoreAuthored:true,protected:true});
class AgendaApiError extends Error{constructor(code,message,requestId){super(message||code);this.name='AgendaApiError';this.code=code;this.requestId=requestId||null}}
const AgendaSession={TOKEN_KEY:'agenda.dm.token',USER_KEY:'agenda.dm.user',_token:'',_user:null,
 getToken(){try{return sessionStorage.getItem(this.TOKEN_KEY)||this._token||''}catch(_){return this._token||''}},
 getUser(){try{const stored=sessionStorage.getItem(this.USER_KEY);return stored?JSON.parse(stored):this._user}catch(_){return this._user}},
 setSession(token,user){this._token=String(token||'');this._user=user||null;try{sessionStorage.setItem(this.TOKEN_KEY,this._token);sessionStorage.setItem(this.USER_KEY,JSON.stringify(this._user))}catch(e){console.warn('Memoria Safari non disponibile: sessione valida fino alla chiusura della pagina.')}},
 clearSession(){this._token='';this._user=null;try{sessionStorage.removeItem(this.TOKEN_KEY);sessionStorage.removeItem(this.USER_KEY)}catch(_){}}};
const AGENDA_READ_CACHE_TTL=Object.freeze({
 getAgendaEvents:45000,getReportData:45000,getHolidayPlanning:60000,getHolidayPeriods:30000,getHolidayReport:90000,getHolidayConsolidated:90000,getHolidayConsolidatedReport:120000,
 getStoreOvertimeCheck:120000,getActionPlans:90000,getActionPlanReport:90000,getAuditBundle:45000,listStores:120000,listUsers:120000,getRegions:120000,
 getCalendar:30000,getStoreCalendarContext:30000,getStoreMenuConfig:120000,getProfileMenuConfig:120000,getProfileDirectory:120000,getRMCalendar:45000,getRMHolidayPlanning:60000,getRMHolidayReport:90000,getRMHolidayConsolidated:90000,getRMHolidayConsolidatedReport:120000,getRMOvertime:120000,getRMActionPlans:90000,getRMActionPlanReport:90000
});
const AGENDA_CACHE_STALE_FACTOR=6;
const AGENDA_CACHE_DOMAIN_BY_READ=Object.freeze({
 getCalendar:'calendar',getStoreCalendarContext:'calendar',getAgendaEvents:'calendar',getReportData:'calendar',
 getHolidayPlanning:'holiday',getHolidayPeriods:'holidayPeriods',getHolidayReport:'holiday',getHolidayConsolidated:'holidayConsolidated',getHolidayConsolidatedReport:'holidayConsolidated',
 getStoreOvertimeCheck:'overtime',getActionPlans:'actionPlan',getActionPlanReport:'actionPlan',
 getAuditLog:'audit',getExportLog:'audit',getAuditBundle:'audit',listStores:'directory',listUsers:'directory',getRegions:'directory',getStoreMenuConfig:'directory',getProfileDirectory:'directory',getRMCalendar:'calendar',getRMHolidayPlanning:'holiday',getRMHolidayReport:'holiday',getRMHolidayConsolidated:'holidayConsolidated',getRMHolidayConsolidatedReport:'holidayConsolidated',getRMOvertime:'overtime',getRMActionPlans:'actionPlan',getRMActionPlanReport:'actionPlan',getBootstrap:'directory'
});
const AGENDA_CACHE_INVALIDATION_BY_WRITE=Object.freeze({
 createEvent:['calendar','audit'],updateEvent:['calendar','audit'],deleteEvent:['calendar','audit'],
 saveHolidayPeriods:['holidayPeriods','audit'],createHolidayEmployee:['holiday','audit'],updateHolidayEmployee:['holiday','audit'],deleteHolidayEmployee:['holiday','audit'],saveHolidayPlanBatch:['holiday','audit'],
 importHolidayConsolidated:['holidayConsolidated','audit'],importStoreOvertimeCheck:['overtime','audit'],importPersonnelWorkHoursYtd:['overtime','audit'],saveActionPlan:['actionPlan','audit'],deleteActionPlan:['actionPlan','audit'],recordExport:['audit'],
 createAdmin:['directory','audit'],saveStoreMenuConfig:['directory','audit'],saveProfileMenuConfig:['directory','audit'],setProfileAdminFlag:['directory','audit'],createStore:['directory','calendar','holiday','holidayConsolidated','overtime','actionPlan','audit'],updateStore:['directory','calendar','holiday','holidayConsolidated','overtime','actionPlan','audit'],deactivateStore:['directory','calendar','holiday','holidayConsolidated','overtime','actionPlan','audit'],resetStorePassword:['directory','audit'],updateRegion:['directory','calendar','holiday','holidayConsolidated','overtime','actionPlan','audit'],commitStoreImport:['directory','calendar','holiday','holidayConsolidated','overtime','actionPlan','audit']
});
const AGENDA_SOFT_BUSY_ACTIONS=new Set(['getCalendar','getStoreCalendarContext','getAgendaEvents','getReportData','getHolidayPlanning','getHolidayPeriods','getHolidayReport','getHolidayConsolidated','getHolidayConsolidatedReport','getStoreOvertimeCheck','getActionPlans','getActionPlanReport','getAuditBundle','listStores','listUsers','getRegions','getProfileDirectory','getRMCalendar','getRMHolidayPlanning','getRMHolidayReport','getRMHolidayConsolidated','getRMHolidayConsolidatedReport','getRMOvertime','getRMActionPlans','getRMActionPlanReport','createEvent','updateEvent','deleteEvent','saveHolidayPlanBatch','saveActionPlan']);
function createAgendaApi({endpoint,fetchFn=globalThis.fetch,getToken=()=>'',onSessionExpired=()=>{}}={}){
 const responseCache=new Map(),inflight=new Map(),inflightControllers=new Set(),PERSIST_PREFIX='agenda.dm.fastcache.r28.';let requestEpoch=0;
 const readActions=new Set(['health','getSession','getBootstrap','getPrefetchBundle','getCalendar','getStoreCalendarContext','getAgendaEvents','getReportData','getAuditLog','getExportLog','getAuditBundle','getHolidayPlanning','getHolidayPeriods','getHolidayReport','getHolidayConsolidated','getHolidayConsolidatedReport','getStoreOvertimeCheck','getActionPlans','getActionPlanReport','listStores','listUsers','getRegions','getStoreMenuConfig','getProfileMenuConfig','getProfileDirectory','getRMCalendar','getRMHolidayPlanning','getRMHolidayReport','getRMHolidayConsolidated','getRMHolidayConsolidatedReport','getRMOvertime','getRMActionPlans','getRMActionPlanReport']);
 const stableKey=(action,payload)=>action+'|'+JSON.stringify(payload,Object.keys(payload).sort());
 const smallHash=str=>{let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)};
 const tokenScope=()=>smallHash(String(getToken()||'guest'));
 const persistentKey=key=>PERSIST_PREFIX+tokenScope()+'.'+smallHash(key);
 const domainOf=action=>AGENDA_CACHE_DOMAIN_BY_READ[action]||'misc';
 const readPersistent=key=>{try{const raw=sessionStorage.getItem(persistentKey(key));if(!raw)return null;const x=JSON.parse(raw);if(!x||Number(x.staleUntil||x.expires||0)<=Date.now()){sessionStorage.removeItem(persistentKey(key));return null}return x}catch(_){return null}};
 const prunePersistent=()=>{try{const prefix=PERSIST_PREFIX+tokenScope()+'.',items=[];for(let i=0;i<sessionStorage.length;i++){const k=sessionStorage.key(i);if(k&&k.startsWith(prefix)){try{const x=JSON.parse(sessionStorage.getItem(k)||'null');items.push([k,Number(x?.storedAt)||0])}catch(_){items.push([k,0])}}}items.sort((a,b)=>b[1]-a[1]);items.slice(48).forEach(([k])=>sessionStorage.removeItem(k))}catch(_){}};
 const writePersistent=(key,action,value,freshUntil,staleUntil)=>{try{const raw=JSON.stringify({value,freshUntil,staleUntil,domain:domainOf(action),storedAt:Date.now()});if(raw.length>850000)return;sessionStorage.setItem(persistentKey(key),raw);prunePersistent()}catch(_){}};
 const clearPersistent=domain=>{try{const prefix=PERSIST_PREFIX+tokenScope()+'.',keys=[];for(let i=0;i<sessionStorage.length;i++){const k=sessionStorage.key(i);if(!k||!k.startsWith(prefix))continue;if(!domain){keys.push(k);continue}try{const x=JSON.parse(sessionStorage.getItem(k)||'null');if(x?.domain===domain)keys.push(k)}catch(_){keys.push(k)}}keys.forEach(k=>sessionStorage.removeItem(k))}catch(_){}};
 const clearAllPersistent=()=>{try{const keys=[];for(let i=0;i<sessionStorage.length;i++){const k=sessionStorage.key(i);if(k?.startsWith(PERSIST_PREFIX))keys.push(k)}keys.forEach(k=>sessionStorage.removeItem(k))}catch(_){}};
 const clearCache=domain=>{if(!domain){requestEpoch++;inflightControllers.forEach(c=>c.abort());inflightControllers.clear();inflight.clear();responseCache.clear();clearAllPersistent();return}for(const [k,v] of responseCache)if(v?.domain===domain)responseCache.delete(k);clearPersistent(domain)};
 const invalidateForWrite=action=>(AGENDA_CACHE_INVALIDATION_BY_WRITE[action]||[]).forEach(clearCache);
 const remember=(action,key,value,ttl)=>{const freshUntil=Date.now()+ttl,staleUntil=freshUntil+Math.max(30000,ttl*(AGENDA_CACHE_STALE_FACTOR-1)),entry={value,freshUntil,staleUntil,domain:domainOf(action)};responseCache.set(key,entry);writePersistent(key,action,value,freshUntil,staleUntil);return value};
 async function request(action,data={}){
  if(!endpoint||endpoint.includes('INCOLLA_URL_'))throw new AgendaApiError('API_UNAVAILABLE','Configura AGENDA_API_ENDPOINT nell\'index.html.');
  const silent=!!data.__silent,force=!!data.__force,background=!!data.__background,explicitTtl=Number(data.__cacheTtl),payload={...data},sessionToken=String(getToken()||''),startedEpoch=requestEpoch;
  const assertCurrentSession=()=>{if(startedEpoch!==requestEpoch||String(getToken()||'')!==sessionToken)throw new AgendaApiError('STALE_SESSION','Richiesta della sessione precedente ignorata.')};
  delete payload.__silent;delete payload.__force;delete payload.__background;delete payload.__cacheTtl;if(window.AgendaAdminContext?.admin_mode){payload.admin_mode=true;payload.target_dm_id=window.AgendaAdminContext.target_dm_id;}
  const isRead=readActions.has(action),ttl=Number.isFinite(explicitTtl)?Math.max(0,explicitTtl):(AGENDA_READ_CACHE_TTL[action]||0),key=smallHash(sessionToken)+'|'+stableKey(action,payload),now=Date.now();
  if(isRead&&force)payload.__server_force=true;
  if(isRead&&!force&&ttl>0){
   const hit=responseCache.get(key);if(hit){if(hit.freshUntil>now)return hit.value;if(hit.staleUntil>now){if(!inflight.has(key))setTimeout(()=>request(action,{...data,__silent:true,__force:true,__background:true}).catch(()=>{}),0);return hit.value}}
   const disk=readPersistent(key);if(disk){const entry={value:disk.value,freshUntil:Number(disk.freshUntil||disk.expires||0),staleUntil:Number(disk.staleUntil||disk.expires||0),domain:disk.domain||domainOf(action)};responseCache.set(key,entry);if(entry.freshUntil>now)return entry.value;if(entry.staleUntil>now){if(!inflight.has(key))setTimeout(()=>request(action,{...data,__silent:true,__force:true,__background:true}).catch(()=>{}),0);return entry.value}}
  }
  if(isRead&&inflight.has(key))return inflight.get(key);
  const emitBusy=!silent&&!background&&!AGENDA_SOFT_BUSY_ACTIONS.has(action);const emitPageLoad=isRead&&!silent&&!background;
  const controller=isRead&&typeof AbortController!=='undefined'?new AbortController():null;if(controller)inflightControllers.add(controller);
  const task=(async()=>{
   if(emitBusy&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent('agenda-busy-start',{detail:{action}}));if(emitPageLoad&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent('agenda-page-loading-start',{detail:{action}}));
   try{
    let response;try{response=await fetchFn(endpoint,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,token:sessionToken,...payload}),redirect:'follow',...(controller?{signal:controller.signal}:{})})}catch(_){assertCurrentSession();throw new AgendaApiError('API_UNAVAILABLE','Connessione al servizio non riuscita. Su iPhone apri l’app con Safari, verifica la connessione e riprova.')}
    assertCurrentSession();let body;try{body=await response.json()}catch(_){assertCurrentSession();throw new AgendaApiError('API_UNAVAILABLE','Risposta API non valida.')}assertCurrentSession();
    if(!body?.ok){const err=new AgendaApiError(body?.error?.code||'API_ERROR',body?.error?.message||'Errore API.',body?.requestId);if(err.code==='SESSION_EXPIRED'){clearCache();onSessionExpired()}throw err}
    if(isRead&&ttl>0)remember(action,key,body.data,ttl);
    if(!isRead&&action!=='login')invalidateForWrite(action);
    return body.data;
   }finally{if(controller)inflightControllers.delete(controller);if(emitBusy&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent('agenda-busy-end',{detail:{action}}));if(emitPageLoad&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent('agenda-page-loading-end',{detail:{action}}))}
  })();
  if(isRead)inflight.set(key,task);
  try{return await task}finally{if(isRead&&inflight.get(key)===task)inflight.delete(key)}
 }
 function prime(action,data,value,ttlOverride){if(value===undefined||value===null)return;const payload={...(data||{})};delete payload.__silent;delete payload.__force;delete payload.__background;delete payload.__cacheTtl;const ttl=Math.max(1000,Number(ttlOverride)||AGENDA_READ_CACHE_TTL[action]||60000),key=tokenScope()+'|'+stableKey(action,payload);remember(action,key,value,ttl)}
 return{request,prime,clearCache,clearDomain:clearCache,login:(username,password)=>request('login',{username,password}),logout:()=>request('logout',{})}
}
const XLSX_CDN_URL='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
let xlsxLoaderPromise=null;
function ensureXlsx(){if(typeof XLSX!=='undefined')return Promise.resolve(XLSX);if(xlsxLoaderPromise)return xlsxLoaderPromise;xlsxLoaderPromise=new Promise((resolve,reject)=>{const sc=document.createElement('script');sc.src=XLSX_CDN_URL;sc.async=true;sc.onload=()=>typeof XLSX!=='undefined'?resolve(XLSX):reject(new Error('Motore Excel non disponibile.'));sc.onerror=()=>reject(new Error('Impossibile caricare il motore Excel.'));document.head.appendChild(sc)}).catch(err=>{xlsxLoaderPromise=null;throw err});return xlsxLoaderPromise}
const HEADER_MAP=new Map([['nome negozio','name'],['negozio','name'],['name','name'],['email','email'],['id','username'],['username','username'],['login','username'],['pw','password'],['password','password'],['regione','region'],['region','region'],['codice negozio','store_code'],['codice','store_code'],['store code','store_code']]);
function cleanHeader(v){return String(v??'').trim().toLocaleLowerCase('it-IT').replace(/\s+/g,' ')}
function normalizeImportHeaders(headers){return headers.map(h=>HEADER_MAP.get(cleanHeader(h))||'')}
function normalizeImportRows(matrix){if(!Array.isArray(matrix)||!matrix.length)throw new Error('File vuoto');const headers=matrix[0],keys=normalizeImportHeaders(headers),idIndex=headers.findIndex(h=>cleanHeader(h)==='id');for(const req of ['name','email','username','password','region'])if(!keys.includes(req))throw new Error(`Colonna obbligatoria mancante: ${req==='name'?'Negozio':req==='username'?'ID':req==='password'?'PW':req==='region'?'Regione':req}`);return matrix.slice(1).filter(r=>r.some(v=>String(v??'').trim()!=='')).map((r,i)=>{const o={row:i+2};keys.forEach((k,j)=>{if(k)o[k]=String(r[j]??'').trim()});if(idIndex>=0){const id=String(r[idIndex]??'').trim();o.username=id;o.store_code=id}return o})}
async function parseStoreWorkbook(file){await ensureXlsx();const data=await file.arrayBuffer(),wb=XLSX.read(data,{type:'array'}),sh=wb.Sheets[wb.SheetNames[0]];return normalizeImportRows(XLSX.utils.sheet_to_json(sh,{header:1,raw:false,defval:''}))}
window.AgendaSession=AgendaSession;window.parseStoreWorkbook=parseStoreWorkbook;window.agendaCloudApi=createAgendaApi({endpoint:AGENDA_API_ENDPOINT,getToken:()=>AgendaSession.getToken(),onSessionExpired:()=>AgendaSession.clearSession()});window.dispatchEvent(new Event('agenda-cloud-ready'));
