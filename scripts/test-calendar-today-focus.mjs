/* CALENDARIO: all'apertura della sezione ci si deve posizionare sulla settimana di
   oggi. Il difetto era che lo scorrimento veniva calcolato mentre la tabella era
   ancora nascosta: su un elemento non visibile offsetTop vale 0, quindi lo
   scorrimento restava a zero e il tentativo risultava comunque consumato. */
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

function prova({visibile,rigaTrovata=true}){
 const riga={offsetTop:900};
 const wrap={scrollTop:0,offsetParent:visibile?{}:null,offsetHeight:visibile?820:0,
  querySelector:()=>rigaTrovata?riga:null};
 const ctx={calendarInitialTodayFocusPending:true,$:sel=>sel==='#calendarWrap'?wrap:null,
  isoDate:d=>d.toISOString().slice(0,10),mondayOf:d=>d,Date,Math,Number,String,parseFloat,
  document:{documentElement:{}},getComputedStyle:()=>({getPropertyValue:()=>'60'})};
 vm.createContext(ctx);
 vm.runInContext(estrai('function focusCurrentCalendarWeek('),ctx);
 const esito=ctx.focusCurrentCalendarWeek(false);
 return {esito,scrollTop:wrap.scrollTop,pendente:ctx.calendarInitialTodayFocusPending};
}

const nascosto=prova({visibile:false});
assert.equal(nascosto.esito,false,'Con la tabella nascosta il posizionamento non puo riuscire');
assert.equal(nascosto.scrollTop,0,'Non si deve scorrere una tabella nascosta');
assert.equal(nascosto.pendente,true,'Il tentativo va rimandato, non consumato: e il difetto corretto');

const visibile=prova({visibile:true});
assert.equal(visibile.esito,true,'Con la tabella visibile il posizionamento deve riuscire');
assert.equal(visibile.scrollTop,900-60-4,'Si scorre fino alla riga di oggi, sotto l intestazione fissa');
assert.equal(visibile.pendente,false,'Riuscito il posizionamento, non resta nulla in sospeso');

const senzaRiga=prova({visibile:true,rigaTrovata:false});
assert.equal(senzaRiga.esito,false,'Se oggi non e fra le date mostrate non si scorre');
assert.equal(senzaRiga.pendente,true,'E il tentativo resta in sospeso');

/* L'aggancio all'apertura della sezione: senza, il posizionamento avverrebbe solo
   una volta dopo l'accesso, cioe' mentre la pagina e' ancora nascosta. */
const sw=estrai('function switchPage(page){');
assert.ok(sw.includes("if(page==='calendar')void openCalendarOnCurrentWeek();"),
 'Aprendo CALENDARIO ci si deve riposizionare sulla settimana corrente');
const open=estrai('async function openCalendarOnCurrentWeek(');
assert.ok(open.includes('isoDate(dates[0])<=today&&today<=isoDate(dates.at(-1))'),
 'Si verifica che oggi rientri nell intervallo mostrato');
assert.ok(open.includes('syncAnchor(calendarDefaultMonday())'),
 'Se oggi non rientra piu nell intervallo si torna a quello predefinito del ruolo');
assert.ok(open.includes('calendarInitialTodayFocusPending=true'),'Il posizionamento va richiesto a ogni apertura');
const def=estrai('function calendarDefaultMonday(');
assert.ok(def.includes("currentUser?.role==='ADMIN'?Math.max(1,cur.week-3):cur.week"),
 'L intervallo predefinito resta quello di prima: tre settimane di storico per il DM');

console.log('PASS: CALENDARIO si posiziona sulla settimana di oggi a ogni apertura');
