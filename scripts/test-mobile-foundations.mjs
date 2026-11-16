/* Livello telefono. Le regole stanno dentro un'unica media query sotto i 720px:
   fuori di li' non devono esistere, altrimenti il desktop cambierebbe. Il
   pannello filtri viene costruito eseguendo la funzione vera su un DOM finto. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const css=readFileSync('assets/css/app.css','utf8');
const righe=readFileSync('assets/js/app.js','utf8').split('\n');

// --- il blocco telefono esiste e contiene cio' che serve ---
const i=css.indexOf('@media screen and (max-width:720px){');
assert.notEqual(i,-1,'Manca il livello telefono');
const blocco=css.slice(i,css.indexOf('/* --------- filtri richiudibili',i));
assert.ok(/input,select,textarea\{font-size:16px\}/.test(blocco),
 'Sotto i 16px iOS ingrandisce la pagina a ogni tocco su un campo: il valore non e estetico');
assert.ok(/min-height:44px/.test(blocco),'Le aree di tocco devono arrivare a 44px');
assert.ok(/\.kpi-card span\{font-size:11px/.test(blocco),'Le etichette KPI erano a 9px');
assert.ok(/:has\(\.empty\)\{min-height:0\}/.test(blocco),'Un riquadro vuoto non deve tenere mezzo schermo');
assert.ok(/env\(safe-area-inset-bottom\)/.test(blocco),'Servono i margini di sicurezza su schermi con notch');

/* Alcune pagine RM hanno regole con specificita' di ID, es.
   :is(#page-rmholidays,...) .rm-toolbar label{display:grid;font-size:9px}.
   Senza priorita' esplicita il livello telefono viene ignorato proprio li',
   ed e' esattamente cio' che era successo. */
const idSuLabel=/:is\([^)]*#page-rm[^)]*\)[^{]*\.rm-toolbar label\{[^}]*display/.test(css);
assert.ok(idSuLabel,'Se questa regola sparisce, rivedere le priorita del livello telefono');
for(const regola of ['.rm-toolbar label,.holiday-period-toolbar label{font-size:11px!important}',
 '.mobile-filters:not(.open) label{display:none!important}'])
 assert.ok(css.includes(regola),`Serve priorita esplicita: ${regola}`);

// --- niente regole telefono fuori dalla media query ---
const fuori=css.slice(0,i);
assert.ok(!fuori.includes('.mobile-filters:not(.open)'),'Le regole del pannello non devono valere su desktop');
assert.ok(css.includes('.mobile-filters-toggle{display:none}'),'Fuori dal telefono il pulsante resta invisibile');

// --- il pannello filtri, eseguito davvero ---
const estrai=inizio=>{const k=righe.findIndex(x=>x.startsWith(inizio));assert.notEqual(k,-1,`Manca ${inizio}`);
 for(let n=1;n<=40;n++){const f=righe.slice(k,k+n).join('\n');try{new vm.Script(f);return f}catch{}}
 assert.fail(`Frammento non compilabile: ${inizio}`)};

function elemento(tag,cls){
 const e={tagName:tag.toUpperCase(),_cls:new Set(cls?cls.split(' '):[]),children:[],dataset:{},style:{},attrs:{},eventi:{},textContent:''};
 /* Il codice vero compone il pulsante con innerHTML: il DOM finto lo interpreta,
    altrimenti il riepilogo non esisterebbe e il test proverebbe un'altra cosa. */
 let _html='';
 Object.defineProperty(e,'innerHTML',{get:()=>_html,set:v=>{_html=v;e.children=[...String(v).matchAll(/<span class="([^"]+)"[^>]*>([^<]*)<\/span>/g)].map(m=>{const s=elemento('span',m[1]);s.textContent=m[2];return s})}});
 e.classList={add:c=>e._cls.add(c),contains:c=>e._cls.has(c),
  toggle:c=>{e._cls.has(c)?e._cls.delete(c):e._cls.add(c);return e._cls.has(c)}};
 e.setAttribute=(k,v)=>{e.attrs[k]=v}; e.getAttribute=k=>e.attrs[k];
 e.addEventListener=(k,fn)=>{(e.eventi[k]=e.eventi[k]||[]).push(fn)};
 e.emetti=k=>(e.eventi[k]||[]).forEach(fn=>fn());
 e.insertBefore=(n2)=>{e.children.unshift(n2)};
 Object.defineProperty(e,'firstChild',{get:()=>e.children[0]||null});
 e.discendenti=()=>e.children.flatMap(c=>[c,...(c.discendenti?c.discendenti():[])]);
 e.querySelectorAll=sel=>e.discendenti().filter(c=>c.tagName===sel.toUpperCase()||c._cls.has(sel.replace('.','')));
 e.querySelector=sel=>e.querySelectorAll(sel)[0]||null;
 return e;
}
const opzione=t=>({textContent:t});
const select=t=>{const s=elemento('select');s.selectedOptions=[opzione(t)];return s};
const label=s=>{const l=elemento('label');l.children.push(s);return l};
const bar=elemento('div','card rm-toolbar');
bar.children.push(label(select('TUTTA LA CATENA · Tutti i DM')),label(select('CONSOLIDATO')),label(select('2026')),label(select('Tutte le regioni')));

const ctx={document:{querySelectorAll:()=>[bar],createElement:t=>elemento(t)},window:{}};
vm.createContext(ctx);
for(const n of ['const MOBILE_FILTER_BARS=','function mobileFilterSummary(','function setupMobileFilters(']) vm.runInContext(estrai(n),ctx);
ctx.setupMobileFilters();

const toggle=bar.children[0];
assert.ok(bar.classList.contains('mobile-filters'),'La toolbar deve diventare un pannello');
assert.equal(toggle.tagName,'BUTTON','Il comando deve essere un pulsante, raggiungibile da tastiera');
assert.equal(toggle.type,'button','Dentro un form un pulsante senza type invierebbe il modulo');
assert.equal(toggle.getAttribute('aria-expanded'),'false','Il pannello parte chiuso: e cio che libera la prima schermata');
const riepilogo=bar.querySelector('.mff-summary');
assert.ok(riepilogo,'Serve la riga di riepilogo');
assert.equal(riepilogo.textContent,'TUTTA LA CATENA · Tutti i DM · CONSOLIDATO · 2026',
 'Chiuso, il pannello deve dire che filtri sono attivi, al massimo tre');
toggle.emetti('click');
assert.ok(bar.classList.contains('open')&&toggle.getAttribute('aria-expanded')==='true','Il pulsante apre il pannello');
toggle.emetti('click');
assert.ok(!bar.classList.contains('open')&&toggle.getAttribute('aria-expanded')==='false','E lo richiude');
ctx.setupMobileFilters();
assert.equal(bar.children.filter(c=>c.tagName==='BUTTON').length,1,'Richiamarlo non deve aggiungere un secondo pulsante');
const senzaFiltri=elemento('div','toolbar');
ctx.document.querySelectorAll=()=>[senzaFiltri];
ctx.setupMobileFilters();
assert.ok(!senzaFiltri.classList.contains('mobile-filters'),'Una toolbar di soli pulsanti non diventa un pannello filtri');

console.log('PASS: livello telefono confinato sotto i 720px e pannello filtri funzionante');
