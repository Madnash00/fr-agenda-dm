/* ACTION PLAN: percorso guidato KPI / azioni / monitoraggio per DM e NEGOZIO.
   Usa solo i campi già supportati dal backend: objective_text, actions, tools, notes, tasks. */
const AP_GUIDED_KPIS=[
 {id:'sales',label:'INCASSATO',unit:'€'},
 {id:'visits',label:'INGRESSI',unit:'ingressi'},
 {id:'cr',label:'CR',unit:'%'},
 {id:'upt',label:'UPT',unit:'capi/scontrino'},
 {id:'asp',label:'ASP',unit:'€'},
 {id:'atv',label:'ATV',unit:'€'},
 {id:'ms',label:'MS',unit:'€'}
];
const AP_GUIDED_IDEAS={
 sales:{actions:['Definire un target per fascia oraria','Presidiare le fasce a maggior traffico','Contattare clienti con acquisti ricorrenti','Monitorare il gap rispetto al target','Condividere priorità nei briefing','Recuperare opportunità di vendita aperte'],tools:['Report Store Review','Cruscotto vendite','Lista clienti fidelizzate','Briefing di apertura','Analisi vendite per fascia','Agenda follow-up']},
 visits:{actions:['Aggiornare il messaggio delle vetrine','Invitare clienti fidelizzate','Riattivare clienti inattive','Comunicare le novità di collezione','Organizzare consulenze su appuntamento','Analizzare gli ingressi per fascia'],tools:['Piano visual e vetrine','CRM clienti','Inviti personalizzati','Materiale New Collection','Agenda appuntamenti','Report ingressi']},
 cr:{actions:['Accogliere tempestivamente la cliente','Individuare il bisogno di acquisto','Guidare la prova prodotto','Proporre un’alternativa alle obiezioni','Verificare taglie e disponibilità','Analizzare le vendite mancate'],tools:['Checklist accoglienza','Domande di scoperta bisogni','Cabina prova assistita','Schede alternative prodotto','Disponibilità stock','Osservazione e feedback team']},
 upt:{actions:['Proporre un secondo capo coerente','Comporre outfit completi','Suggerire un abbinamento in prova','Valorizzare accessori e complementi','Mostrare più occasioni d’uso','Monitorare capi per scontrino'],tools:['Schede outfit','Tavoli coordinati','Selezione in cabina','Accessori di completamento','Lookbook New Collection','Report UPT']},
 asp:{actions:['Valorizzare dettagli e qualità','Presentare alternative premium','Raccontare benefici dei materiali','Proporre novità pertinenti','Allenare la vendita per valore','Analizzare il mix venduto'],tools:['Schede prodotto','Formazione collezione','Storytelling materiali','Lookbook novità','Role play vendita','Analisi mix prodotto']},
 atv:{actions:['Proporre outfit completi','Associare capi complementari','Presentare un pezzo distintivo','Guidare fra alternative di look','Verificare completamento acquisto','Monitorare valore per scontrino'],tools:['Lookbook outfit','Schede cross-selling','Capi chiave di collezione','Visual e tavoli','Briefing scontrino medio','Report ATV']},
 ms:{actions:['Chiarire la definizione KPI MS','Analizzare lo scostamento MS','Identificare i prodotti che incidono su MS','Condividere un focus MS con il team','Verificare la coerenza delle proposte','Monitorare settimanalmente MS'],tools:['Definizione KPI aziendale','Report Store Review','Report mix venduto','Schede prodotto','Briefing commerciale','Cruscotto MS']}
};
function apGuidedMeta(raw){const m=String(raw||'').match(/\n?\[APOBJ2:([A-Za-z0-9+/=]+)\]\s*$/);if(!m)return null;try{return JSON.parse(decodeURIComponent(atob(m[1])))}catch(_){return null}}
function apGuidedNotes(raw){return String(raw||'').replace(/\n?\[APOBJ2:[A-Za-z0-9+/=]+\]\s*$/,'').trim()}
function apGuidedAmount(n,u){return Number(n).toLocaleString('it-IT',{maximumFractionDigits:2})+(u==='€'?' €':u==='%'?'%':u==='ingressi'?' ingressi':u==='capi/scontrino'?' capi/scontrino':'')}
function apGuidedProjection(kpi,target,v){
 const d=apYtdCalculate(v);if(!d||!Number.isFinite(target)||target<=0||(kpi==='cr'&&target>100)||(kpi==='visits'&&!Number.isInteger(target)))return null;
 const base={sales:v.sales,visits:d.visitsAC,cr:v.cr,upt:v.upt,asp:v.asp,atv:v.atv,ms:v.ms}[kpi];
 if(!Number.isFinite(base)||base<=0&&kpi!=='ms')return null;
 const forecast=kpi==='ms'?null:kpi==='sales'?target:v.sales*target/base;
 return {base,sales:v.sales,forecast,delta:forecast===null?null:forecast-v.sales};
}
function apGuidedChoiceHtml(type,choices,selected){
 return choices.map((s,i)=>'<label class="ap-guided-choice"><input type="checkbox" data-ap-guided-kind="'+type+'" value="'+i+'"'+(selected.includes(s)?' checked':'')+'><span>'+esc(s)+'</span></label>').join('');
}
function openApGuidedObjective(index=null){
 const editor=document.getElementById('actionObjectiveEditor');
 if(!editor)return;
 const old=Number.isInteger(index)?actionPlanDraftObjectives[index]:null,meta=apGuidedMeta(old?.notes);
 const v=apYtdRead('app-');if(!apYtdCalculate(v)){toast('Completa i KPI del PERIODO ACTION PLAN prima di aggiungere un obiettivo.',true);return}
 const data={kpi:meta?.kpi||'',target:meta?.target??'',actions:meta?.actions||[],tools:meta?.tools||[],otherAction:meta?.otherAction||'',otherTool:meta?.otherTool||'',owner:old?.tasks?.[0]?.owner||'',timing:old?.tasks?.[0]?.timing_monitoraggio||'',nextSteps:apGuidedNotes(old?.notes),status:old?.status||'IN_PROGRESS'};
 const page=document.getElementById('ap-objectives-page');page?.classList.add('ap-guided-editing');
 editor.classList.remove('hidden');
 editor.innerHTML='<div class="ap-guided-objective"><header class="ap-guided-head"><strong>AGGIUNGI OBIETTIVO</strong><span id="apGuidedProgress">1 / 3</span><button type="button" class="btn small" id="apGuidedCancel">CHIUDI</button></header><div id="apGuidedStep"></div><footer class="apy-footer ap-guided-footer"><button type="button" class="btn apy-back-button" id="apGuidedPrevious">INDIETRO</button><button type="button" class="btn primary" id="apGuidedContinue">PROCEDI</button></footer></div>';
 const root=editor.querySelector('#apGuidedStep'),next=editor.querySelector('#apGuidedContinue'),back=editor.querySelector('#apGuidedPrevious');
 let step=0;
 const close=()=>{editor.innerHTML='';editor.classList.add('hidden');page?.classList.remove('ap-guided-editing');renderActionPlanObjectivesDraft();requestAnimationFrame(apFitActionPlanStage)};
 const collect=()=>{
  if(step===0){data.kpi=editor.querySelector('#apGuidedKpi')?.value||'';data.target=editor.querySelector('#apGuidedTarget')?.value||''}
  if(step===1){const ideas=AP_GUIDED_IDEAS[data.kpi];data.actions=[...editor.querySelectorAll('[data-ap-guided-kind="actions"]:checked')].map(x=>ideas.actions[Number(x.value)]);data.tools=[...editor.querySelectorAll('[data-ap-guided-kind="tools"]:checked')].map(x=>ideas.tools[Number(x.value)]);data.otherAction=editor.querySelector('#apGuidedOtherAction')?.value.trim()||'';data.otherTool=editor.querySelector('#apGuidedOtherTool')?.value.trim()||''}
  if(step===2){data.owner=editor.querySelector('#apGuidedOwner')?.value.trim()||'';data.timing=editor.querySelector('#apGuidedTiming')?.value||'';data.nextSteps=editor.querySelector('#apGuidedNextSteps')?.value.trim()||''}
 };
 const preview=()=>{
  const k=editor.querySelector('#apGuidedKpi')?.value||'',target=apYtdParse(editor.querySelector('#apGuidedTarget')?.value),def=AP_GUIDED_KPIS.find(x=>x.id===k),p=apGuidedProjection(k,target,v),out=editor.querySelector('#apGuidedPreview');
  if(!out)return;
  if(!def||!p){out.innerHTML='<p class="apy-help">Seleziona un KPI e inserisci un target valido.</p>';return}
  out.innerHTML='<div class="ap-guided-metrics"><div><small>AC · PERIODO ACTION PLAN</small><strong>'+apGuidedAmount(p.base,def.unit)+'</strong></div><div><small>OBIETTIVO '+esc(def.label)+'</small><strong>'+apGuidedAmount(target,def.unit)+'</strong></div><div><small>INCASSATO AC</small><strong>'+apYtdEuro(p.sales)+'</strong></div>'+(p.forecast===null?'<div><small>IMPATTO FATTURATO</small><strong>Non stimabile per MS</strong></div>':'<div><small>INCASSATO IPOTETICO</small><strong>'+apYtdEuro(p.forecast)+'</strong></div><div><small>VARIAZIONE POTENZIALE</small><strong class="'+(p.delta>=0?'ap-guided-positive':'ap-guided-negative')+'">'+(p.delta>=0?'+':'')+apYtdEuro(p.delta)+'</strong></div>')+'</div><p class="apy-explain">Stima indicativa: cambia solo il KPI scelto; tutti gli altri valori AC del PERIODO ACTION PLAN rimangono costanti. Gli impatti non sono sommabili.'+(k==='ms'?' L’effetto sul fatturato di MS non è ricavabile dai soli dati disponibili.':'')+'</p>';
 };
 const draw=()=>{
  editor.querySelector('#apGuidedProgress').textContent=(step+1)+' / 3';
  back.disabled=step===0;next.textContent=step===2?'CONFERMA OBIETTIVO':'PROCEDI';
  if(step===0){
   root.innerHTML='<h4>1. KPI E TARGET</h4><div class="ap-guided-fields"><label>SELEZIONA KPI<select id="apGuidedKpi"><option value="">Seleziona un KPI</option>'+AP_GUIDED_KPIS.map(k=>'<option value="'+k.id+'"'+(data.kpi===k.id?' selected':'')+'>'+k.label+'</option>').join('')+'</select></label><label>VALORE OBIETTIVO <span id="apGuidedUnit"></span><input type="text" inputmode="decimal" id="apGuidedTarget" value="'+esc(data.target)+'" placeholder="Inserisci il valore"></label></div><div id="apGuidedPreview" aria-live="polite"></div>';
   const update=()=>{const k=AP_GUIDED_KPIS.find(x=>x.id===editor.querySelector('#apGuidedKpi').value);editor.querySelector('#apGuidedUnit').textContent=k?'('+k.unit+')':'';preview()};
   editor.querySelector('#apGuidedKpi').onchange=update;editor.querySelector('#apGuidedTarget').oninput=preview;update();
  }else if(step===1){
   const ideas=AP_GUIDED_IDEAS[data.kpi];
   root.innerHTML='<h4>2. AZIONI E STRUMENTI</h4><p class="muted">Seleziona al massimo 3 azioni e 3 strumenti. Puoi aggiungere una voce personalizzata per ciascun gruppo.</p><div class="ap-guided-columns"><section><h5>AZIONI · 6 PROPOSTE</h5>'+apGuidedChoiceHtml('actions',ideas.actions,data.actions)+'<label class="ap-guided-other">ALTRO · AZIONE<textarea id="apGuidedOtherAction" rows="2">'+esc(data.otherAction)+'</textarea></label></section><section><h5>STRUMENTI · 6 PROPOSTE</h5>'+apGuidedChoiceHtml('tools',ideas.tools,data.tools)+'<label class="ap-guided-other">ALTRO · STRUMENTO<textarea id="apGuidedOtherTool" rows="2">'+esc(data.otherTool)+'</textarea></label></section></div>';
   root.querySelectorAll('[data-ap-guided-kind]').forEach(x=>x.onchange=()=>{if(root.querySelectorAll('[data-ap-guided-kind="'+x.dataset.apGuidedKind+'"]:checked').length>3){x.checked=false;toast('Massimo 3 opzioni per gruppo.',true)}});
  }else{
   root.innerHTML='<h4>3. MONITORAGGIO</h4><div class="ap-guided-fields"><label>OWNER<input id="apGuidedOwner" type="text" maxlength="160" value="'+esc(data.owner)+'" placeholder="Referente"></label><label>TIMING<select id="apGuidedTiming"><option value="">Seleziona</option>'+['SETTIMANALE','BISETTIMANALE','MENSILE','BIMESTRALE'].map(t=>'<option'+(data.timing===t?' selected':'')+'>'+t+'</option>').join('')+'</select></label><label class="ap-guided-span">NEXT STEPS<textarea id="apGuidedNextSteps" rows="6" placeholder="Descrivi i prossimi passi, le responsabilità e il piano di lavoro">'+esc(data.nextSteps)+'</textarea></label></div>';
  }
  requestAnimationFrame(apFitActionPlanStage);
 };
 back.onclick=()=>{collect();if(step>0){step--;draw()}};
 editor.querySelector('#apGuidedCancel').onclick=close;
 next.onclick=()=>{
  collect();
  if(step===0){const target=apYtdParse(data.target);if(!apGuidedProjection(data.kpi,target,v)){toast('Inserisci un KPI e un valore valido. CR max 100%; ingressi interi.',true);return}data.target=target;step=1;draw();return}
  if(step===1){if(!(data.actions.length||data.otherAction)||!(data.tools.length||data.otherTool)){toast('Indica almeno una AZIONE e uno STRUMENTO, anche con ALTRO.',true);return}step=2;draw();return}
  if(!data.owner||!data.timing||!data.nextSteps){toast('Compila OWNER, TIMING e NEXT STEPS.',true);return}
  const def=AP_GUIDED_KPIS.find(x=>x.id===data.kpi),p=apGuidedProjection(data.kpi,Number(data.target),v);if(!def||!p){toast('KPI non valido: verifica il valore target.',true);return}
  const actions=[...data.actions,...(data.otherAction?[data.otherAction]:[])],tools=[...data.tools,...(data.otherTool?[data.otherTool]:[])];
  const metadata={kpi:data.kpi,target:data.target,ac:p.base,baselineSales:p.sales,projectedSales:p.forecast,projectedDelta:p.delta,actions:data.actions,tools:data.tools,otherAction:data.otherAction,otherTool:data.otherTool};
  const notes=data.nextSteps+'\n[APOBJ2:'+btoa(encodeURIComponent(JSON.stringify(metadata)))+']',oldTasks=old?.tasks||[];
  const obj={objective_id:old?.objective_id||'',objective_text:def.label+' '+apGuidedAmount(data.target,def.unit),actions:actions.join(' · '),tools:tools.join(' · '),status:data.status,notes,tasks:actions.map(task=>({task,tools:tools.join(' · '),owner:data.owner,timing_monitoraggio:data.timing,checkpoints:oldTasks.find(t=>t.task===task)?.checkpoints||[]}))};
  if(old)actionPlanDraftObjectives[index]=obj;else actionPlanDraftObjectives.push(obj);
  if(currentUser?.role==='STORE'){actionPlanStoreDirty=true;++actionPlanStoreRevision}
  close();
 };
 draw();
}
