/* FERIE DM · planning ferie dei District Manager (profili DM e RM).
   Le giornate di ferie di un DM sono gli eventi FERIE del suo calendario: questa
   pagina li legge e li scrive attraverso il backend, quindi calendario e
   planning restano allineati senza alcuna sincronizzazione lato browser.
   Ogni DM modifica solo la propria riga; il RM consulta. Chiusure aziendali:
   RM e DM le gestiscono. Usa gli helper puri di app.js (ore, date, festivita,
   registro) e non tocca lo stato del Planning Ferie dei negozi. */
let dmFerieState={seq:0,year:0,data:null,planMap:new Map(),totals:{},legacy:new Set(),closureSet:new Set(),closureLabel:new Map()};
let dmFerieQueue=new Map(),dmFerieTimer=null,dmFerieSaving=null,dmFerieRetry=false,dmFerieClosureBusy=false;
let dmFerieAuditState={rows:[],cursor:null,complete:false,loading:false,error:'',year:0,seq:0,visibleLimit:150};
let dmFerieAuditFilters={dm:'',date:'',week:'',month:'',field:''};
let dmFerieAuditModalState=null;
/* Il registro parte chiuso: si apre con il pulsante e si carica solo allora. */
let dmFerieAuditOpen=false,dmFerieAuditStale=true;

function dmFerieKey(dmId,date){return String(dmId)+'|'+String(date)}
/* Il registro modifiche e' uno strumento di controllo: lo vedono il RM e gli
   ADMIN (profilo ADMIN o flag ADMIN). Il backend applica la stessa regola. */
function dmFerieAuditVisible(){return isRetailManager()||isSuperAdmin()}
function dmFerieBackendMessage(err){
 return String(err?.code||'')==='UNKNOWN_ACTION'
  ?'FERIE DM richiede il backend aggiornato (build 2026-11-17-ferie-dm-v15): incolla il nuovo Code.gs e crea una nuova versione della distribuzione.'
  :String(err?.message||'Impossibile caricare FERIE DM.');
}
function dmFerieSetStatus(text,cls=''){const el=$('#dmFerieSaveStatus');if(el){el.textContent=text;el.className='holiday-saving '+cls}
 const retry=$('#retryDmFerieSaveBtn');if(retry){retry.classList.toggle('hidden',!(dmFerieRetry&&dmFerieQueue.size));retry.disabled=!!dmFerieSaving}}

/* Ore di una cella: vuoto = 0; da 0,25 a 8 a quarti d'ora. NaN se non valido. */
function dmFerieParseHours(raw){
 const t=String(raw??'').trim().replace(',','.');
 if(!t)return 0;
 if(!/^\d+(\.\d*)?$/.test(t))return NaN; /* "3," e' una digitazione in corso, non un errore */
 const n=Math.round(Number(t)*100)/100;
 if(!Number.isFinite(n)||n<0||n>8||Math.abs(n*4-Math.round(n*4))>1e-9)return NaN;
 return n;
}
/* Tipo di giornata, in ordine di precedenza: una chiusura e' una scelta
   esplicita dell'azienda e prevale; poi festivita' nazionale; poi weekend. */
function dmFerieDayKind(d,ds){
 if(dmFerieState.closureSet.has(ds))return 'closure';
 if(itHolidayName(d))return 'holiday';
 if(d.getDay()===0||d.getDay()===6)return 'weekend';
 return '';
}
function dmFerieDayTitle(d,ds){
 const parti=[fmtDate(ds)],kind=dmFerieDayKind(d,ds);
 if(kind==='closure')parti.push('Chiusura aziendale'+(dmFerieState.closureLabel.get(ds)?' · '+dmFerieState.closureLabel.get(ds):''));
 else if(kind==='holiday')parti.push(itHolidayName(d));
 else if(kind==='weekend')parti.push(d.getDay()===0?'Domenica':'Sabato');
 return parti.join(' · ');
}

function initDmFerieControls(){
 const sel=$('#dmFerieYear');if(!sel||sel.dataset.ready==='1')return;
 const y=new Date().getFullYear();
 sel.innerHTML=[y-1,y,y+1].map(v=>`<option value="${v}" ${v===y?'selected':''}>${v}</option>`).join('');
 sel.dataset.ready='1';
 sel.onchange=()=>loadDmHolidays(false);
 const reload=$('#reloadDmFerieBtn');if(reload)reload.onclick=()=>loadDmHolidays(true);
 const xl=$('#downloadDmFerieExcelBtn');if(xl)xl.onclick=()=>downloadDmFerieExcel();
 const pdf=$('#downloadDmFeriePdfBtn');if(pdf)pdf.onclick=()=>downloadDmFeriePdf();
 const retry=$('#retryDmFerieSaveBtn');if(retry)retry.onclick=()=>flushDmFerieQueue(true);
 const form=$('#dmFerieClosureForm');if(form)form.onsubmit=e=>{e.preventDefault();addDmFerieClosure()};
 const tg=$('#dmFerieAuditToggle');if(tg)tg.onclick=()=>toggleDmFerieAudit();
 const ra=$('#reloadDmFerieAudit');if(ra)ra.onclick=()=>loadDmFerieAudit(true);
 const more=$('#loadMoreDmFerieAudit');if(more)more.onclick=()=>{if(dmFerieAuditState.error){void loadDmFerieAudit(false);return}dmFerieAuditState.visibleLimit+=150;renderDmFerieAudit()};
 const clear=$('#dmFerieAuditClearFilters');if(clear)clear.onclick=()=>{dmFerieAuditFilters={dm:'',date:'',week:'',month:'',field:''};for(const id of ['Dm','Date','Week','Month','Field']){const el=$('#dmFerieAuditFilter'+id);if(el)el.value=''}dmFerieAuditState.visibleLimit=150;renderDmFerieAudit()};
 for(const [id,key,ev] of [['Dm','dm','input'],['Date','date','change'],['Week','week','change'],['Month','month','change'],['Field','field','change']]){
  const el=$('#dmFerieAuditFilter'+id);if(el)el.addEventListener(ev,()=>{dmFerieAuditFilters[key]=String(el.value||'');dmFerieAuditState.visibleLimit=150;renderDmFerieAudit()});
 }
}

async function loadDmHolidays(force=false){
 initDmFerieControls();
 const seq=++dmFerieState.seq,year=Number($('#dmFerieYear')?.value)||new Date().getFullYear();
 if(dmFerieQueue.size){const ok=await flushDmFerieQueue();if(seq!==dmFerieState.seq)return;if(!ok){toast('Il planning contiene modifiche non salvate. Riprova prima di ricaricare.',true);return}}
 const closureDate=$('#dmFerieClosureDate');if(closureDate){closureDate.min=year+'-01-01';closureDate.max=year+'-12-31'}
 dmFerieSetStatus('Caricamento…');
 try{
  const data=await window.agendaCloudApi.request('getDmHolidayPlanning',{year,__force:force});
  if(seq!==dmFerieState.seq)return;
  dmFerieState.data=data;dmFerieState.year=Number(data.year)||year;dmFerieIndex();renderDmFerie();dmFerieSetStatus('');
  $('#dmFerieAuditPanel')?.classList.toggle('hidden',!dmFerieAuditVisible());
  if(dmFerieAuditVisible())void loadDmFerieAudit(true);
 }catch(err){
  if(seq!==dmFerieState.seq)return;
  dmFerieSetStatus('');
  const msg=esc(dmFerieBackendMessage(err));
  for(const id of ['#dmFerieSummary','#dmFerieGrid'])if($(id))$(id).innerHTML=`<div class="empty">${msg}</div>`;
  if($('#dmFerieClosures'))$('#dmFerieClosures').innerHTML='';
  toast(dmFerieBackendMessage(err),true);
 }
}
function dmFerieIndex(){
 const d=dmFerieState.data||{},map=new Map(),tot={},legacy=new Set();
 for(const p of d.plan||[]){
  const id=String(p.dm_id),ds=String(p.plan_date||'').slice(0,10),h=holidayHours(p.hours),k=dmFerieKey(id,ds);
  map.set(k,h);tot[id]=Math.round(((tot[id]||0)+h)*100)/100;if(p.legacy)legacy.add(k);
 }
 dmFerieState.planMap=map;dmFerieState.totals=tot;dmFerieState.legacy=legacy;
 dmFerieState.closureSet=new Set((d.closures||[]).map(c=>String(c.date).slice(0,10)));
 dmFerieState.closureLabel=new Map((d.closures||[]).map(c=>[String(c.date).slice(0,10),String(c.label||'')]));
}
function dmFerieMetrics(dm){
 const total=holidayHours(dm.residual_ap_hours)+holidayHours(dm.projected_ac_hours),planned=Math.round((dmFerieState.totals[String(dm.dm_id)]||0)*100)/100;
 const residual=Math.round((total-planned)*100)/100,pct=total>0?planned/total*100:0;
 return {total,planned,residual,pct};
}
function renderDmFerie(){
 const d=dmFerieState.data;if(!d)return;
 const self=(d.dms||[]).find(x=>x.editable),meta=$('#dmFerieMeta');
 if(meta)meta.textContent=`${dmFerieState.year} · `+(self?`${self.display_name}: modifichi la tua riga, le altre sono in sola visualizzazione`:'sola visualizzazione');
 renderDmFerieClosures();renderDmFerieSummary();renderDmFerieGrid();
}

/* ------------------------------------------------------ chiusure aziendali */
function renderDmFerieClosures(){
 const host=$('#dmFerieClosures');if(!host)return;
 const list=(dmFerieState.data?.closures||[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 host.innerHTML=list.length?list.map(c=>{
  const ds=String(c.date).slice(0,10),label=String(c.label||'').trim();
  return `<span class="dm-closure-chip"><span class="dm-closure-day">${esc(fmtDate(ds))}</span>${label?`<span class="dm-closure-label">${esc(label)}</span>`:''}`
   +`<button type="button" class="dm-closure-remove" data-dm-closure-remove="${esc(ds)}" aria-label="Rimuovi la chiusura del ${esc(fmtDate(ds))}" title="Rimuovi">×</button></span>`;
 }).join(''):`<div class="empty">Nessuna chiusura aziendale per il ${dmFerieState.year}.</div>`;
 host.querySelectorAll('[data-dm-closure-remove]').forEach(b=>b.onclick=()=>removeDmFerieClosure(b.dataset.dmClosureRemove));
}
async function addDmFerieClosure(){
 if(dmFerieClosureBusy)return;
 const date=String($('#dmFerieClosureDate')?.value||''),label=String($('#dmFerieClosureLabel')?.value||'').trim();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){toast('Indica la data della chiusura.',true);return}
 if(Number(date.slice(0,4))!==dmFerieState.year){toast(`La data deve appartenere al ${dmFerieState.year}.`,true);return}
 dmFerieClosureBusy=true;
 try{
  const out=await window.agendaCloudApi.request('addCompanyClosure',{date,label});
  toast(out?.added===false?'Chiusura gia presente.':`Chiusura inserita · ${Number(out?.defaults||0)} DM con 8 ore di ferie di default`);
  if($('#dmFerieClosureDate'))$('#dmFerieClosureDate').value='';
  if($('#dmFerieClosureLabel'))$('#dmFerieClosureLabel').value='';
  dmFerieCalendarRefresh();await loadDmHolidays(true);
 }catch(err){toast(dmFerieBackendMessage(err),true)}
 finally{dmFerieClosureBusy=false}
}
async function removeDmFerieClosure(date){
 if(dmFerieClosureBusy)return;
 if(!confirm(`Rimuovere la chiusura aziendale del ${fmtDate(date)}? Le 8 ore di default che nessun DM ha modificato verranno tolte dai planning.`))return;
 dmFerieClosureBusy=true;
 try{
  const out=await window.agendaCloudApi.request('removeCompanyClosure',{date});
  toast(`Chiusura rimossa · ${Number(out?.defaults_removed||0)} giornate di default tolte`);
  dmFerieCalendarRefresh();await loadDmHolidays(true);
 }catch(err){toast(dmFerieBackendMessage(err),true)}
 finally{dmFerieClosureBusy=false}
}

/* ------------------------------------------------------------ quadro ferie */
function renderDmFerieSummary(){
 const host=$('#dmFerieSummary');if(!host)return;
 const dms=dmFerieState.data?.dms||[];
 if(!dms.length){host.innerHTML='<div class="empty">Nessun account DM attivo.</div>';return}
 const num=v=>`<td class="metric-strong ${v<0?'metric-negative':''}">${holidayHoursFmt(v)}</td>`;
 const body=dms.map(dm=>{
  const m=dmFerieMetrics(dm),id=esc(dm.dm_id),ap=holidayHours(dm.residual_ap_hours),ac=holidayHours(dm.projected_ac_hours);
  const cella=(field,v,min)=>dm.editable
   ?`<td><input type="number" step="0.25" ${min?'min="0"':''} class="${v<0?'metric-negative':''}" data-dm-ferie-quadro="${field}" value="${v}" aria-label="${field==='residual_ap_hours'?'Ore residue AP':'Ore proiettate AC'} di ${esc(dm.display_name)}"></td>`
   :`<td><span class="metric-strong ${v<0?'metric-negative':''}">${holidayHoursFmt(v)}</span></td>`;
  return `<tr data-dm-ferie-row="${id}" class="${dm.editable?'dm-ferie-own':''}"><td><strong>${esc(dm.display_name)}</strong>${dm.editable?' <span class="dm-ferie-you">TU</span>':''}</td>`
   +cella('residual_ap_hours',ap,false)+cella('projected_ac_hours',ac,true)
   +num(m.total)+num(m.planned)+num(m.residual)+`<td>${dmFerieSmaltPill(m.pct)}</td></tr>`;
 }).join('');
 const t=dms.reduce((s,dm)=>{const m=dmFerieMetrics(dm);s.ap+=holidayHours(dm.residual_ap_hours);s.ac+=holidayHours(dm.projected_ac_hours);s.total+=m.total;s.planned+=m.planned;s.residual+=m.residual;return s},{ap:0,ac:0,total:0,planned:0,residual:0});
 const pct=t.total>0?t.planned/t.total*100:0;
 host.innerHTML='<table class="holiday-summary-table"><thead><tr><th>District Manager</th><th>Ore Residue AP</th><th>Ore Proiettate AC</th><th>Ore Totali AC+AP</th><th>Ore Programmate e Godute AC</th><th>Ore Residue AC+AP</th><th>Smaltimento Ferie</th></tr></thead><tbody>'
  +body+`<tr class="holiday-employees-total"><td>TOTALE</td>${num(t.ap)}${num(t.ac)}${num(t.total)}${num(t.planned)}${num(t.residual)}<td>${dmFerieSmaltPill(pct)}</td></tr></tbody></table>`;
 host.querySelectorAll('[data-dm-ferie-quadro]').forEach(el=>el.onchange=()=>saveDmFerieQuadro(el));
}
async function saveDmFerieQuadro(el){
 const field=el.dataset.dmFerieQuadro,raw=String(el.value||'').trim().replace(',','.'),n=Number(raw);
 if(raw===''||!Number.isFinite(n)||(field==='projected_ac_hours'&&n<0)){el.classList.add('input-invalid');toast(field==='projected_ac_hours'?'Le ore proiettate AC non possono essere negative.':'Valore non valido.',true);return}
 el.classList.remove('input-invalid');
 const self=(dmFerieState.data?.dms||[]).find(x=>x.editable);if(!self)return;
 const prev=self[field];self[field]=Math.round(n*100)/100;renderDmFerieSummary();dmFerieSetStatus('Salvataggio…');
 try{await window.agendaCloudApi.request('saveDmHolidayQuadro',{year:dmFerieState.year,[field]:self[field]});dmFerieSetStatus('Salvato','ok');void loadDmFerieAudit(true)}
 catch(err){self[field]=prev;renderDmFerieSummary();dmFerieSetStatus('Non salvato','error');toast(dmFerieBackendMessage(err),true)}
}

/* ------------------------------------------------------- planning giornaliero */
function renderDmFerieGrid(){
 const host=$('#dmFerieGrid');if(!host)return;
 const dms=dmFerieState.data?.dms||[],year=dmFerieState.year;
 if(!dms.length){host.innerHTML='<div class="empty">Nessun account DM attivo.</div>';return}
 const dates=holidayYearDates(year),today=isoDate(new Date());
 const months=holidayRuns(dates,d=>`${d.getFullYear()}-${d.getMonth()}`,d=>MONTHS[d.getMonth()]);
 const weeks=holidayRuns(dates,d=>{const w=isoWeekInfo(d);return `${w.year}-${w.week}`},d=>`W${String(isoWeekInfo(d).week).padStart(2,'0')}`);
 const kinds=dates.map(d=>dmFerieDayKind(d,isoDate(d)));
 let h='<table class="holiday-plan-table dm-ferie-table"><thead><tr><th class="holiday-employee-head" rowspan="3">District Manager</th>';
 h+=months.map(x=>`<th class="month-head" colspan="${x.span}">${esc(x.label)}</th>`).join('')+'</tr><tr>';
 h+=weeks.map(x=>`<th class="week-head" colspan="${x.span}">${esc(x.label)}</th>`).join('')+'</tr><tr>';
 h+=dates.map((d,i)=>{const ds=isoDate(d);return `<th class="day-head ${kinds[i]?'dm-day-'+kinds[i]:''} ${ds===today?'today':''}" title="${esc(dmFerieDayTitle(d,ds))}">${DAYS[d.getDay()]}<br><strong>${d.getDate()}</strong></th>`}).join('')+'</tr></thead><tbody>';
 for(const [ri,dm] of dms.entries()){
  const id=String(dm.dm_id);
  h+=`<tr class="${dm.editable?'dm-ferie-own':''}"><td class="holiday-employee-cell" title="${esc(dm.display_name)}">${esc(dm.display_name)}</td>`;
  for(const [ci,d] of dates.entries()){
   const ds=isoDate(d),k=dmFerieKey(id,ds),v=dmFerieState.planMap.get(k)||0,legacy=dmFerieState.legacy.has(k);
   const cls=[kinds[ci]?'dm-day-'+kinds[ci]:'',v>0?'has-hours':'',legacy?'dm-ferie-legacy':''].filter(Boolean).join(' ');
   const tip=legacy?' title="Ferie inserita sul calendario senza ore: conteggiata come giornata intera (8h)"':'';
   const shown=v>0?holidayHoursFmt(v):'';
   h+=`<td class="${cls}" data-dm-ferie-cell="${esc(k)}"${tip}>`+(dm.editable
    ?`<input class="holiday-hours-input" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="${esc(shown)}" data-dm-ferie-hours data-date="${ds}" data-row="${ri}" data-col="${ci}" aria-label="Ore di ferie del ${esc(fmtDate(ds))}">`
    :(shown?`<span class="hours-value">${esc(shown)}</span>`:''))+'</td>';
  }
  h+='</tr>';
 }
 host.innerHTML=h+'</tbody></table>';if(typeof scrollPlanningToCurrentMonth==='function')scrollPlanningToCurrentMonth(host,'dm|'+String(dates[0]?.getFullYear?.()||''));
 host.querySelectorAll('[data-dm-ferie-hours]').forEach(inp=>{
  inp.oninput=()=>updateDmFerieCell(inp,false);
  inp.onblur=()=>updateDmFerieCell(inp,true);
  inp.onkeydown=e=>dmFerieKeydown(e,inp);
 });
}
function dmFerieKeydown(e,inp){
 const move={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]}[e.key];if(!move)return;
 e.preventDefault();updateDmFerieCell(inp,true);
 const next=$(`[data-dm-ferie-hours][data-row="${Number(inp.dataset.row)+move[0]}"][data-col="${Number(inp.dataset.col)+move[1]}"]`);
 if(next){next.focus();next.select()}
}
function updateDmFerieCell(inp,normalize){
 const self=(dmFerieState.data?.dms||[]).find(x=>x.editable);if(!self)return;
 const date=inp.dataset.date,k=dmFerieKey(self.dm_id,date),v=dmFerieParseHours(inp.value);
 if(Number.isNaN(v)){inp.classList.add('input-invalid');dmFerieSetStatus('Ore non valide: da 0,25 a 8, a quarti d\'ora','error');return}
 inp.classList.remove('input-invalid');
 const prev=dmFerieState.planMap.get(k)||0;
 if(normalize)inp.value=v>0?holidayHoursFmt(v):'';
 if(prev===v&&!dmFerieQueue.has(date))return;
 dmFerieState.planMap.set(k,v);
 dmFerieState.totals[String(self.dm_id)]=Math.round(((dmFerieState.totals[String(self.dm_id)]||0)-prev+v)*100)/100;
 dmFerieState.legacy.delete(k);
 const td=inp.closest('td');if(td){td.classList.toggle('has-hours',v>0);td.classList.remove('dm-ferie-legacy');td.removeAttribute('title')}
 dmFerieQueue.set(date,{plan_date:date,hours:v});
 renderDmFerieSummary();
 clearTimeout(dmFerieTimer);
 if(dmFerieRetry){dmFerieSetStatus('Modifiche non salvate · Riprova','error');dmFerieTimer=null}
 else{dmFerieSetStatus('Salvataggio…');dmFerieTimer=setTimeout(()=>flushDmFerieQueue(),400)}
}
async function flushDmFerieQueue(forceRetry=false){
 if(dmFerieSaving)return dmFerieSaving;
 if(!dmFerieQueue.size)return true;
 if(dmFerieRetry&&!forceRetry){dmFerieSetStatus('Modifiche non salvate · Riprova','error');return false}
 dmFerieRetry=false;clearTimeout(dmFerieTimer);dmFerieTimer=null;
 const year=dmFerieState.year,user=currentUser;
 const run=(async()=>{
  while(dmFerieQueue.size&&currentUser===user){
   const batch=[...dmFerieQueue.values()];dmFerieQueue.clear();dmFerieSetStatus('Salvataggio in corso…');
   try{
    const out=await window.agendaCloudApi.request('saveDmHolidayPlan',{year,entries:batch,__silent:true});
    if(!out||Number(out.saved)!==batch.length)throw new Error('Il server non ha confermato tutte le celle. Verifica il planning prima di riprovare.');
   }catch(err){
    for(const x of batch)if(!dmFerieQueue.has(x.plan_date))dmFerieQueue.set(x.plan_date,x);
    dmFerieRetry=true;dmFerieSetStatus('Non salvato · Riprova','error');toast(dmFerieBackendMessage(err),true);
    return false;
   }
  }
  dmFerieSetStatus('Salvato','ok');dmFerieCalendarRefresh();void loadDmFerieAudit(true);
  return true;
 })();
 dmFerieSaving=run;
 try{return await run}finally{if(dmFerieSaving===run)dmFerieSaving=null;dmFerieSetStatus(dmFerieRetry?'Non salvato · Riprova':dmFerieQueue.size?'Salvataggio in corso…':'Salvato',dmFerieRetry?'error':dmFerieQueue.size?'':'ok')}
}
/* Il calendario del DM tiene gli eventi in memoria: dopo una modifica dal
   planning va riletto, altrimenti mostrerebbe le ferie di prima. */
/* Dopo un salvataggio il calendario deve rileggere il centrale: le letture in
   cache e la scorciatoia dell'intervallo "appena letto" mostrerebbero ancora le
   ferie tolte. Se il calendario e' aperto, si ridisegna. */
function dmFerieCalendarRefresh(){
 if(currentUser?.role!=='ADMIN'||typeof refreshCloudState!=='function')return;
 if(typeof calendarRangeFreshUntil!=='undefined')calendarRangeFreshUntil.clear();
 void refreshCloudState().then(()=>{if($('#page-calendar')?.classList.contains('active')&&typeof renderCalendar==='function')renderCalendar()}).catch(()=>{});
}

/* ----------------------------------------------------- registro modifiche */
function toggleDmFerieAudit(open=!dmFerieAuditOpen){
 dmFerieAuditOpen=!!open;
 const tg=$('#dmFerieAuditToggle'),body=$('#dmFerieAuditBody'),lbl=$('#dmFerieAuditToggle .dm-audit-toggle-label');
 if(tg)tg.setAttribute('aria-expanded',dmFerieAuditOpen?'true':'false');
 if(body)body.classList.toggle('hidden',!dmFerieAuditOpen);
 if(lbl)lbl.textContent=dmFerieAuditOpen?'Chiudi':'Apri';
 if(dmFerieAuditOpen&&dmFerieAuditStale)void loadDmFerieAudit(true);
}
async function loadDmFerieAudit(reset=true){
 if(!dmFerieAuditVisible())return;
 /* chiuso: niente richieste, si ricarica alla prossima apertura */
 if(!dmFerieAuditOpen){dmFerieAuditStale=true;return}
 dmFerieAuditStale=false;
 const year=dmFerieState.year||Number($('#dmFerieYear')?.value)||new Date().getFullYear();
 const st=dmFerieAuditState,seq=++st.seq;
 if(reset){st.rows=[];st.cursor=null;st.complete=false;st.error='';st.year=year;st.visibleLimit=150}
 st.loading=true;renderDmFerieAudit();
 try{
  do{
   const out=await window.agendaCloudApi.request('getDmHolidayAudit',{year,limit:150,cursor:st.cursor||undefined,__silent:true});
   if(seq!==st.seq)return;
   st.rows=st.rows.concat(out?.events||[]);st.cursor=out?.next_cursor||null;
  }while(st.cursor);
  st.complete=true;
 }catch(err){if(seq!==st.seq)return;st.error=dmFerieBackendMessage(err)}
 finally{if(seq===st.seq){st.loading=false;renderDmFerieAudit()}}
}
function dmFerieAuditRows(){const y=dmFerieAuditState.year;return dmFerieAuditState.rows.filter(e=>holidayPlanningAuditInYear(e,y))}
function dmFerieAuditFiltered(rows){
 const f=dmFerieAuditFilters,q=String(f.dm||'').toLocaleLowerCase('it-IT').trim();
 return rows.filter(e=>{
  if(q&&!String(e.employee_name||'').toLocaleLowerCase('it-IT').includes(q))return false;
  if(f.field&&String(e.field_label||'')!==f.field)return false;
  if(f.date&&holidayPlanningAuditPlanDate(e)!==f.date)return false;
  if(f.week&&holidayPlanningAuditWeekKey(e)!==f.week)return false;
  if(f.month&&holidayPlanningAuditMonthKey(e)!==String(f.month))return false;
  return true;
 });
}
function dmFerieAuditTableMarkup(rows){
 const body=rows.map(e=>{
  const t=new Date(e.created_at),when=Number.isFinite(t.getTime())?t.toLocaleString('it-IT',{timeZone:'Europe/Rome'}):'—';
  const who=String(e.actor_display_name||e.actor_username||'—')+(e.actor_role?' · '+String(e.actor_role):'');
  const what=[holidayPlanningAuditPlanDate(e)?fmtDate(holidayPlanningAuditPlanDate(e)):'',e.field_label].filter(Boolean).join(' · ')||'—';
  const diff=['Prima: '+holidayPlanningAuditFormatValue(e.old_value),'Dopo: '+holidayPlanningAuditFormatValue(e.new_value),e.details||''].filter(Boolean).join(' · ');
  return `<tr><td>${esc(when)}</td><td>${esc(e.employee_name||'Tutti i DM')}</td><td>${esc(who)}</td><td>${esc(e.action_label||e.action||'Modifica')}</td><td>${esc(what)}</td><td>${esc(diff)}</td></tr>`;
 }).join('');
 return '<table class="data-table"><thead><tr><th>Data e ora</th><th>DM</th><th>Chi</th><th>Attività</th><th>Data planning / campo</th><th>Variazione</th></tr></thead><tbody>'+body+'</tbody></table>';
}
function dmFerieAuditOptions(rows){
 const set=(id,key,values,label)=>{
  const el=$('#dmFerieAuditFilter'+id);if(!el)return;
  const prev=dmFerieAuditFilters[key];
  el.innerHTML='<option value="">'+(id==='Week'?'Tutte':'Tutti')+'</option>'+values.map(v=>`<option value="${esc(v)}">${esc(label(v))}</option>`).join('');
  if(values.includes(prev))el.value=prev;else{dmFerieAuditFilters[key]='';el.value=''}
 };
 set('Week','week',[...new Set(rows.map(holidayPlanningAuditWeekKey).filter(Boolean))].sort(),v=>'W'+v.split('-W')[1]+' · '+v.split('-W')[0]);
 set('Month','month',[...new Set(rows.map(holidayPlanningAuditMonthKey).filter(Boolean))].sort(),v=>MONTHS[Number(v.slice(5,7))-1]+' '+v.slice(0,4));
 set('Field','field',[...new Set(rows.map(e=>String(e.field_label||'')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'it')),v=>v);
}
function dmFerieAuditCharts(rows){
 const peaks=$('#dmFerieAuditPeaks'),summaries=[];
 for(const [kind,id] of [['week','#dmFerieAuditWeeklyChart'],['month','#dmFerieAuditMonthlyChart']]){
  const host=$(id);if(!host)continue;
  const groups=holidayPlanningAuditGroupRows(rows,kind);
  if(!groups.length){host.innerHTML='<div class="empty">Nessuna modifica con data planning per questo filtro.</div>';continue}
  const maxC=Math.max(...groups.map(g=>g.count)),maxH=Math.max(...groups.map(g=>g.hours));
  const pc=groups.find(g=>g.count===maxC),ph=maxH?groups.find(g=>g.hours===maxH):null;
  summaries.push((kind==='week'?'WEEK':'MESE')+': più modifiche '+pc.label+' ('+maxC+')'+(ph?' · più ore variate '+ph.label+' ('+holidayHoursFmt(maxH)+' h)':''));
  host.innerHTML=groups.map(g=>{
   const cw=Math.max(0,Math.min(100,100*g.count/maxC)),hw=maxH?Math.max(0,Math.min(100,100*g.hours/maxH)):0;
   const cls=(g.count===maxC?' audit-peak-count':'')+(maxH>0&&g.hours===maxH?' audit-peak-hours':'');
   return `<button type="button" class="holiday-audit-chart-row${cls}" data-dm-audit-period="${kind}" data-dm-audit-key="${esc(g.key)}" aria-label="${esc(g.label+'; '+g.count+' modifiche; '+holidayHoursFmt(g.hours)+' ore variate. Apri registro')}">`
    +`<span class="holiday-audit-chart-label">${esc(g.label)}</span><span class="holiday-audit-chart-bars"><span class="holiday-audit-track"><span class="holiday-audit-fill count" style="width:${cw.toFixed(2)}%"></span></span>`
    +`<span class="holiday-audit-track"><span class="holiday-audit-fill hours" style="width:${hw.toFixed(2)}%"></span></span></span>`
    +`<span class="holiday-audit-chart-count">${g.count} mod.</span><span class="holiday-audit-chart-hours">${holidayHoursFmt(g.hours)} h</span></button>`;
  }).join('');
  host.querySelectorAll('[data-dm-audit-period]').forEach(b=>b.onclick=()=>openDmFerieAuditPeriod(b.dataset.dmAuditPeriod,b.dataset.dmAuditKey));
 }
 if(peaks)peaks.textContent=summaries.join('   |   ');
}
function openDmFerieAuditPeriod(period,key){
 if(!dmFerieAuditState.complete||!['week','month'].includes(period))return;
 const rows=dmFerieAuditRows().filter(e=>(period==='week'?holidayPlanningAuditWeekKey(e):holidayPlanningAuditMonthKey(e))===key);
 if(!rows.length)return;
 dmFerieAuditModalState={rows,visible:100};
 showModal('Registro Ferie DM · '+(period==='week'?'WEEK ':'MESE ')+esc(key),
  '<p class="muted">Tutti i movimenti del periodo selezionato, indipendentemente dagli altri filtri della tabella.</p>'
  +'<div id="dmFerieAuditModalMeta" class="holiday-view-note"></div><div class="table-scroll holiday-audit-modal-scroll" id="dmFerieAuditModalTable"></div>'
  +'<div class="holiday-audit-modal-actions"><button type="button" class="btn small" id="dmFerieAuditModalMore">Mostra altre 100 righe</button></div>',true);
 dmFerieAuditShowModal();
}
function dmFerieAuditShowModal(){
 const a=dmFerieAuditModalState,host=$('#dmFerieAuditModalTable'),meta=$('#dmFerieAuditModalMeta'),btn=$('#dmFerieAuditModalMore');
 if(!a||!host||!meta||!btn)return;
 const sel=a.rows.slice(0,a.visible),hours=Math.round(a.rows.reduce((n,e)=>n+holidayPlanningAuditHoursChanged(e),0)*100)/100;
 host.innerHTML=dmFerieAuditTableMarkup(sel);
 meta.textContent='Movimenti nel periodo: '+a.rows.length+' · Ore variate: '+holidayHoursFmt(hours)+' h · Visualizzati: '+sel.length;
 btn.classList.toggle('hidden',sel.length>=a.rows.length);btn.onclick=()=>{a.visible+=100;dmFerieAuditShowModal()};
}
function renderDmFerieAudit(){
 const host=$('#dmFerieAuditTable'),more=$('#dmFerieAuditMore'),meta=$('#dmFerieAuditMeta');if(!host||!more||!meta)return;
 const st=dmFerieAuditState,rows=dmFerieAuditRows();
 if(st.complete)dmFerieAuditOptions(rows);
 const filtered=dmFerieAuditFiltered(rows),visible=filtered.slice(0,st.visibleLimit);
 const hours=Math.round(filtered.reduce((n,e)=>n+holidayPlanningAuditHoursChanged(e),0)*100)/100;
 meta.textContent=st.loading?'Caricamento del registro…':st.error?'Caricamento interrotto: '+st.error
  :filtered.length+' modifiche filtrate · '+holidayHoursFmt(hours)+' ore variate · '+visible.length+' righe visualizzate · anno '+st.year;
 host.innerHTML=visible.length?dmFerieAuditTableMarkup(visible):`<div class="empty">${st.loading?'Caricamento registro…':'Nessuna modifica corrispondente ai filtri.'}</div>`;
 const retry=!!st.error,showMore=filtered.length>visible.length;
 more.classList.toggle('hidden',!(retry||showMore));
 const btn=$('#loadMoreDmFerieAudit');if(btn){btn.disabled=st.loading;btn.textContent=retry?'Riprova caricamento':'Mostra altre 150 righe'}
 if(!st.complete){const p=$('#dmFerieAuditPeaks');if(p)p.textContent='';for(const id of ['#dmFerieAuditWeeklyChart','#dmFerieAuditMonthlyChart']){const el=$(id);if(el)el.innerHTML='<div class="empty">Report disponibile dopo il caricamento completo del registro.</div>'}}
 else dmFerieAuditCharts(filtered);
}

/* ------------------------------------------------- smaltimento: scala colore
   Dal rosso (0%) al verde (100% e oltre) passando per arancio e giallo, con
   tutte le gradazioni intermedie. Stessa scala in pagina, Excel e PDF. */
function dmFerieHslRgb(h,s,l){
 s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
 return [f(0),f(8),f(4)].map(v=>Math.round(v*255));
}
function dmFerieSmaltColor(pct){
 const p=Math.max(0,Math.min(100,Number(pct)||0)),hue=Math.round(p*1.25*10)/10; /* 0 rosso · 62,5 giallo · 125 verde */
 const bg=dmFerieHslRgb(hue,70,91),fg=dmFerieHslRgb(hue,62,29),hex=c=>c.map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
 return {hue,bg,fg,bgHex:hex(bg),fgHex:hex(fg)};
}
function dmFerieSmaltPill(pct){
 const c=dmFerieSmaltColor(pct);
 return `<span class="dm-smalt-pill" style="background:rgb(${c.bg.join(',')});color:rgb(${c.fg.join(',')})">${(Number(pct)||0).toFixed(1).replace('.',',')}%</span>`;
}

/* ------------------------------------------------------- scarica Excel e PDF
   Stessi dati della pagina (comprese le modifiche appena digitate): in alto il
   quadro, poi un mese sotto l'altro con i DM in riga e i giorni in colonna. */
function dmFerieExportModel(now=new Date()){
 const d=dmFerieState.data||{},year=dmFerieState.year,dms=d.dms||[];
 const recap=dms.map(dm=>{const m=dmFerieMetrics(dm);return {id:String(dm.dm_id),name:String(dm.display_name||dm.dm_id),ap:holidayHours(dm.residual_ap_hours),ac:holidayHours(dm.projected_ac_hours),...m}});
 const r2=v=>Math.round(v*100)/100,tot=recap.reduce((s,x)=>{for(const k of ['ap','ac','total','planned','residual'])s[k]=r2(s[k]+x[k]);return s},{ap:0,ac:0,total:0,planned:0,residual:0});
 tot.pct=tot.total>0?tot.planned/tot.total*100:0;
 const months=[];
 for(const date of holidayYearDates(year)){
  const mi=date.getMonth();if(!months[mi])months[mi]={index:mi,label:MONTHS[mi],days:[]};
  const ds=isoDate(date);months[mi].days.push({ds,day:date.getDate(),dow:DAYS[date.getDay()],kind:dmFerieDayKind(date,ds),title:dmFerieDayTitle(date,ds)});
 }
 for(const m of months){
  m.rows=recap.map(x=>{const values=m.days.map(g=>dmFerieState.planMap.get(dmFerieKey(x.id,g.ds))||0);return {name:x.name,values,total:r2(values.reduce((a,b)=>a+b,0))}});
  m.dayTotals=m.days.map((g,i)=>r2(m.rows.reduce((a,r)=>a+r.values[i],0)));
  m.total=r2(m.rows.reduce((a,r)=>a+r.total,0));
 }
 const closures=(d.closures||[]).map(c=>({ds:String(c.date).slice(0,10),label:String(c.label||'').trim()})).sort((a,b)=>a.ds.localeCompare(b.ds));
 const stamp=`${isoDate(now).split('-').reverse().join('/')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
 return {year,recap,tot,months,closures,stamp};
}
const DM_FERIE_EXPORT_COLORS={ink:'2B2F33',muted:'596269',head:'F2F4F5',month:'E3E7E9',total:'EEF1F2',line:'E6E9EB',hours:'FFF7D6',neg:'C62828',rose:'984266',
 weekend:['F6C9C9','FDE6E6','7D1F1F'],holiday:['C9E8D2','E4F4E8','1D5C32'],closure:['C8DBF7','E3EDFC','1C4B93']};
function dmFerieFileBase(model){return `FERIE_DM_${model.year}`}
function dmFerieClosuresText(model){return model.closures.map(c=>fmtDate(c.ds)+(c.label?' '+c.label:'')).join('  ·  ')}

function dmFerieXlsxBlob(model){
 const C=DM_FERIE_EXPORT_COLORS,fills=['FFFFFFFF','FFFFFFFF'],fillIdx={},fonts=[],fontIdx={},xfs=[],xfIdx={};
 const fill=hex=>{if(!hex)return 0;const k='FF'+hex;if(fillIdx[k]==null){fillIdx[k]=fills.length;fills.push(k)}return fillIdx[k]};
 const font=(color=C.ink,bold=false,size=10)=>{const k=color+bold+size;if(fontIdx[k]==null){fontIdx[k]=fonts.length;fonts.push(`<font>${bold?'<b/>':''}<sz val="${size}"/><color rgb="FF${color}"/><name val="Aptos"/></font>`)}return fontIdx[k]};
 /* stile: colore testo, grassetto, dimensione, sfondo, allineamento, formato numerico, bordo */
 const style=({color,bold,size,bg,align='center',fmt=0,border=1,wrap=true}={})=>{
  const k=[color,bold,size,bg,align,fmt,border,wrap].join('|');
  if(xfIdx[k]==null){xfIdx[k]=xfs.length;xfs.push(`<xf numFmtId="${fmt}" fontId="${font(color,bold,size)}" fillId="${fill(bg)}" borderId="${border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"${fmt?' applyNumberFormat="1"':''}><alignment horizontal="${align}" vertical="center"${wrap?' wrapText="1"':''}/></xf>`)}
  return xfIdx[k];
 };
 style({border:0,align:'left',wrap:false}); /* 0 = predefinito */
 const rows={},merges=[],rowHeights={},LAST=33,lastCol=colName(LAST);
 const set=(r,c,v,s)=>planningSet(rows,r,c,v,s),span=(r,c1,c2,v,s)=>{for(let c=c1;c<=c2;c++)set(r,c,c===c1?v:'',s);if(c2>c1)merges.push(`${colName(c1)}${r}:${colName(c2)}${r}`)};
 const num=(v,extra={})=>style({bold:true,color:v<0?C.neg:C.ink,...extra});
 let r=1;
 span(r,1,LAST,`FERIE DM · ${model.year}`,style({color:'FFFFFF',bold:true,size:16,bg:'252A2F',align:'left',border:0,wrap:false}));rowHeights[r]=30;r++;
 span(r,1,LAST,`Miroglio Fashion · Fiorella Rubino · ${model.recap.length} District Manager · valori in ore · generato il ${model.stamp}`,style({color:C.muted,bold:true,bg:C.head,align:'left',border:0,wrap:false}));rowHeights[r]=20;r++;
 set(r,1,'LEGENDA',style({color:C.muted,bold:true,align:'left',border:0}));
 [['Sabato e domenica',C.weekend],['Festività nazionali',C.holiday],['Chiusura aziendale',C.closure],['Giornata di ferie',[C.hours,C.hours,C.ink]]].forEach(([t,k],i)=>span(r,2+i*5,5+i*5,t,style({color:k[2],bold:true,bg:k[0],size:9})));
 rowHeights[r]=18;r+=2;
 /* quadro */
 span(r,1,LAST,'QUADRO FERIE DM',style({color:C.rose,bold:true,size:11,align:'left',border:0,wrap:false}));rowHeights[r]=20;r++;
 const heads=['Ore Residue AP','Ore Proiettate AC','Ore Totali AC+AP','Ore Programmate e Godute AC','Ore Residue AC+AP','Smaltimento Ferie'],hs=style({color:C.muted,bold:true,size:9,bg:C.head});
 set(r,1,'DISTRICT MANAGER',style({color:C.muted,bold:true,size:9,bg:C.head,align:'left'}));heads.forEach((t,i)=>span(r,2+i*5,6+i*5,t.toUpperCase(),hs));rowHeights[r]=30;r++;
 const pctStyle=p=>{const c=dmFerieSmaltColor(p);return style({color:c.fgHex,bold:true,bg:c.bgHex,fmt:165})};
 const recapRow=(x,isTotal)=>{const bg=isTotal?C.total:null;
  set(r,1,isTotal?'TOTALE':x.name,style({bold:true,align:'left',bg,wrap:false}));
  ['ap','ac','total','planned','residual'].forEach((k,i)=>span(r,2+i*5,6+i*5,x[k],num(x[k],{bg})));
  span(r,27,31,(x.pct||0)/100,pctStyle(x.pct));rowHeights[r]=18;r++};
 model.recap.forEach(x=>recapRow(x,false));recapRow({...model.tot},true);
 if(model.closures.length){r++;set(r,1,'CHIUSURE AZIENDALI',style({color:C.closure[2],bold:true,align:'left',border:0}));span(r,2,LAST,dmFerieClosuresText(model),style({color:C.closure[2],bg:C.closure[1],align:'left',size:9}));rowHeights[r]=18;r++}
 r++;
 /* un mese sotto l'altro */
 for(const m of model.months){
  span(r,1,LAST,`${m.label} ${model.year}`,style({color:C.ink,bold:true,size:11,bg:C.month,align:'left'}));rowHeights[r]=20;r++;
  const h1=r,h2=r+1;
  set(h1,1,'DISTRICT MANAGER',style({color:C.muted,bold:true,size:9,bg:C.head,align:'left'}));set(h2,1,'',style({bg:C.head}));merges.push(`A${h1}:A${h2}`);
  for(let i=0;i<31;i++){const g=m.days[i],c=2+i;
   if(!g){set(h1,c,'',style({bg:C.head}));set(h2,c,'',style({bg:C.head}));continue}
   const k=g.kind?C[g.kind]:null;
   set(h1,c,g.dow,style({color:k?k[2]:C.muted,bold:true,size:8,bg:k?k[0]:C.head}));
   set(h2,c,g.day,style({color:k?k[2]:C.ink,bold:true,size:9,bg:k?k[0]:C.head}));
  }
  set(h1,LAST,'TOT. MESE',style({color:C.muted,bold:true,size:8,bg:C.head}));set(h2,LAST,'',style({bg:C.head}));merges.push(`${lastCol}${h1}:${lastCol}${h2}`);
  rowHeights[h1]=15;rowHeights[h2]=17;r+=2;
  const line=(label,values,total,isTotal)=>{
   set(r,1,label,style({bold:true,align:'left',bg:isTotal?C.total:null,wrap:false}));
   for(let i=0;i<31;i++){const g=m.days[i],c=2+i;if(!g){set(r,c,'',style({bg:isTotal?C.total:null}));continue}
    const v=values[i],k=g.kind?C[g.kind]:null,bg=isTotal?C.total:(k?k[1]:(v>0?C.hours:null));
    set(r,c,v>0?v:'',style({bold:v>0,size:9,bg}));}
   set(r,LAST,total,style({bold:true,bg:isTotal?C.total:C.head}));rowHeights[r]=16;r++;
  };
  m.rows.forEach(x=>line(x.name,x.values,x.total,false));line('TOTALE',m.dayTotals,m.total,true);
  r++;
 }
 const widths=[30,...Array(31).fill(5.4),10];
 /* si apre con zoom all'80%: stessa vista di insieme della pagina */
 const sheet=planningSheetXml({rows,maxCol:LAST,widths,merges,rowHeights,freeze:{x:1,y:0}}).replace('<sheetView workbookViewId="0">','<sheetView workbookViewId="0" zoomScale="80" zoomScaleNormal="80">');
 const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="165" formatCode="0.0%"/></numFmts><fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fills.slice(2).map(c=>`<fill><patternFill patternType="solid"><fgColor rgb="${c}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills><borders count="2"><border/><border><left style="thin"><color rgb="FFDDE1E4"/></left><right style="thin"><color rgb="FFDDE1E4"/></right><top style="thin"><color rgb="FFDDE1E4"/></top><bottom style="thin"><color rgb="FFDDE1E4"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
 const name=`Ferie DM ${model.year}`;
 const files=[{name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'},
  {name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
  {name:'xl/workbook.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEsc(name)}" sheetId="1" r:id="rId1"/></sheets></workbook>`},
  {name:'xl/_rels/workbook.xml.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
  {name:'xl/styles.xml',data:styles},{name:'xl/worksheets/sheet1.xml',data:sheet}];
 return {bytes:zipStore(files),sheet,styles,styleCount:xfs.length,merges};
}

/* Larghezza indicativa di un testo in Helvetica, per centrare e troncare. */
function dmFeriePdfTextWidth(str,size,bold){
 let w=0;for(const ch of String(str??'')){
  if(/[0-9]/.test(ch))w+=.556;else if(ch===' ')w+=.278;else if(/[.,:;'!|]/.test(ch))w+=.278;else if(ch==='%')w+=.889;
  else if(/[A-Z]/.test(ch))w+=bold?.722:.667;else if(/[mwMW]/.test(ch))w+=.833;else if(/[iljtf]/.test(ch))w+=.28;else w+=bold?.58:.54;
 }return w*size;
}
function dmFeriePdfFit(str,size,bold,max){str=String(str??'');if(dmFeriePdfTextWidth(str,size,bold)<=max)return str;while(str.length>1&&dmFeriePdfTextWidth(str+'…',size,bold)>max)str=str.slice(0,-1);return str+'…'}

function dmFeriePdfBytes(model){
 const W=841.89,H=595.28,M=24,usable=W-2*M,TOP=66,BOTTOM=H-34,hexRgb=h=>[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)),C=DM_FERIE_EXPORT_COLORS;
 const INK=hexRgb(C.ink),MUTED=hexRgb(C.muted),LINE=hexRgb('DDE1E4'),HEAD=hexRgb(C.head),MONTH=hexRgb(C.month),TOTAL=hexRgb(C.total),HOURS=hexRgb(C.hours),NEG=hexRgb(C.neg),ROSE=[157,62,106],WHITE=[255,255,255];
 const rgb=c=>c.map(n=>(n/255).toFixed(3)).join(' '),pages=[];let content=null;
 const rect=(x,top,w,h,fill,stroke,r=0)=>{
  if(fill)content.push(rgb(fill)+' rg');if(stroke)content.push(rgb(stroke)+' RG 0.5 w');const y=H-top-h,op=fill&&stroke?'B':fill?'f':'S';
  if(r){const rad=Math.min(r,h/2,w/2),k=.5522848*rad,x1=x+w,y1=y+h;content.push(`${x+rad} ${y} m ${x1-rad} ${y} l ${x1-rad+k} ${y} ${x1} ${y+rad-k} ${x1} ${y+rad} c ${x1} ${y1-rad} l ${x1} ${y1-rad+k} ${x1-rad+k} ${y1} ${x1-rad} ${y1} c ${x+rad} ${y1} l ${x+rad-k} ${y1} ${x} ${y1-rad+k} ${x} ${y1-rad} c ${x} ${y+rad} l ${x} ${y+rad-k} ${x+rad-k} ${y} ${x+rad} ${y} c ${op}`)}
  else content.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${op}`);
 };
 const line=(x1,t1,x2,t2,color=LINE,width=.5)=>content.push(`${rgb(color)} RG ${width} w ${x1.toFixed(2)} ${(H-t1).toFixed(2)} m ${x2.toFixed(2)} ${(H-t2).toFixed(2)} l S`);
 const text=(x,top,size,str,font='F1',color=INK)=>content.push(`BT /${font} ${size.toFixed(2)} Tf ${rgb(color)} rg ${x.toFixed(2)} ${(H-top-size*.86).toFixed(2)} Td (${actionPlanPdfEscape(str)}) Tj ET`);
 const center=(x,w,top,size,str,font='F1',color=INK)=>text(x+(w-dmFeriePdfTextWidth(str,size,font==='F2'))/2,top,size,str,font,color);
 const right=(x,w,top,size,str,font='F1',color=INK)=>text(x+w-4-dmFeriePdfTextWidth(str,size,font==='F2'),top,size,str,font,color);
 const image=(name,x,top,w,h)=>content.push(`q ${w} 0 0 ${h} ${x} ${H-top-h} cm /${name} Do Q`);
 const fmt=v=>holidayHoursFmt(v),pctTxt=p=>(Number(p)||0).toFixed(1).replace('.',',')+'%';
 const newPage=()=>{content=[];pages.push(content);
  image('ImFR',M,16,157,12.1);image('ImMI',W-M-32,10,32,23);line(M,40,W-M,40,ROSE,1.2);
  if(pages.length>1){text(M,48,10,`FERIE DM · ${model.year}`,'F2',INK);return TOP}
  text(M,50,19,`FERIE DM · ${model.year}`,'F2',INK);
  text(M,74,8.5,`Miroglio Fashion · Fiorella Rubino · ${model.recap.length} District Manager · valori in ore · generato il ${model.stamp}`,'F1',MUTED);
  return 96;
 };
 let top=newPage();
 /* quadro */
 text(M,top,9,'QUADRO FERIE DM','F2',ROSE);top+=15;
 const nameW=230,colW=(usable-nameW)/6,heads=[['ORE RESIDUE','AP'],['ORE PROIETTATE','AC'],['ORE TOTALI','AC+AP'],['ORE PROGRAMMATE','E GODUTE AC'],['ORE RESIDUE','AC+AP'],['SMALTIMENTO','FERIE']];
 rect(M,top,usable,24,HEAD,null);text(M+6,top+9,6.8,'DISTRICT MANAGER','F2',MUTED);
 heads.forEach((h,i)=>{const x=M+nameW+i*colW,al=i===5?center:right;al(x,colW,top+5,6.5,h[0],'F2',MUTED);al(x,colW,top+13,6.5,h[1],'F2',MUTED)});top+=24;
 const recapRow=(x,isTotal)=>{const h=17;if(isTotal){rect(M,top,usable,h,TOTAL,null);line(M,top,W-M,top,[127,138,145],1)}
  text(M+6,top+5,8,dmFeriePdfFit(isTotal?'TOTALE':x.name,8,true,nameW-12),'F2',INK);
  ['ap','ac','total','planned','residual'].forEach((k,i)=>right(M+nameW+i*colW,colW,top+5,8,fmt(x[k]),'F2',x[k]<0?NEG:INK));
  const c=dmFerieSmaltColor(x.pct),pw=52,px=M+nameW+5*colW+colW-4-pw;rect(px,top+2.5,pw,12,c.bg,null,6);center(px,pw,top+5.2,7.5,pctTxt(x.pct),'F2',c.fg);
  top+=h;line(M,top,W-M,top,LINE,.5)};
 model.recap.forEach(x=>recapRow(x,false));recapRow(model.tot,true);
 top+=12;
 /* legenda e chiusure */
 let lx=M;text(lx,top+1,7,'LEGENDA','F2',MUTED);lx+=46;
 for(const [t,k] of [['Sabato e domenica',C.weekend],['Festività nazionali',C.holiday],['Chiusura aziendale',C.closure],['Giornata di ferie',[C.hours,C.hours,C.ink]]]){
  rect(lx,top,10,9,hexRgb(k[0]),LINE,2);text(lx+14,top+1,7,t,'F1',INK);lx+=24+dmFeriePdfTextWidth(t,7,false)+10}
 top+=16;
 if(model.closures.length){text(M,top,7,'CHIUSURE AZIENDALI','F2',hexRgb(C.closure[2]));text(M+92,top,7,dmFeriePdfFit(dmFerieClosuresText(model),7,false,usable-92),'F1',INK);top+=14}
 top+=6;
 /* mesi */
 const mName=112,mTot=42,dayW=(usable-mName-mTot)/31,rowH=13;
 for(const m of model.months){
  const need=16+20+rowH*(m.rows.length+1);
  if(top+need>BOTTOM)top=newPage();
  rect(M,top,usable,16,MONTH,null);text(M+6,top+4.5,8.5,`${m.label} ${model.year}`,'F2',INK);
  right(M,usable,top+4.5,7.5,`Totale mese ${fmt(m.total)} h`,'F2',MUTED);top+=16;
  rect(M,top,usable,20,HEAD,null);text(M+6,top+7,6.5,'DISTRICT MANAGER','F2',MUTED);center(M+usable-mTot,mTot,top+7,6.2,'TOT. MESE','F2',MUTED);
  m.days.forEach((g,i)=>{const x=M+mName+i*dayW,k=g.kind?C[g.kind]:null;if(k)rect(x,top,dayW,20,hexRgb(k[0]),null);
   center(x,dayW,top+3,5.3,g.dow,'F2',k?hexRgb(k[2]):MUTED);center(x,dayW,top+10.5,7,String(g.day),'F2',k?hexRgb(k[2]):INK)});
  const tableTop=top;top+=20;
  const row=(label,values,total,isTotal)=>{
   if(isTotal)rect(M,top,usable,rowH,TOTAL,null);
   values.forEach((v,i)=>{const g=m.days[i],k=g.kind?C[g.kind]:null,bg=isTotal?null:(k?hexRgb(k[1]):(v>0?HOURS:null));if(bg)rect(M+mName+i*dayW,top,dayW,rowH,bg,null);
    if(v>0)center(M+mName+i*dayW,dayW,top+3.6,6.6,fmt(v),'F2',INK)});
   if(!isTotal)rect(M+usable-mTot,top,mTot,rowH,HEAD,null);
   text(M+6,top+3.4,7,dmFeriePdfFit(label,7,true,mName-10),'F2',INK);right(M+usable-mTot,mTot,top+3.4,7,fmt(total),'F2',INK);
   top+=rowH;line(M,top,W-M,top,LINE,.4)};
  m.rows.forEach(x=>row(x.name,x.values,x.total,false));row('TOTALE',m.dayTotals,m.total,true);
  /* griglia verticale */
  line(M+mName,tableTop,M+mName,top,[174,183,188],.9);
  for(let i=1;i<m.days.length;i++)line(M+mName+i*dayW,tableTop,M+mName+i*dayW,top,LINE,.3);
  line(M+mName+m.days.length*dayW,tableTop,M+mName+m.days.length*dayW,top,LINE,.4);line(M+usable-mTot,tableTop,M+usable-mTot,top,[174,183,188],.7);
  rect(M,tableTop-16,usable,top-tableTop+16,null,LINE);
  top+=12;
 }
 pages.forEach((c,i)=>{content=c;line(M,H-24,W-M,H-24,LINE,.65);text(M,H-19,6.8,`MIROGLIO FASHION  |  FIORELLA RUBINO  |  FERIE DM ${model.year}`,'F2',MUTED);right(M,usable,H-19,6.8,`${i+1} / ${pages.length} · A4`,'F1',MUTED)});
 /* oggetti: 1 catalogo, 2 pagine, 3-4 font, 5-6 loghi, 7 info, poi pagina+contenuto */
 const enc=actionPlanPdfBytesFromText,obj=[],n=pages.length,kids=pages.map((_,i)=>`${8+i*2} 0 R`).join(' ');
 obj[1]=actionPlanPdfBuildObject(1,enc('<< /Type /Catalog /Pages 2 0 R >>'));
 obj[2]=actionPlanPdfBuildObject(2,enc(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`));
 obj[3]=actionPlanPdfBuildObject(3,enc('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));
 obj[4]=actionPlanPdfBuildObject(4,enc('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'));
 obj[5]=actionPlanPdfBuildStreamObject(5,`/Type /XObject /Subtype /Image /Width ${ACTION_PLAN_FR_JPEG_SIZE[0]} /Height ${ACTION_PLAN_FR_JPEG_SIZE[1]} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,actionPlanPdfBase64Bytes(ACTION_PLAN_FR_JPEG_B64));
 obj[6]=actionPlanPdfBuildStreamObject(6,`/Type /XObject /Subtype /Image /Width ${ACTION_PLAN_MIROGLIO_JPEG_SIZE[0]} /Height ${ACTION_PLAN_MIROGLIO_JPEG_SIZE[1]} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,actionPlanPdfBase64Bytes(ACTION_PLAN_MIROGLIO_JPEG_B64));
 obj[7]=actionPlanPdfBuildObject(7,enc(`<< /Title (${actionPlanPdfEscape('Ferie DM '+model.year)}) /Author (Miroglio Fashion - Fiorella Rubino) /Creator (AGENDA DM) >>`));
 pages.forEach((c,i)=>{const p=8+i*2;
  obj[p]=actionPlanPdfBuildObject(p,enc(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /ImFR 5 0 R /ImMI 6 0 R >> >> /Contents ${p+1} 0 R >>`));
  obj[p+1]=actionPlanPdfBuildStreamObject(p+1,'',enc(c.join('\n')))});
 const total=obj.length,header=new Uint8Array([37,80,68,70,45,49,46,52,10,37,226,227,207,211,10]),parts=[header],offsets=[];let pos=header.length;
 for(let i=1;i<total;i++){offsets[i]=pos;parts.push(obj[i]);pos+=obj[i].length}
 let xref=`xref\n0 ${total}\n0000000000 65535 f \n`;for(let i=1;i<total;i++)xref+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
 xref+=`trailer\n<< /Size ${total} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${pos}\n%%EOF`;parts.push(enc(xref));
 return actionPlanPdfConcat(parts);
}

function dmFerieExportReady(){if(!dmFerieState.data||!(dmFerieState.data.dms||[]).length){toast('Carica prima il planning Ferie DM.',true);return false}return true}
function downloadDmFerieExcel(){
 if(!dmFerieExportReady())return;
 try{const model=dmFerieExportModel(),out=dmFerieXlsxBlob(model),blob=new Blob([out.bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=dmFerieFileBase(model)+'.xlsx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Excel Ferie DM scaricato')}
 catch(err){console.error('Export Excel Ferie DM',err);toast('Creazione Excel non riuscita: '+(err?.message||err),true)}
}
function downloadDmFeriePdf(){
 if(!dmFerieExportReady())return;
 try{const model=dmFerieExportModel();triggerActionPlanPdfDownload(dmFeriePdfBytes(model),dmFerieFileBase(model)+'.pdf');toast('PDF Ferie DM scaricato')}
 catch(err){console.error('Export PDF Ferie DM',err);toast('Creazione PDF non riuscita: '+(err?.message||err),true)}
}
