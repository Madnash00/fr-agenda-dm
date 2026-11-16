/* Reimpostazione password dall'elenco Account.
   I negozi passavano da resetStorePassword; per DM, RM e SM non esisteva alcuna
   via: il cambio password serve solo a se stessi e richiede di essere gia'
   dentro, quindi un profilo che non riesce ad accedere restava irrecuperabile.
   Il test esegue la funzione vera con una finta API e controlla cosa chiama. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const righe=readFileSync('assets/js/app.js','utf8').split('\n');
const estrai=inizio=>{
 const i=righe.findIndex(x=>x.startsWith(inizio));
 assert.notEqual(i,-1,`Manca ${inizio}`);
 for(let n=1;n<=40;n++){const f=righe.slice(i,i+n).join('\n');try{new vm.Script(f);return f}catch{}}
 assert.fail(`Frammento non compilabile: ${inizio}`);
};

function prova(utente,{errore=null}={}){
 const chiamate=[];
 let corpo='',titolo='',avvisi=[];
 const form={};
 const ctx={
  userById:()=>utente,
  esc:s=>String(s==null?'':s),
  showModal:(t,b)=>{titolo=t;corpo=b},
  closeModal:()=>{chiamate.push(['closeModal'])},
  toast:(m,err)=>avvisi.push([String(m),!!err]),
  renderUsers:()=>{},
  ensureAdminUsers:async()=>{chiamate.push(['ensureAdminUsers'])},
  $:sel=>sel==='#pwNew'?{value:'000000'}:(sel==='#pwForm'?form:null),
  window:{agendaCloudApi:{request:async(azione,payload)=>{chiamate.push([azione,payload]);if(errore)throw errore;return {reset:true}}}},
  console,Promise,String,Object
 };
 ctx.window.agendaCloudApi.request=ctx.window.agendaCloudApi.request.bind(null);
 vm.createContext(ctx);
 vm.runInContext(estrai('function resetPassword('),ctx);
 ctx.resetPassword('X');
 return {chiamate,titolo,corpo,avvisi,form};
}

// --- profilo con negozio: percorso invariato ---
const negozio=prova({id:'U1',user_id:'U1',username:'pistoia',store_id:'STO1'});
assert.ok(negozio.titolo.includes('Reimposta password'),'La maschera deve aprirsi anche per i negozi');
await negozio.form.onsubmit({preventDefault(){}});
assert.deepEqual(negozio.chiamate[0],['resetStorePassword',{store_id:'STO1',password:'000000'}],
 'Per un negozio deve restare resetStorePassword');

// --- profilo DM: prima veniva rifiutato ---
const dm=prova({id:'U2',user_id:'ADM0007',username:'samanta',store_id:''});
assert.ok(dm.titolo.includes('Reimposta password'),'Anche un profilo DM deve poter essere reimpostato');
assert.ok(dm.corpo.includes('samanta'),'La maschera deve dire di quale account si tratta');
assert.equal(dm.avvisi.length,0,'Non deve piu comparire il rifiuto "usa Cambio password"');
await dm.form.onsubmit({preventDefault(){}});
assert.deepEqual(dm.chiamate[0],['resetProfilePassword',{user_id:'ADM0007',password:'000000'}],
 'Per un profilo deve essere chiamata resetProfilePassword con il proprio identificativo');
assert.ok(dm.chiamate.some(c=>c[0]==='ensureAdminUsers'),
 'Dopo la reimpostazione l elenco va ricaricato, altrimenti lo stato credenziali resta quello vecchio');
assert.ok(dm.avvisi.some(([m,e])=>!e&&/reimpostata/i.test(m)),'Serve una conferma');

// --- finche il backend non espone l azione, il messaggio deve dire perche ---
const vecchio=prova({id:'U2',user_id:'ADM0007',username:'samanta',store_id:''},
 {errore:Object.assign(new Error('Azione non riconosciuta.'),{code:'UNKNOWN_ACTION'})});
await vecchio.form.onsubmit({preventDefault(){}});
assert.ok(vecchio.avvisi.some(([m,e])=>e&&/backend/i.test(m)),
 'Con un backend non aggiornato il messaggio deve indicare la causa, non un errore generico');

// --- un errore qualsiasi resta leggibile ---
const altro=prova({id:'U2',user_id:'ADM0007',username:'samanta',store_id:''},
 {errore:Object.assign(new Error('Password troppo corta.'),{code:'VALIDATION_ERROR'})});
await altro.form.onsubmit({preventDefault(){}});
assert.ok(altro.avvisi.some(([m,e])=>e&&m==='Password troppo corta.'),'Gli altri errori vanno mostrati come sono');

console.log('PASS: password reimpostabile anche per i profili DM, RM e SM');
