/* Gestione Profili · eccezioni per singolo utente (frontend).
   La regola vera sta nel backend V19, che consegna a ogni utente il menu gia
   corretto e blocca le azioni: qui si verifica che la maschera ADMIN mostri,
   modifichi e salvi le eccezioni senza toccare il resto. Nomi finti. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync('assets/js/app.js','utf8'),css=readFileSync('assets/css/app.css','utf8'),api=readFileSync('assets/js/cloud-api.js','utf8');
const estrai=inizio=>{const r=app.split('\n'),i=r.findIndex(x=>x.startsWith(inizio));assert.notEqual(i,-1,`Manca ${inizio}`);
 for(let n=1;n<=60;n++){const f=r.slice(i,i+n).join('\n');try{new vm.Script(f);return f}catch{}}assert.fail(inizio)};
const ctx={Object,JSON,String};vm.createContext(ctx);
vm.runInContext('var profileOverridesDraft={D3:{profile:"DM",items:{report:false,audit:true}}};',ctx);
for(const n of ['function profileOverrideLabel(','function profileOverrideCount('])vm.runInContext(estrai(n),ctx);
assert.equal(ctx.profileOverrideCount('D3'),2,'Conta le eccezioni di un utente');
assert.equal(ctx.profileOverrideCount('D9'),0,'Zero per chi non ne ha');
assert.equal(ctx.profileOverrideLabel('NEGOZIO',{name:'PROVA',code:'45001',dm:'Dm Uno'}),'45001 · PROVA · Dm Uno','I negozi si riconoscono da codice, nome e DM');
assert.equal(ctx.profileOverrideLabel('DM',{name:'Dm Uno',admin:true}),'Dm Uno · flag ADMIN','Il flag ADMIN e dichiarato');

const box=estrai('function renderProfileExceptionsBox(');
assert.ok(box.includes('<option value="" ${v===undefined?\'selected\':\'\'}>Come profilo</option>')&&box.includes('Attiva per lui/lei')&&box.includes('Spenta per lui/lei'),'Tre scelte per voce: come profilo, attiva, spenta');
assert.ok(box.includes("if(el.value==='')delete cur.items[key];else cur.items[key]=el.value==='on';")&&box.includes('else delete profileOverridesDraft[id]'),'Tornare a "come profilo" toglie davvero l eccezione');
assert.ok(box.includes('Ha il flag ADMIN'),'Avvisa che sugli ADMIN le eccezioni non agiscono');
assert.ok(box.includes('profileOverrideProfileOn(r,k)'),'Mostra lo stato del profilo, anche se appena cambiato e non salvato');
const render=estrai('function renderStoreMenuSettings(');
assert.ok(render.includes('data-override-box="${r}"')&&render.includes('Object.keys(PROFILE_MENU_GROUPS).forEach(renderProfileExceptionsBox)'),'Ogni profilo configurabile ha il suo riquadro eccezioni');
assert.ok(render.includes('if(profileOverridesDraft===null)profileOverridesDraft=JSON.parse(JSON.stringify(profileMenuConfig?.user_overrides||{}))'),'La bozza parte da quanto salvato, in copia');
const save=estrai('async function saveStoreMenuSettings(');
assert.ok(save.includes("request('saveProfileMenuConfig',{enabled,user_overrides:profileOverridesDraft||{}})")&&save.includes('profileOverridesDraft=null'),'Le eccezioni si salvano con lo stesso pulsante, poi si rilegge il salvato');
assert.ok(estrai('function profileMenuAllowed(').includes('profileMenuConfig?.enabled?.[role]?.[page]'),'Il menu dell utente usa la configurazione gia personalizzata dal backend');
assert.ok(/\.profile-exc-row\.is-exception\{/.test(css),'Le eccezioni sono evidenziate');
assert.ok(/EXPECTED_BACKEND_BUILD='2026-11-20-fatturato-settimanale-v20'/.test(api),'Attende il backend corrente');
console.log('PASS: Gestione Profili, eccezioni per singolo utente nella maschera ADMIN');
