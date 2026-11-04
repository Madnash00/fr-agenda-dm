/* Verifica che lo SMALTIMENTO 31/12 segua la logica del file aziendale.
   Il riferimento sono righe reali (anonimizzate) del consolidato FR_Ferie_Dip:
   in esse %SMALT del file coincide con (SPETT - RESIDUO A.C.F/ANNO)/SPETT,
   non con TOT.GODUTO/SPETT, perche' TOT.GODUTO comprende anche le ferie AP godute. */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
const app=readFileSync('assets/js/app.js','utf8');

const body=app.slice(app.indexOf('function holidayConsolidatedDisposal('));
const fn=new Function('holidayConsolidatedNum',body.slice(0,body.indexOf('\n}')+2)+';return holidayConsolidatedDisposal;')
 (v=>{const n=Number(String(v??0).replace(/\s/g,'').replace('%','').replace(',','.'));return Number.isFinite(n)?n:0});

// [dipendente, TOT.GODUTO, RESIDUO A.C.F/ANNO, SPETT.31/12, %SMALT dichiarato dal file]
const rows=[
 ['A',111.0,43.75,154.75,71.72],
 ['B',130.0,55.70,185.70,70.00],
 ['C',192.5, 0.00,154.75,100.00],   // ha intaccato il residuo AP: goduto > spettanza
 ['D',122.5,187.00,309.50,39.58],
 ['E',284.0, 25.50,309.50,91.76],
 ['F',232.0,  0.02,216.52, 99.99],  // goduto > spettanza
 ['G', 42.0,190.11,232.11,18.09],
 ['H',242.5, 67.00,309.50,78.35],
];
for(const [name,used,residualAc,ent,expected] of rows){
 const got=fn(ent,residualAc);
 assert.ok(Math.abs(got-expected)<=0.6,`Smaltimento errato per ${name}: atteso ${expected}, ottenuto ${got.toFixed(2)}`);
 const wrong=used/ent*100;
 if(Math.abs(wrong-expected)>0.6)
  assert.ok(Math.abs(got-wrong)>0.6,`La formula vecchia (goduto/spettanza) non deve essere reintrodotta per ${name}`);
}
// Nessuna spettanza: il dato non e' calcolabile e non deve diventare 0%.
assert.strictEqual(fn(0,0),null,'Senza spettanza lo smaltimento deve essere nullo, non 0%');
assert.strictEqual(fn('',12),null,'Spettanza vuota deve dare valore nullo');
// Aggregato di distretto: la somma deve usare le stesse grandezze.
const ent=rows.reduce((n,r)=>n+r[3],0),res=rows.reduce((n,r)=>n+r[2],0),used=rows.reduce((n,r)=>n+r[1],0);
const agg=fn(ent,res);
assert.ok(Math.abs(agg-((ent-res)/ent*100))<1e-9,'Aggregato incoerente con la formula');
assert.ok(Math.abs(agg-(used/ent*100))>1,'Aggregato: la vecchia formula resta distinguibile e non deve tornare');
// La percentuale del file non e' piu' usata come fonte per il semaforo.
assert.ok(!/paceClass\(x\.disposal_pct\)/.test(app),'Il semaforo non deve usare la percentuale grezza del file');
console.log('PASS: smaltimento 31/12 coerente con il file aziendale su righe reali, aggregati e casi senza spettanza');
