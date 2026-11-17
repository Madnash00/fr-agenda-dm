/* FERIE DM · Scarica Excel, Scarica PDF e scala colore dello smaltimento.
   Si eseguono le funzioni vere su dati finti (nessun nome reale) e si
   controllano i file prodotti: struttura, contenuto, coerenza con la pagina.
   Con FERIE_EXPORT_OUT=<cartella> salva anche i due file per una verifica a vista. */
import assert from 'node:assert';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync('assets/js/app.js','utf8'),fer=readFileSync('assets/js/ferie-dm.js','utf8');
const html=readFileSync('index.html','utf8'),css=readFileSync('assets/css/app.css','utf8');
const estrai=(testo,inizio)=>{const r=testo.split('\n'),i=r.findIndex(x=>x.startsWith(inizio));
 assert.notEqual(i,-1,`Manca ${inizio}`);
 for(let n=1;n<=80;n++){const f=r.slice(i,i+n).join('\n');try{new vm.Script(f);return f}catch{}}
 assert.fail(`Frammento non compilabile: ${inizio}`)};
const host={};
const nodo=()=>({innerHTML:'',textContent:'',className:'',value:'',classList:{toggle(){},add(){},remove(){}},querySelectorAll:()=>[]});
const avvisi=[];
const ctx={Number,String,Math,Array,Object,Map,Set,Date,JSON,console,isNaN,parseInt,Uint8Array,TextEncoder,atob:s=>Buffer.from(s,'base64').toString('binary'),
 DAYS:['DOM','LUN','MAR','MER','GIO','VEN','SAB'],
 MONTHS:['GENNAIO','FEBBRAIO','MARZO','APRILE','MAGGIO','GIUGNO','LUGLIO','AGOSTO','SETTEMBRE','OTTOBRE','NOVEMBRE','DICEMBRE'],
 $:sel=>host[sel]||(host[sel]=nodo()),toast:(m,e)=>avvisi.push([m,!!e]),currentUser:{role:'RM'},isRetailManager:()=>true,isSuperAdmin:()=>false,setTimeout,clearTimeout,Promise,Intl};
vm.createContext(ctx);
for(const n of ['function esc(','function addDays(','function isoDate(','function parseDate(','function fmtDate(','function isoWeekInfo(',
 'const IT_FIXED_HOLIDAYS=','const itEasterCache=','function itEasterSunday(','function itHolidayName(',
 'function holidayHours(','function holidayHoursFmt(','function holidayPctClass(','function holidayYearDates(','function holidayRuns(',
 'function xmlEsc(','function colName(','function crc32(','function le16(','function le32(','function concatBytes(','function zipStore(',
 'function planningSet(','function planningCellXml(','function planningSheetXml(',
 'const ACTION_PLAN_FR_JPEG_B64=','const ACTION_PLAN_MIROGLIO_JPEG_B64=','const ACTION_PLAN_FR_JPEG_SIZE=','function actionPlanPdfBase64Bytes(','function actionPlanPdfCp1252Char(',
 'function actionPlanPdfBytesFromText(','function actionPlanPdfConcat(','function actionPlanPdfEscape(','function actionPlanPdfBuildObject(','function actionPlanPdfBuildStreamObject('])vm.runInContext(estrai(app,n),ctx);
vm.runInContext(fer,ctx);

// --- scala colore dello smaltimento: dal rosso al verde, tutte le gradazioni ---
const col=p=>ctx.dmFerieSmaltColor(p);
assert.equal(col(0).hue,0,'0% e rosso');assert.equal(col(100).hue,125,'100% e verde');
assert.ok(col(50).hue>50&&col(50).hue<75,'a meta strada il giallo');
let prima=-1;for(let p=0;p<=100;p+=0.5){const h=col(p).hue;assert.ok(h>prima,`La tonalita cresce in modo continuo (${p}%)`);prima=h}
assert.equal(col(140).hue,125,'oltre il 100% resta verde');assert.equal(col(-5).hue,0,'sotto lo 0 resta rosso');
assert.equal(col('x').hue,0,'un valore non numerico non rompe il quadro');
const [r0,g0]=col(0).fg,[r1,g1]=col(100).fg;assert.ok(r0>g0&&g1>r1,'il testo segue la stessa scala dello sfondo');
for(const p of [0,30,62,100]){const c=col(p),lum=x=>x.reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);assert.ok(lum(c.bg)-lum(c.fg)>110,`Testo leggibile sullo sfondo a ${p}%`)}
const pill=ctx.dmFerieSmaltPill(47.25);
assert.ok(pill.includes('dm-smalt-pill')&&pill.includes('47,3%')&&/background:rgb\(\d+,\d+,\d+\)/.test(pill),'La pillola mostra la percentuale in formato italiano, con il suo colore');
assert.ok(/\.dm-smalt-pill\{[^}]*border-radius:999px/.test(css),'La pillola e arrotondata, come nell esempio');

// --- dati finti ---
const st=vm.runInContext('dmFerieState',ctx);
st.data={year:2026,dms:[
 {dm_id:'D1',display_name:'Mario Rossi',residual_ap_hours:-10,projected_ac_hours:100,editable:true},
 {dm_id:'D2',display_name:'Anna Bianchi',residual_ap_hours:5,projected_ac_hours:200,editable:false},
 {dm_id:'D3',display_name:'Luca Verdi Con Un Nome Lunghissimo Davvero',residual_ap_hours:0,projected_ac_hours:0,editable:false}],
 plan:[{dm_id:'D1',plan_date:'2026-04-03',hours:8},{dm_id:'D1',plan_date:'2026-05-04',hours:3.5},{dm_id:'D2',plan_date:'2026-04-03',hours:8},
  {dm_id:'D2',plan_date:'2026-08-10',hours:8},{dm_id:'D2',plan_date:'2026-08-11',hours:0.25},{dm_id:'D1',plan_date:'2026-12-31',hours:8}],
 closures:[{date:'2026-04-03',label:'Ponte (prova)'},{date:'2026-12-31',label:''}]};
st.year=2026;ctx.dmFerieIndex();
/* una modifica appena digitata e non ancora salvata deve finire nel file, come in pagina */
st.planMap.set('D1|2026-02-16',4);st.totals.D1+=4;

const now=new Date(2026,10,17,9,5);
const m=ctx.dmFerieExportModel(now);
assert.equal(m.months.length,12,'Dodici mesi, uno sotto l altro');
assert.deepEqual(m.months.map(x=>x.days.length),[31,28,31,30,31,30,31,31,30,31,30,31],'Ogni mese con i suoi giorni');
assert.equal(m.recap.length,3,'Nel quadro tutti i DM della pagina');
assert.equal(m.recap[0].planned,23.5,'Ore programmate comprese le modifiche appena digitate');
assert.equal(m.recap[0].residual,90-23.5,'Residuo come in pagina');
assert.equal(m.tot.total,295,'Totale del quadro');
assert.ok(Math.abs(m.tot.pct-(23.5+16.25)/295*100)<1e-9,'Smaltimento totale come in pagina');
assert.equal(m.recap[2].pct,0,'Un DM senza ore disponibili ha smaltimento 0, non NaN');
const apr=m.months[3],i3=apr.days.findIndex(g=>g.ds==='2026-04-03');
assert.equal(apr.days[i3].kind,'closure','La chiusura mantiene il suo colore nel file');
assert.equal(apr.days.find(g=>g.ds==='2026-04-06').kind,'holiday','Pasquetta e festivita');
assert.equal(apr.days.find(g=>g.ds==='2026-04-04').kind,'weekend');
assert.equal(apr.dayTotals[i3],16,'Totale del giorno: le ore di tutti i DM');
assert.equal(m.months[7].rows[1].total,8.25,'Totale del mese per DM');
assert.equal(m.months[1].rows[0].values[15],4,'Il 16 febbraio digitato e non ancora salvato e nel file');
assert.equal(m.stamp,'17/11/2026 09:05');

// --- Excel ---
const xl=ctx.dmFerieXlsxBlob(m),bytes=xl.bytes,testo=Buffer.from(bytes).toString('utf8');
assert.equal(Buffer.from(bytes.slice(0,2)).toString(),'PK','Un vero archivio XLSX');
for(const f of ['[Content_Types].xml','xl/workbook.xml','xl/styles.xml','xl/worksheets/sheet1.xml'])assert.ok(testo.includes(f),`Contiene ${f}`);
const sheet=xl.sheet;
const stili=[...sheet.matchAll(/ s="(\d+)"/g)].map(x=>+x[1]);
assert.ok(stili.length&&Math.max(...stili)<xl.styleCount,'Ogni cella usa uno stile esistente: il file si apre senza riparazioni');
assert.ok(new RegExp(`<cellXfs count="${xl.styleCount}">`).test(xl.styles),'Il conteggio degli stili e esatto');
const celle=new Set();for(const mg of xl.merges){const [a,b]=mg.split(':'),pc=x=>[x.match(/[A-Z]+/)[0].split('').reduce((n,c)=>n*26+c.charCodeAt(0)-64,0),+x.match(/\d+/)[0]];const [c1,r1]=pc(a),[c2,r2]=pc(b);
 for(let r=r1;r<=r2;r++)for(let c=c1;c<=c2;c++){const k=c+'|'+r;assert.ok(!celle.has(k),`Celle unite sovrapposte: ${mg}`);celle.add(k)}}
for(const t of ['FERIE DM · 2026','QUADRO FERIE DM','SMALTIMENTO FERIE','GENNAIO 2026','DICEMBRE 2026','Mario Rossi','Anna Bianchi','TOT. MESE','Chiusura aziendale','Ponte (prova)'])
 assert.ok(sheet.includes(xmlEscT(t)),`Excel: manca "${t}"`);
function xmlEscT(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
assert.ok(sheet.indexOf('QUADRO FERIE DM')<sheet.indexOf('GENNAIO 2026')&&sheet.indexOf('GENNAIO 2026')<sheet.indexOf('FEBBRAIO 2026')&&sheet.indexOf('NOVEMBRE 2026')<sheet.indexOf('DICEMBRE 2026'),'In alto il quadro, poi i mesi in ordine');
assert.ok(/numFmtId="165" formatCode="0\.0%"/.test(xl.styles),'Lo smaltimento e una vera percentuale in Excel');
assert.ok(sheet.includes('<v>0.25</v>')&&sheet.includes('<v>-10</v>'),'Le ore sono numeri, anche negative e frazionarie: si possono sommare');
const verde=ctx.dmFerieSmaltColor(100).bgHex,rosso=ctx.dmFerieSmaltColor(0).bgHex;
assert.ok(xl.styles.includes('FF'+rosso),'Lo smaltimento in Excel usa la stessa scala della pagina');
assert.ok(xl.styles.includes('FFC8DBF7')&&xl.styles.includes('FFF6C9C9')&&xl.styles.includes('FFC9E8D2'),'Chiusure, weekend e festivita con i colori della pagina');
assert.ok(/orientation="landscape" fitToWidth="1"/.test(sheet),'Stampabile in A4 orizzontale');

// --- PDF ---
const pdf=ctx.dmFeriePdfBytes(m),ptxt=Buffer.from(pdf).toString('latin1');
assert.equal(ptxt.slice(0,5),'%PDF-','Firma PDF');
const pagine=+ptxt.match(/\/Type \/Pages \/Kids \[[^\]]*\] \/Count (\d+)/)[1];
assert.ok(pagine>=3&&pagine<=8,`Il PDF ha un numero ragionevole di pagine (${pagine})`);
assert.equal((ptxt.match(/\/Type \/Page /g)||[]).length,pagine,'Ogni pagina dichiarata esiste');
const sx=+ptxt.match(/startxref\n(\d+)/)[1];assert.equal(ptxt.slice(sx,sx+4),'xref','La tabella xref e dove dichiarato');
const voci=[...ptxt.slice(sx).matchAll(/(\d{10}) 00000 n/g)].map(x=>+x[1]);
voci.forEach((o,i)=>assert.ok(ptxt.slice(o).startsWith(`${i+1} 0 obj`),`Offset esatto per l oggetto ${i+1}`));
for(const t of ['FERIE DM · 2026','QUADRO FERIE DM','GENNAIO 2026','DICEMBRE 2026','Mario Rossi','Anna Bianchi','TOT. MESE','Chiusura aziendale','Festivit\xe0 nazionali'])
 assert.ok(ptxt.includes(t),`PDF: manca "${t}"`);
assert.ok(ptxt.indexOf('QUADRO FERIE DM')<ptxt.indexOf('(GENNAIO 2026)'),'Nel PDF il quadro viene prima dei mesi');
assert.ok(/\(Luca Verdi[^)]*\x85\)/.test(ptxt),'Nelle tabelle dei mesi un nome troppo lungo viene troncato con i puntini, non sborda');
assert.ok(ptxt.includes(`(1 / ${pagine} · A4)`)&&ptxt.includes(`(${pagine} / ${pagine} · A4)`),'Piede con numero di pagina');

// --- pagina: pulsanti e quadro ---
assert.ok(/id="reloadDmFerieBtn"[^>]*>Aggiorna<\/button>\s*<button id="downloadDmFerieExcelBtn"[^>]*>Scarica Excel<\/button>\s*<button id="downloadDmFeriePdfBtn"[^>]*>Scarica PDF<\/button>/.test(html),'I due pulsanti sono accanto ad Aggiorna');
assert.ok(fer.includes("$('#downloadDmFerieExcelBtn');if(xl)xl.onclick=()=>downloadDmFerieExcel()")&&fer.includes("$('#downloadDmFeriePdfBtn');if(pdf)pdf.onclick=()=>downloadDmFeriePdf()"),'I pulsanti sono collegati');
/* senza dati non si scarica un file vuoto */
const salvati=st.data;st.data=null;avvisi.length=0;ctx.downloadDmFerieExcel();ctx.downloadDmFeriePdf();
assert.equal(avvisi.length,2);assert.ok(avvisi.every(([t,e])=>e&&/Carica prima/.test(t)),'Senza planning caricato si avvisa invece di scaricare');st.data=salvati;
ctx.renderDmFerieSummary();const q=host['#dmFerieSummary'].innerHTML;
assert.equal((q.match(/dm-smalt-pill/g)||[]).length,4,'Ogni riga del quadro, e il totale, mostra la pillola colorata');
assert.ok(!q.includes('holiday-pct'),'La vecchia colorazione a tre fasce non e piu usata in Ferie DM');
assert.ok(app.includes('<span class="holiday-pct ${holidayPctClass(m.pct)}">'),'Il Planning Ferie dei negozi resta com era');

if(process.env.FERIE_EXPORT_OUT){const d=process.env.FERIE_EXPORT_OUT;mkdirSync(d,{recursive:true});writeFileSync(d+'/FERIE_DM_2026.xlsx',Buffer.from(bytes));writeFileSync(d+'/FERIE_DM_2026.pdf',Buffer.from(pdf))}
console.log(`PASS: Ferie DM, Excel (${xl.styleCount} stili) e PDF (${pagine} pagine) con quadro e mesi; smaltimento dal rosso al verde`);
