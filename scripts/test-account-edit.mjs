/* Riquadro Account. Era in sola lettura: i profili DM, RM e SM non compaiono fra
   i negozi, quindi non esisteva alcun modo di disattivarli, e una password
   sbagliata non era correggibile da nessuna parte dell'interfaccia.
   Il test esegue la funzione vera con una finta API e controlla cosa chiama. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const righe=readFileSync('assets/js/app.js','utf8').split('\n');
const estrai=inizio=>{
 const i=righe.findIndex(x=>x.startsWith(inizio));
 assert.notEqual(i,-1,`Manca ${inizio}`);
 for(let n=1;n<=60;n++){const f=righe.slice(i,i+n).join('\n');try{new vm.Script(f);return f}catch{}}
 assert.fail(`Frammento non compilabile: ${inizio}`);
};

function apri(utente,{admin=true,io='ADM0001',errore=null,password='nuova'}={}){
 const chiamate=[],avvisi=[];
 let corpo='';
 const campi={'#acPw':{value:password},'#acActive':{checked:!!utente.active,onchange:null},
  '#acPwSave':{onclick:null},'#acClose':{onclick:null}};
 const ctx={
  userById:()=>utente,
  currentUser:{user_id:io,id:io},
  canCreateAdmins:()=>admin,
  profileRoleLabel:r=>String(r||''),
  esc:s=>String(s==null?'':s),
  showModal:(t,b)=>{corpo=b},
  closeModal:()=>chiamate.push(['closeModal']),
  toast:(m,err)=>avvisi.push([String(m),!!err]),
  renderUsers:()=>{},
  refreshCloudState:async()=>{chiamate.push(['refreshCloudState'])},
  ensureAdminUsers:async()=>{chiamate.push(['ensureAdminUsers'])},
  $:sel=>campi[sel]||null,
  window:{agendaCloudApi:{request:async(azione,payload)=>{chiamate.push([azione,payload]);if(errore)throw errore;return {}}}},
  console,String,Object,Promise
 };
 vm.createContext(ctx);
 vm.runInContext(estrai('function accountActionError(')+'\n'+estrai('function editUser(id){'),ctx);
 ctx.editUser('X');
 return {chiamate,avvisi,corpo,campi};
}

const dm={id:'U2',user_id:'ADM0007',username:'samanta',display_name:'Samanta Icario',email:'',password:0,active:true,profile_role:'DM',store_id:''};

// --- il campo password e modificabile e mostra cio che e memorizzato ---
const a=apri(dm);
assert.ok(!/id="acPw"[^>]*readonly/.test(a.corpo),'Per il profilo ADMIN la password deve essere modificabile');
assert.ok(a.corpo.includes('id="acPwSave"'),'Serve il comando per salvarla');
assert.ok(/id="acPw"[^>]*value="0"/.test(a.corpo),
 'Il campo deve mostrare il valore memorizzato, anche quando e il numero 0: e cosi che si vede il difetto');
await a.campi['#acPwSave'].onclick();
assert.deepEqual(a.chiamate[0],['resetProfilePassword',{user_id:'ADM0007',password:'nuova'}],
 'Per un profilo si usa resetProfilePassword');
assert.ok(a.chiamate.some(c=>c[0]==='ensureAdminUsers'),'L elenco va ricaricato, o lo stato credenziali resta il vecchio');
assert.ok(a.avvisi.some(([m,e])=>!e&&/password/i.test(m)),'Serve una conferma');

// --- una password vuota non parte ---
const vuota=apri(dm,{password:'   '});
await vuota.campi['#acPwSave'].onclick();
assert.equal(vuota.chiamate.filter(c=>c[0]==='resetProfilePassword').length,0,'Una password vuota non deve essere inviata');
assert.ok(vuota.avvisi.some(([m,e])=>e),'E deve avvisare');

// --- il negozio continua a passare dalla propria azione ---
const negozio=apri({...dm,store_id:'STO1',password:'x'});
await negozio.campi['#acPwSave'].onclick();
assert.deepEqual(negozio.chiamate[0],['resetStorePassword',{store_id:'STO1',password:'nuova'}],
 'Per un negozio resta resetStorePassword');

// --- attivazione ---
const stato=apri(dm);
assert.ok(/id="acActive"[^>]*checked/.test(stato.corpo),'La casella deve riflettere lo stato corrente');
stato.campi['#acActive'].checked=false;
await stato.campi['#acActive'].onchange({target:stato.campi['#acActive']});
assert.deepEqual(stato.chiamate[0],['setProfileActive',{user_id:'ADM0007',active:false}],
 'Per un profilo si usa setProfileActive');
const statoNegozio=apri({...dm,store_id:'STO1'});
statoNegozio.campi['#acActive'].checked=false;
await statoNegozio.campi['#acActive'].onchange({target:statoNegozio.campi['#acActive']});
assert.deepEqual(statoNegozio.chiamate[0],['updateStore',{store_id:'STO1',active:false}],
 'Per un negozio si usa updateStore');

/* Disattivare il proprio profilo significherebbe restare chiusi fuori. */
const proprio=apri({...dm,user_id:'ADM0001'},{io:'ADM0001'});
assert.ok(/id="acActive"[^>]*disabled/.test(proprio.corpo),'Il proprio profilo non deve essere disattivabile');
assert.ok(proprio.corpo.includes('stai operando'),'E va spiegato perche');

// --- chi non puo amministrare vede tutto in sola lettura ---
const semplice=apri(dm,{admin:false});
assert.ok(/id="acPw"[^>]*readonly/.test(semplice.corpo),'Senza permessi la password resta in sola lettura');
assert.ok(!semplice.corpo.includes('id="acPwSave"'),'E senza comando di salvataggio');
assert.ok(/id="acActive"[^>]*disabled/.test(semplice.corpo),'E senza possibilita di disattivare');

// --- se il backend non espone l azione, il messaggio dice perche ---
const vecchio=apri(dm,{errore:Object.assign(new Error('Azione non riconosciuta.'),{code:'UNKNOWN_ACTION'})});
vecchio.campi['#acActive'].checked=false;
await vecchio.campi['#acActive'].onchange({target:vecchio.campi['#acActive']});
assert.ok(vecchio.avvisi.some(([m,e])=>e&&/backend/i.test(m)),'Con backend non aggiornato il messaggio deve indicare la causa');
assert.equal(vecchio.campi['#acActive'].checked,true,'E la casella deve tornare com era');

console.log('PASS: riquadro Account con password modificabile e attivazione del profilo');
