
/* Independent additive module: stays hidden until upgraded Apps Script supports personnel_hours. */
(function(){
 'use strict';
 const find=s=>document.querySelector(s);
 const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleUpperCase('it-IT').replace(/\s+/g,' ').trim();
 const storeKey=v=>norm(v).replace(/FIORELLA RUBINO|FIORELLA|RUBINO/g,' ').replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();
 const round=x=>Math.round(x*100)/100;
 function encodeFile(bytes){
  if(bytes.length>18500000)throw Error('Dimensione massima XLSX: 18 MB.');
  const chunks=[];for(let i=0;i<bytes.length;i+=24576)chunks.push(String.fromCharCode(...bytes.subarray(i,i+24576)));
  return btoa(chunks.join(''));
 }
 window.agendaPersonnelBase64=encodeFile;
 async function parseWorkbook(file){
  await ensureXlsx();
  const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',sheets:['Venditrice','Negozio']});
  const sheetOf=name=>{const key=Object.keys(workbook.Sheets||{}).find(k=>norm(k)===norm(name));return key?workbook.Sheets[key]:null};
  const venditrice=sheetOf('Venditrice');if(!venditrice)throw Error('Foglio VENDITRICE non trovato.');
  const matrix=XLSX.utils.sheet_to_json(venditrice,{header:1,raw:true,defval:''});
  const headerIndex=matrix.findIndex(row=>row.some(v=>norm(v)==='DESC')&&row.some(v=>norm(v)==='NOME')&&row.some(v=>norm(v)==='ORE DI LAVORO'));
  if(headerIndex<0)throw Error('Colonne DESC, NOME e ORE DI LAVORO mancanti nel foglio VENDITRICE.');
  const columns=matrix[headerIndex].map(norm),storeCol=columns.indexOf('DESC'),personCol=columns.indexOf('NOME'),hoursCol=columns.indexOf('ORE DI LAVORO');
  const codes=new Map(),shops=sheetOf('Negozio');
  if(shops){
   const rows=XLSX.utils.sheet_to_json(shops,{header:1,raw:true,defval:''});
   const hdr=rows.findIndex(row=>row.some(v=>norm(v)==='MAGA')&&row.some(v=>norm(v)==='DESC'));
   if(hdr>=0){const cols=rows[hdr].map(norm),c=cols.indexOf('MAGA'),n=cols.indexOf('DESC');
    for(const row of rows.slice(hdr+1)){const name=String(row[n]??'').trim(),code=String(row[c]??'').trim();if(name&&code&&!/TOTALE/i.test(name))codes.set(storeKey(name),code);}
   }
  }
  let store='',out=[];
  for(const row of matrix.slice(headerIndex+1)){
   const nextStore=String(row[storeCol]??'').trim(),person=String(row[personCol]??'').trim();
   if(nextStore&&!/TOTALE/i.test(nextStore))store=nextStore;
   if(!store||!person||/TOTALE|ETICHETTE DI RIGA|GRAND TOTAL/i.test(person))continue;
   const raw=row[hoursCol],hours=typeof raw==='number'?raw:Number(String(raw??'').replace(',','.'));
   if(!Number.isFinite(hours)||hours<0)continue;
   out.push({store_name:store,store_code:codes.get(storeKey(store))||'',employee_name:person,work_hours:round(hours)});
  }
  if(!out.length||out.length>7500)throw Error('Numero righe non valido nel foglio VENDITRICE (1–7.500).');
  return out;
 }
 async function handleImport(file){
  if(!file||currentUser?.role!=='ADMIN')return;
  const btn=find('#importPersonnelHoursBtn');
  if(!/\.xlsx$/i.test(file.name)||file.size>18500000){toast('Seleziona un XLSX inferiore a 18 MB.',true);return;}
  if(btn){btn.disabled=true;btn.textContent='Analizzo il file…';}
  try{
   const rows=await parseWorkbook(file),end=new Date();end.setDate(1);end.setMonth(end.getMonth()-1);
   const periods=(overtimeCheckCache?.months||[]).map(x=>({year:Number(x.year),month:Number(x.month)})).filter(x=>x.year>=2020&&x.month>=1&&x.month<=12);\n   const latest=periods.slice().sort((a,b)=>b.year-a.year||b.month-a.month)[0];\n   if(!latest)throw Error('Importa prima gli straordinari: non ci sono mesi disponibili per il confronto.');\n   const available=new Set(periods.filter(x=>x.year===latest.year).map(x=>x.month));\n   for(let m=1;m<=latest.month;m++)if(!available.has(m))throw Error('Straordinari non disponibili per tutti i mesi da gennaio a '+latest.month+'/'+latest.year+'. Non è possibile confrontare un totale YTD con mesi incompleti.');\n   const yearText=prompt('Anno di riferimento YTD delle ore lavorate (coerente con gli straordinari)',String(latest.year));if(yearText===null)return;
   const monthText=prompt('Ultimo mese incluso nel file YTD (1–12)',String(latest.month));if(monthText===null)return;
   const year=Number(yearText),through_month=Number(monthText);
   if(!Number.isInteger(year)||year<2020||year>2100||!Number.isInteger(through_month)||through_month<1||through_month>12)throw Error('Anno o mese YTD non validi.');
   if(year!==latest.year||through_month!==latest.month)throw Error('Periodo non coerente: gli straordinari disponibili coprono gennaio–'+latest.month+'/'+latest.year+'. Seleziona un file ORE PERSONALE relativo esattamente allo stesso periodo.');\n   if(!confirm('Verifica che il file ORE PERSONALE contenga esclusivamente il cumulato gennaio–'+through_month+'/'+year+' (il file YTD non contiene un dettaglio mensile da filtrare). Importare '+rows.length+' righe, periodo gennaio–'+through_month+'/'+year+'? Verrà archiviato su Drive anche il file XLSX originale e sostituito il precedente YTD del distretto per lo stesso anno.'))return;
   if(btn)btn.textContent='Salvo su Google Drive…';
   const source_base64=encodeFile(new Uint8Array(await file.arrayBuffer()));
   const result=await window.agendaCloudApi.request('importPersonnelWorkHoursYtd',{year,through_month,rows,source_filename:file.name,source_base64});
   await loadOvertimeCheck(true);
   const missing=result.unmatched_stores||[];
   toast('Ore personale: '+(result.imported_rows||0)+' righe importate'+(missing.length?' · '+missing.length+' negozi non riconosciuti':''),!!missing.length);
   if(missing.length)showModal('Negozi non associati','<p>Questi negozi non sono stati associati al tuo distretto:</p><p>'+missing.map(esc).join(', ')+'</p>');
  }catch(e){toast(e.message||'Impossibile importare le ore personale.',true)}
  finally{if(btn){btn.disabled=false;btn.textContent='IMPORTA ORE PERSONALE'}}
 }
 function render(){
  const button=find('#importPersonnelHoursBtn'),panel=find('#personnelIncidencePanel'),host=find('#personnelIncidenceContent');
  if(!button||!panel||!host)return;
  const data=overtimeCheckCache?.personnel_hours,ready=currentUser?.role==='ADMIN'&&!!data&&typeof data.available==='boolean';
  button.classList.toggle('personnel-ready',ready);panel.classList.toggle('personnel-ready',ready);
  if(!ready)return;
  if(!data.available){host.innerHTML='<div class="empty">Non sono state ancora importate ore lavorate YTD. Utilizza IMPORTA ORE PERSONALE.</div>';return;}
  const fmt=x=>Number(x||0).toLocaleString('it-IT',{maximumFractionDigits:2});
  const fmtPct=x=>x===null||x===undefined?'N/D':fmt(x)+'%';
  const state=x=>x===null||x===undefined?'na':Number(x)>3?'over':'ok';
  const missing=(data.months_missing||[]).map(m=>String(m).padStart(2,'0')).join(', ');
  const info=data.coverage_complete?'Gennaio–'+String(data.through_month).padStart(2,'0')+'/'+data.year+' · Budget 3%.':'Confronto incompleto: mancano gli straordinari dei mesi '+missing+'. Incidenze non calcolate.';
  const stats=[['Ore lavorate YTD',fmt(data.work_hours)],['Ore straordinarie YTD',fmt(data.overtime_hours)],['Incidenza',fmtPct(data.incidence_pct)],['Scostamento',data.excess_pp===null||data.excess_pp===undefined?'N/D':(data.excess_pp>0?'+':'')+fmt(data.excess_pp)+' pp'],['Budget previsto','3%']].map(v=>'<div class="personnel-stat"><span class="muted">'+esc(v[0])+'</span><strong>'+esc(v[1])+'</strong></div>').join('');
  const employee=overtimeCheckCache?.scope==='STORE',rows=(employee?data.employees:data.stores)||[];
  const head='<thead><tr>'+(employee?'<th>Venditrice</th>':'<th>Codice</th><th>Negozio</th>')+'<th class="num">Ore lavorate</th><th class="num">Straordinario</th><th class="num">Incidenza</th><th class="num">Scostamento dal 3%</th></tr></thead>';
  const body=rows.map(x=>{
   const over=x.excess_pp!==null&&x.excess_pp!==undefined&&x.excess_pp>0;
   const diff=x.excess_pp===null||x.excess_pp===undefined?'N/D':(x.excess_pp>0?'+':'')+fmt(x.excess_pp)+' pp';
   return '<tr'+(over?' class="personnel-over-row"':'')+'>'+(employee?'<td><strong>'+esc(x.employee_name)+'</strong></td>':'<td>'+esc(x.store_code||'—')+'</td><td><strong>'+esc(x.store_name||'—')+'</strong></td>')+'<td class="num">'+esc(fmt(x.work_hours))+'</td><td class="num">'+esc(fmt(x.overtime_hours))+'</td><td class="num"><span class="personnel-rate '+state(x.incidence_pct)+'">'+esc(fmtPct(x.incidence_pct))+'</span></td><td class="num'+(over?' personnel-excess':'')+'">'+esc(diff)+'</td></tr>';
  }).join('');
  host.innerHTML='<div class="personnel-summary">'+stats+'</div><div class="personnel-budget'+(data.coverage_complete?'':' warn')+'">'+esc(info)+' · Origine: '+esc(data.source_filename||'—')+'</div>'+(rows.length?'<table class="data-table overtime-table personnel-incidence-table">'+head+'<tbody>'+body+'</tbody></table>':'<div class="empty">Non sono disponibili dipendenti o negozi nel periodo.</div>');
 }
 const button=find('#importPersonnelHoursBtn'),picker=find('#personnelHoursFile');
 if(button&&picker){
  button.addEventListener('click',()=>picker.click());
  picker.addEventListener('change',()=>{const file=picker.files[0];picker.value='';if(file)handleImport(file)});
 }
 const originalRender=renderOvertimeCheck;
 renderOvertimeCheck=function(){const result=originalRender.apply(this,arguments);render();return result;};
})();
