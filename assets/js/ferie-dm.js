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

function dmFerieKey(dmId,date){return String(dmId)+'|'+String(date)}
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
 const retry=$('#retryDmFerieSaveBtn');if(retry)retry.onclick=()=>flushDmFerieQueue(true);
 const form=$('#dmFerieClosureForm');if(form)form.onsubmit=e=>{e.preventDefault();addDmFerieClosure()};
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
  void loadDmFerieAudit(true);
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
   +num(m.total)+num(m.planned)+num(m.residual)+`<td><span class="holiday-pct ${holidayPctClass(m.pct)}">${m.pct.toFixed(1)}%</span></td></tr>`;
 }).join('');
 const t=dms.reduce((s,dm)=>{const m=dmFerieMetrics(dm);s.ap+=holidayHours(dm.residual_ap_hours);s.ac+=holidayHours(dm.projected_ac_hours);s.total+=m.total;s.planned+=m.planned;s.residual+=m.residual;return s},{ap:0,ac:0,total:0,planned:0,residual:0});
 const pct=t.total>0?t.planned/t.total*100:0;
 host.innerHTML='<table class="holiday-summary-table"><thead><tr><th>District Manager</th><th>Ore Residue AP</th><th>Ore Proiettate AC</th><th>Ore Totali AC+AP</th><th>Ore Programmate e Godute AC</th><th>Ore Residue AC+AP</th><th>Smaltimento Ferie</th></tr></thead><tbody>'
  +body+`<tr class="holiday-employees-total"><td>TOTALE</td>${num(t.ap)}${num(t.ac)}${num(t.total)}${num(t.planned)}${num(t.residual)}<td><span class="holiday-pct ${holidayPctClass(pct)}">${pct.toFixed(1)}%</span></td></tr></tbody></table>`;
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
 host.innerHTML=h+'</tbody></table>';
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
function dmFerieCalendarRefresh(){
 if(currentUser?.role!=='ADMIN'||typeof refreshCloudState!=='function')return;
 void refreshCloudState().catch(()=>{});
}

/* ----------------------------------------------------- registro modifiche */
async function loadDmFerieAudit(reset=true){
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
