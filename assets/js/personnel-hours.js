
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
 async function parseWorkbook(file,periodYear,allowedMonths){
  await ensureXlsx();
  // DB YTD is the monthly, employee-level source (including months excluded from the report).
  // The VENDITRICE pivot is cumulative and must never be used for a partial-year comparison.
  const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',sheets:['DB YTD']});
  const sheetName=Object.keys(workbook.Sheets||{}).find(k=>norm(k)==='DB YTD');
  if(!sheetName)throw Error('Nel file manca il foglio DB YTD con le ore del singolo mese.');
  const sheet=workbook.Sheets[sheetName];
  const names=workbook.Workbook?.Names||[];
  const defined=names.find(x=>/FILTERDATABASE/i.test(String(x.Name||x.name||''))&&/DB YTD/i.test(String(x.Ref||x.ref||'')));
  const definedEnd=String(defined?.Ref||defined?.ref||'').match(/\$?P\$?(\d+)/i);
  const matrix=XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,blankrows:false,defval:'',...(definedEnd?{range:'A1:P'+definedEnd[1]}:{})});
  const headerIndex=matrix.findIndex(row=>['MAGA','DESC','NOME','OREL','MESE','DATA'].every(h=>row.some(v=>norm(v)===h)));
  if(headerIndex<0)throw Error('Colonne MAGA, DESC, NOME, DATA, OREL e Mese mancanti nel foglio DB YTD.');
  const cols=matrix[headerIndex].map(norm);
  const codeCol=cols.indexOf('MAGA'),storeCol=cols.indexOf('DESC'),personCol=cols.indexOf('NOME');
  const hoursCol=cols.indexOf('OREL'),monthCol=cols.indexOf('MESE'),dateCol=cols.indexOf('DATA'),statusCol=cols.indexOf('STATUS');
  const monthNames=['GENNAIO','FEBBRAIO','MARZO','APRILE','MAGGIO','GIUGNO','LUGLIO','AGOSTO','SETTEMBRE','OTTOBRE','NOVEMBRE','DICEMBRE'];
  const totals=new Map(),monthsPresent=new Set(),monthsExcluded=new Set();
  for(const row of matrix.slice(headerIndex+1)){
    if(statusCol>=0&&norm(row[statusCol])!=='APERTO')continue;
    const store_name=String(row[storeCol]??'').trim(),store_code=String(row[codeCol]??'').trim();
    const employee_name=String(row[personCol]??'').trim();
    if(!store_name||!employee_name||!store_code||/TOTALE|GRAND TOTAL/i.test(employee_name))continue;
    const month=monthNames.indexOf(norm(row[monthCol]))+1;
    if(month<1)continue;
    const dateDigits=String(row[dateCol]??'').replace(/\D/g,'');
    let year=0,dateMonth=0;
    if(/^\d{6}$/.test(dateDigits)){year=2000+Number(dateDigits.slice(0,2));dateMonth=Number(dateDigits.slice(2,4));}
    else if(/^\d{8}$/.test(dateDigits)){year=Number(dateDigits.slice(0,4));dateMonth=Number(dateDigits.slice(4,6));}
    if(year!==periodYear||dateMonth!==month)continue;
    if(!allowedMonths.has(month)){monthsExcluded.add(month);continue;}
    monthsPresent.add(month);
    const raw=row[hoursCol],hours=typeof raw==='number'?raw:Number(String(raw??'').replace(',','.'));
    if(!Number.isFinite(hours))continue;
    const key=store_code.replace(/^0+/,'')+'|'+norm(employee_name);
    const old=totals.get(key);
    if(old)old.work_hours+=hours;
    else totals.set(key,{store_name,store_code,employee_name,work_hours:hours});
  }
  const missing=[...allowedMonths].filter(m=>!monthsPresent.has(m)).sort((a,b)=>a-b);
  if(missing.length)throw Error('Il file non contiene ore lavorate per i mesi '+missing.map(m=>monthNames[m-1]).join(', ')+'/'+periodYear+'.');
  const rows=[...totals.values()].map(r=>({...r,work_hours:round(r.work_hours)}));
  if(!rows.length||rows.length>7500)throw Error('Numero dipendenti aggregati non valido (1–7.500): '+rows.length+'.');
  if(rows.some(r=>r.work_hours<0))throw Error('Sono presenti ore lavorate negative dopo la somma mensile.');
  return {rows,monthsExcluded:[...monthsExcluded].sort((a,b)=>a-b),monthNames};
 }
async function handleImport(file){
  if(!file||currentUser?.role!=='ADMIN')return;
  const btn=find('#importPersonnelHoursBtn');
  if(!/\.xlsx$/i.test(file.name)||file.size>18500000){toast('Seleziona un XLSX inferiore a 18 MB.',true);return;}
  if(btn){btn.disabled=true;btn.textContent='Verifico il periodo degli straordinari…';}
  try{
   // Always check the entire district, regardless of the store currently selected in the report.
   const check=await window.agendaCloudApi.request('getGlobalImportOvertimePeriods',{__force:true});
   const byDm=check?.dm_periods||{};
   const owners=Object.entries(byDm).filter(([,months])=>months&&Object.keys(months).length);
   if(!owners.length)throw Error('Importa prima gli straordinari: non risultano mesi disponibili.');
   const candidates=[...new Set(owners.flatMap(([,months])=>Object.keys(months)))].filter(k=>/^20\d{2}-\d{2}$/.test(k)).sort().reverse();
   const period=candidates.find(k=>{
     const year=Number(k.slice(0,4)),month=Number(k.slice(5,7));
     return month>=1&&month<=12&&owners.every(([,months])=>Array.from({length:month},(_,i)=>String(year)+'-'+String(i+1).padStart(2,'0')).every(key=>months[key]));
   });
   if(!period)throw Error('Non esiste un periodo gennaio–mese completo per tutti i DM con straordinari. Verifica i mesi mancanti prima di importare.');
   const latest={year:Number(period.slice(0,4)),month:Number(period.slice(5,7))};
   const available=new Set(Array.from({length:latest.month},(_,i)=>i+1));
   if(btn)btn.textContent='Analizzo le ore mensili del file…';
   const parsed=await parseWorkbook(file,latest.year,available),rows=parsed.rows;
   const excluded=parsed.monthsExcluded.map(m=>parsed.monthNames[m-1]).join(', ');
   const message='Importare '+rows.length+' dipendenti con le ore SOMMATE ESCLUSIVAMENTE per gennaio–'+parsed.monthNames[latest.month-1]+' '+latest.year+'?'
    +(excluded?'\nMesi presenti nel file ma esclusi dal calcolo: '+excluded+'.':'')
    +'\nIl file originale verrà conservato su Drive; il precedente YTD sarà sostituito solo per i negozi riconosciuti, distribuiti ai rispettivi DM.';
   if(!confirm(message))return;
   if(btn)btn.textContent='Salvo su Google Drive…';
   const source_base64=encodeFile(new Uint8Array(await file.arrayBuffer()));
   const result=await window.agendaCloudApi.request('importPersonnelWorkHoursYtd',{year:latest.year,through_month:latest.month,rows,source_filename:file.name,source_base64});
   if(!Number(result?.imported_rows))throw Error('Salvataggio non confermato: nessuna riga importata.');
   await loadOvertimeCheck(true);
   const missing=result.unmatched_stores||[];
   toast('Ore personale: '+result.imported_rows+' dipendenti importati (gennaio–'+parsed.monthNames[latest.month-1]+' '+latest.year+')'+(missing.length?' · '+missing.length+' negozi non associati':''),!!missing.length);
   if(missing.length)showModal('Negozi non associati','<p>Questi negozi non sono stati associati in modo univoco a un DM della catena:</p><p>'+missing.map(esc).join(', ')+'</p>');
  }catch(e){toast(e.message||'Impossibile importare le ore personale.',true);}
  finally{if(btn){btn.disabled=false;btn.textContent='IMPORTA ORE PERSONALE';}}
 }
function render(){
  const button=find('#importPersonnelHoursBtn'),panel=find('#personnelIncidencePanel'),host=find('#personnelIncidenceContent');
  if(!button||!panel||!host)return;
  const data=overtimeCheckCache?.personnel_hours,ready=currentUser?.role==='ADMIN';
  button.classList.toggle('personnel-ready',ready);panel.classList.toggle('personnel-ready',ready);
  if(!ready)return;
  if(!data||typeof data.available!=='boolean'){host.innerHTML='<div class="empty">Il report delle ore lavorate non è disponibile al momento. Puoi comunque utilizzare IMPORTA ORE PERSONALE.</div>';return;}
  if(!data.available){host.innerHTML='<div class="empty">Non sono state ancora importate ore lavorate YTD. Utilizza IMPORTA ORE PERSONALE.</div>';return;}
  const fmt=x=>Number(x||0).toLocaleString('it-IT',{maximumFractionDigits:2});
  const fmt2=x=>Number(x).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmtPct=x=>x===null||x===undefined?'N/D':fmt2(x)+'%';
  const budget=Number.isFinite(Number(data.budget_pct))?Number(data.budget_pct):2;
  const formatBudget=budget.toLocaleString('it-IT',{maximumFractionDigits:2})+'%';
  const state=x=>x===null||x===undefined?'na':Number(x)>budget?'over':'ok';
  const missing=(data.months_missing||[]).map(m=>String(m).padStart(2,'0')).join(', ');
  const info=data.coverage_complete?'Gennaio–'+String(data.through_month).padStart(2,'0')+'/'+data.year+' · Budget '+formatBudget+'.':'Confronto incompleto: mancano gli straordinari dei mesi '+missing+'. Incidenze non calcolate.';
  const stats=[['Ore lavorate YTD',fmt(data.work_hours)],['Ore straordinarie YTD',fmt(data.overtime_hours)],['Incidenza',fmtPct(data.incidence_pct)],['Scostamento',data.excess_pp===null||data.excess_pp===undefined?'N/D':(data.excess_pp>0?'+':'')+fmt2(data.excess_pp)+' pp'],['Budget previsto',formatBudget]].map(v=>'<div class="personnel-stat"><span class="muted">'+esc(v[0])+'</span><strong>'+esc(v[1])+'</strong></div>').join('');
  const employee=overtimeCheckCache?.scope==='STORE',rows=(employee?data.employees:data.stores)||[];
  const head='<thead><tr>'+(employee?'<th>Venditrice</th>':'<th>Codice</th><th>Negozio</th>')+'<th class="num">Ore lavorate</th><th class="num">Straordinario</th><th class="num">Incidenza</th><th class="num">Scostamento da BDG</th></tr></thead>';
  const body=rows.map(x=>{
   const over=x.excess_pp!==null&&x.excess_pp!==undefined&&x.excess_pp>0;
   const diff=x.excess_pp===null||x.excess_pp===undefined?'N/D':(x.excess_pp>0?'+':'')+fmt2(x.excess_pp)+' pp';
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
 renderOvertimeCheck=function(){const result=originalRender.apply(this,arguments);const meta=find('#overtimeMeta');if(meta)for(const span of meta.querySelectorAll('span')){if(span.querySelector('strong')?.textContent.trim()==='Periodo disponibile:')span.classList.add('overtime-period-emphasis');}render();return result;};
})();
