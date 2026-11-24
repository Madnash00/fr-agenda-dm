/* ACTION PLAN: percorso guidato KPI / azioni / monitoraggio per DM e NEGOZIO.
   Usa solo i campi già supportati dal backend: objective_text, actions, tools, notes, tasks.
   I dati del percorso (azione+strumento, alert, CHECK con storico) viaggiano nei
   metadati APOBJ2 dentro notes; le azioni restano anche come tasks con i loro
   checkpoint, cosi' PDF, report e backend continuano a leggerle come prima. */
const AP_GUIDED_KPIS=[
 {id:'sales',label:'INCASSATO',unit:'€'},
 {id:'visits',label:'INGRESSI',unit:'ingressi'},
 {id:'cr',label:'CR',unit:'%'},
 {id:'upt',label:'UPT',unit:'capi/scontrino'},
 {id:'asp',label:'ASP',unit:'€'},
 {id:'atv',label:'ATV',unit:'€'},
 {id:'ms',label:'MS',unit:'%'}
];
/* INCASSATO e INGRESSI non si scelgono piu' come obiettivo: restano definiti
   solo per riaprire gli obiettivi gia' salvati con quei KPI. */
const AP_GUIDED_SELECTABLE=['cr','upt','asp','atv','ms'];
const AP_GUIDED_IDEAS={
 sales:{actions:['Definire un target per fascia oraria','Presidiare le fasce a maggior traffico','Contattare clienti con acquisti ricorrenti','Monitorare il gap rispetto al target','Condividere priorità nei briefing','Recuperare opportunità di vendita aperte'],tools:['Report Store Review','Cruscotto vendite','Lista clienti fidelizzate','Briefing di apertura','Analisi vendite per fascia','Agenda follow-up']},
 visits:{actions:['Aggiornare il messaggio delle vetrine','Invitare clienti fidelizzate','Riattivare clienti inattive','Comunicare le novità di collezione','Organizzare consulenze su appuntamento','Analizzare gli ingressi per fascia'],tools:['Piano visual e vetrine','CRM clienti','Inviti personalizzati','Materiale New Collection','Agenda appuntamenti','Report ingressi']},
 cr:{actions:['Accogliere tempestivamente la cliente','Individuare il bisogno di acquisto','Guidare la prova prodotto','Proporre un’alternativa alle obiezioni','Verificare taglie e disponibilità','Analizzare le vendite mancate'],tools:['Checklist accoglienza','Domande di scoperta bisogni','Cabina prova assistita','Schede alternative prodotto','Disponibilità stock','Osservazione e feedback team']},
 upt:{actions:['Proporre un secondo capo coerente','Comporre outfit completi','Suggerire un abbinamento in prova','Valorizzare accessori e complementi','Mostrare più occasioni d’uso','Monitorare capi per scontrino'],tools:['Schede outfit','Tavoli coordinati','Selezione in cabina','Accessori di completamento','Lookbook New Collection','Report UPT']},
 asp:{actions:['Valorizzare dettagli e qualità','Presentare alternative premium','Raccontare benefici dei materiali','Proporre novità pertinenti','Allenare la vendita per valore','Analizzare il mix venduto'],tools:['Schede prodotto','Formazione collezione','Storytelling materiali','Lookbook novità','Role play vendita','Analisi mix prodotto']},
 atv:{actions:['Proporre outfit completi','Associare capi complementari','Presentare un pezzo distintivo','Guidare fra alternative di look','Verificare completamento acquisto','Monitorare valore per scontrino'],tools:['Lookbook outfit','Schede cross-selling','Capi chiave di collezione','Visual e tavoli','Briefing scontrino medio','Report ATV']},
 ms:{actions:['Chiarire la definizione KPI MS','Analizzare lo scostamento MS','Identificare i prodotti che incidono su MS','Condividere un focus MS con il team','Verificare la coerenza delle proposte','Monitorare settimanalmente MS'],tools:['Definizione KPI aziendale','Report Store Review','Report mix venduto','Schede prodotto','Briefing commerciale','Cruscotto MS']}
};
/* Ogni azione ha i propri strumenti. Per un'azione scritta a mano si propongono
   tutti gli strumenti del KPI; lo strumento si puo' sempre scrivere a mano. */
const AP_GUIDED_ACTION_TOOLS={
 cr:{'Accogliere tempestivamente la cliente':['Checklist accoglienza','Osservazione e feedback team','Briefing di apertura'],
  'Individuare il bisogno di acquisto':['Domande di scoperta bisogni','Checklist accoglienza','Role play vendita'],
  'Guidare la prova prodotto':['Cabina prova assistita','Schede alternative prodotto','Selezione in cabina'],
  'Proporre un’alternativa alle obiezioni':['Schede alternative prodotto','Role play vendita','Disponibilità stock'],
  'Verificare taglie e disponibilità':['Disponibilità stock','Vendita da tablet','Schede alternative prodotto'],
  'Analizzare le vendite mancate':['Osservazione e feedback team','Report Store Review','Analisi vendite per fascia']},
 upt:{'Proporre un secondo capo coerente':['Schede outfit','Selezione in cabina','Accessori di completamento'],
  'Comporre outfit completi':['Schede outfit','Tavoli coordinati','Lookbook New Collection'],
  'Suggerire un abbinamento in prova':['Selezione in cabina','Schede outfit','Accessori di completamento'],
  'Valorizzare accessori e complementi':['Accessori di completamento','Tavoli coordinati','Schede outfit'],
  'Mostrare più occasioni d’uso':['Lookbook New Collection','Schede outfit','Tavoli coordinati'],
  'Monitorare capi per scontrino':['Report UPT','Briefing di apertura','Report Store Review']},
 asp:{'Valorizzare dettagli e qualità':['Schede prodotto','Storytelling materiali','Formazione collezione'],
  'Presentare alternative premium':['Schede prodotto','Lookbook novità','Role play vendita'],
  'Raccontare benefici dei materiali':['Storytelling materiali','Schede prodotto','Formazione collezione'],
  'Proporre novità pertinenti':['Lookbook novità','Formazione collezione','Schede prodotto'],
  'Allenare la vendita per valore':['Role play vendita','Formazione collezione','Storytelling materiali'],
  'Analizzare il mix venduto':['Analisi mix prodotto','Report Store Review','Schede prodotto']},
 atv:{'Proporre outfit completi':['Lookbook outfit','Visual e tavoli','Schede cross-selling'],
  'Associare capi complementari':['Schede cross-selling','Lookbook outfit','Visual e tavoli'],
  'Presentare un pezzo distintivo':['Capi chiave di collezione','Lookbook outfit','Visual e tavoli'],
  'Guidare fra alternative di look':['Lookbook outfit','Capi chiave di collezione','Schede cross-selling'],
  'Verificare completamento acquisto':['Briefing scontrino medio','Schede cross-selling','Report ATV'],
  'Monitorare valore per scontrino':['Report ATV','Briefing scontrino medio','Report Store Review']},
 ms:{'Chiarire la definizione KPI MS':['Definizione KPI aziendale','Briefing commerciale','Report Store Review'],
  'Analizzare lo scostamento MS':['Report Store Review','Cruscotto MS','Report mix venduto'],
  'Identificare i prodotti che incidono su MS':['Report mix venduto','Schede prodotto','Cruscotto MS'],
  'Condividere un focus MS con il team':['Briefing commerciale','Definizione KPI aziendale','Cruscotto MS'],
  'Verificare la coerenza delle proposte':['Schede prodotto','Report mix venduto','Briefing commerciale'],
  'Monitorare settimanalmente MS':['Cruscotto MS','Report Store Review','Briefing commerciale']}
};
/* Catalogo azioni dei "Piani di azione CR, ASP + AVT, UPT + MS" (Fiorella
   Rubino, novembre 2026): per ogni KPI le 6 azioni del suo gruppo, ciascuna con
   il COME (azioni concrete), gli strumenti e il KPI di verifica.
   ★ = strumento da preparare in negozio. */
const AP_PPT_ACTIONS=[{"n":1,"g":"cr","action":"Planning orario sui flussi","how":["Incrociare ingressi (per giorno e fascia oraria) con le vendite della singola venditrice","Risorse più performanti nelle fasce di picco","Obiettivo individuale: n° scontrini per ora","Se SPH alto e CR basso: il DM valuta con RM 1 testa/stage in più"],"tools":["Statistiche ingressi per fascia oraria","Report vendite per dipendente","Planning orario settimanale","Tabella obiettivi sc/h ★"],"verify":"CR per fascia oraria, sc/h"},{"n":2,"g":"cr","action":"Aggancio e accoglienza","how":["Saluto e contatto visivo su ogni ingresso, approccio Autogrill","Presidio di welcome area e zone visibili","Fidelity proposta già in aggancio per rompere il ghiaccio (brand, prodotto, vantaggi loyalty)","Chiamate promo compleanno e teleselling solo se previsti da campagna"],"tools":["My T. n°5 (aggancio)","Role play al briefing di apertura","Obiettivo individuale nuove fidelity","Liste clienti CRM per le chiamate"],"verify":"CR, n° nuove fidelity"},{"n":3,"g":"cr","action":"Esplorazione delle esigenze","how":["Domande aperte su occasione d'uso, stile e guardaroba della cliente","Ascolto attivo prima di proporre: niente proposta senza indagine","Proposta legata al CVB emerso dall'indagine"],"tools":["My T. esplorazione delle esigenze","Card tascabile “domande che aprono” ★","Esercitazione a coppie venditrice/cliente"],"verify":"CR per venditrice"},{"n":4,"g":"cr","action":"Selling ceremony in camerino","how":["Accompagnare sempre in camerino e preparare la cabina","Portare già la taglia alternativa, chiedere riscontro sul capo indossato","Curare parole, tono e corpo; congedo con “mi faccia sapere…”"],"tools":["Checklist cerimoniale di camerino ★","“Modella per un giorno”","Affiancamento SM con scheda di osservazione ★"],"verify":"CR, prove chiuse in acquisto"},{"n":5,"g":"cr","action":"Gestione delle obiezioni","how":["Raccogliere le obiezioni più frequenti del negozio (prezzo, vestibilità, “ci penso”)","Per ognuna, una risposta con storytelling convincente sul prodotto","Metodo: accogliere, riformulare, rispondere"],"tools":["Scheda obiezioni-risposte del negozio ★","Pillole prodotto e racconto del Tema","10 minuti di allenamento al briefing"],"verify":"CR per venditrice"},{"n":6,"g":"cr","action":"Allestimento e disponibilità taglie","how":["Nelle giornate di alta affluenza esporre una taglia in più, in modo bilanciato","Con l'ufficio Visual: focus prodotto con esposizione dedicata (stand prezzo civetta)","Vetrine, welcome e zone visibili sempre in ordine"],"tools":["Report ingressi per individuare le giornate di picco","Confronto con ufficio Visual","Check-list visual di apertura ★"],"verify":"CR nelle giornate di picco"},{"n":7,"g":"asp","action":"Proposta dal prezzo più alto","how":["Ascoltare e rispettare la richiesta della cliente","Proporre sempre per primo l'articolo dal prezzo più alto della stessa base","Scendere di prezzo solo se la cliente lo chiede"],"tools":["Lista settimanale “top capi ASP alto” per base ★","Esercitazione in vendita"],"verify":"ASP per venditrice"},{"n":8,"g":"asp","action":"Comunicare il valore del capo","how":["Glossario corretto: tessuti, vestibilità, lavorazioni","Da caratteristica a vantaggio; la cliente deve toccare il prodotto","Gestire in anticipo l'obiezione sul prezzo"],"tools":["Pillole formative e storytelling prodotto","Info clothes","Quiz prodotto settimanale ★"],"verify":"ASP, AVT"},{"n":9,"g":"asp","action":"Esercizio a carrello","how":["Costruire look per occasioni d'uso partendo dai capi più cari","Mettere dal più caro al meno caro","Replicare la stessa proposta in vendita"],"tools":["Carrello di esercitazione","Foto dei look su Workplace","“Modella per un giorno”"],"verify":"AVT"},{"n":10,"g":"asp","action":"Visual a valore","how":["Tenere in appeso i capi di maggior valore","Con il Visual, creare frontali con ASP alto","Se bisogna togliere merce dalla sala, mandare in magazzino i capi ad ASP basso"],"tools":["Confronto con ufficio Visual","Foto dei frontali di riferimento","Check-list visual di apertura ★"],"verify":"ASP"},{"n":11,"g":"asp","action":"Magazzino a semaforo","how":["Piegato: prezzo più alto ad altezza di presa, prezzo più basso agli estremi","Appeso: dal modello più caro al meno caro","Il primo capo che si prende è sempre il più caro"],"tools":["Bollini colore per fascia di prezzo ★","Mappa del magazzino"],"verify":"ASP"},{"n":12,"g":"asp","action":"Obiettivi individuali e coaching","how":["Obiettivi individuali su categoria merceologica o qualità scontrino (AVT e ASP)","Chi ha ASP più alto prepara info clothes per chi lo ha più basso","Comporre lo scontrino con il giusto mix di sconti, monitorando il MD"],"tools":["Report KPI per venditrice","Tabellone obiettivi in retro ★","Report sconti/MD"],"verify":"AVT, ASP, MD"},{"n":13,"g":"upt","action":"Camerino “+1”","how":["In camerino portare sempre un capo complementare a quello in prova","La cabina è il momento della proposta, non solo della prova"],"tools":["My T. n°3 (fase proposta e gestione camerino)","Checklist camerino ★ (la stessa del CR)"],"verify":"UPT"},{"n":14,"g":"upt","action":"Indagine per la proposta aggiuntiva","how":["Chiedere cosa la cliente abbina già, per quale occasione, cosa le manca","Proposta argomentata, con descrizione evocativa e funzionale"],"tools":["My T. indagine per proposta aggiuntiva","Card tascabile domande ★"],"verify":"UPT, % vendite multiple"},{"n":15,"g":"upt","action":"Total look pronti","how":["Preparare in anticipo total look per le occasioni d'uso, con più soluzioni possibili","Usarli in vendita e in welcome area","Ruotare la welcome area con il Visual quando è poco efficace"],"tools":["Workplace: condivisione dei look con la rete","Book foto look del negozio ★","Confronto con ufficio Visual"],"verify":"UPT"},{"n":16,"g":"upt","action":"Capo eroe e contest","how":["Ogni settimana un capo eroe con i suoi abbinamenti pronti","Contest di team sul capo eroe"],"tools":["Pillola sul capo eroe","Classifica contest in retro ★","Report vendite per articolo"],"verify":"Pezzi capo eroe, UPT"},{"n":17,"g":"upt","action":"Accessori e acquisto d'impulso","how":["Accessori avancasse (solo se presente il barbieri)","Proposta in cassa prima della chiusura dello scontrino","Obiettivi individuali sugli accessori"],"tools":["Esposizione avancasse","Obiettivo accessori per venditrice","Report vendite accessori"],"verify":"Pezzi accessori"},{"n":18,"g":"upt","action":"Obiettivi pezzi, MS e promo","how":["Obiettivi individuali su media pezzi e vendita multipla (pezzi e MLP)","Usare promo multipezzo e punti fidelity come argomento per il secondo capo"],"tools":["Report UPT/MS per venditrice","Tabellone obiettivi in retro ★","Meccaniche promo e punti attive"],"verify":"UPT, % vendite multiple"}];
const AP_KPI_GROUP={cr:'cr',asp:'asp',atv:'asp',upt:'upt',ms:'upt'};
const AP_KPI_GROUP_LABEL={cr:'CR · Tasso di conversione',asp:'ASP + AVT · Prezzo medio e scontrino medio',upt:'UPT + MS · Pezzi per scontrino e vendite multiple'};
const AP_GUIDED_MAX_ACTIONS=3,AP_GUIDED_MAX_TOOLS=3;
function apCatalogFor(kpi){const g=AP_KPI_GROUP[kpi];return g?AP_PPT_ACTIONS.filter(a=>a.g===g):[]}
function apCatalogAction(kpi,name){return apCatalogFor(kpi).find(a=>a.action===name)||null}
/* Strumenti proposti: quelli dell'azione del catalogo; per un'azione scritta a
   mano tutti gli strumenti del gruppo KPI. Si puo' sempre aggiungerne uno a mano. */
function apGuidedToolsFor(kpi,action){const c=apCatalogAction(kpi,action);if(c)return c.tools;const all=[];apCatalogFor(kpi).forEach(a=>a.tools.forEach(t=>{if(!all.includes(t))all.push(t)}));return all.length?all:(AP_GUIDED_IDEAS[kpi]?.tools||[])}
function apPairTools(p){if(Array.isArray(p?.tools))return p.tools.map(String).filter(Boolean);return String(p?.tool||'').split(' · ').map(x=>x.trim()).filter(Boolean)}
function apPairHow(kpi,p){if(Array.isArray(p?.how))return p.how;if(typeof p?.how==='string'&&p.how.trim())return p.how.split('\n').map(x=>x.trim()).filter(Boolean);return apCatalogAction(kpi,p?.action)?.how||[]}
function apGuidedMeta(raw){const m=String(raw||'').match(/\n?\[APOBJ2:([A-Za-z0-9+/=]+)\]\s*$/);if(!m)return null;try{return JSON.parse(decodeURIComponent(atob(m[1])))}catch(_){return null}}
function apGuidedNotes(raw){return String(raw||'').replace(/\n?\[APOBJ2:[A-Za-z0-9+/=]+\]\s*$/,'').trim()}
function apGuidedNotesWithMeta(text,meta){return (String(text||'').trim()?String(text).trim()+'\n':'')+'[APOBJ2:'+btoa(encodeURIComponent(JSON.stringify(meta)))+']'}
function apUserLabel(){return String(currentUser?.display_name||currentUser?.username||'').trim()}
/* DISATTIVA: l'obiettivo resta consultabile (in grigio) ma esce dai
   monitoraggi: badge, email di alert, conteggi e avanzamento. Non si riattiva. */
function apObjDisabled(o){const d=apGuidedMeta(o?.notes)?.disabled;return d&&d.at?d:null}
function apObjActive(o){return !apObjDisabled(o)}
function apObjSetDisabled(o){
 const meta=apGuidedMeta(o.notes)||{},at=new Date().toISOString(),by=apUserLabel();
 if(meta.disabled?.at)return o;
 meta.disabled={at,by};meta.edits=[...(Array.isArray(meta.edits)?meta.edits:[]),{at,by,type:'Obiettivo disattivato'}];
 o.notes=apGuidedNotesWithMeta(apGuidedNotes(o.notes),meta);return o;
}
function apConfirmDisable(label,onOk){
 document.querySelector('.ap-confirm-backdrop')?.remove();
 const box=document.createElement('div');box.className='ap-confirm-backdrop';
 box.innerHTML='<div class="ap-confirm" role="dialog" aria-modal="true" aria-labelledby="apConfirmTitle"><h3 id="apConfirmTitle">Disattivare l’obiettivo?</h3>'
  +'<p class="ap-confirm-obj">'+esc(label)+'</p>'
  +'<ul><li>L’obiettivo <b>resta nell’Action Plan</b>, in grigio, e si può sempre consultare con tutto il suo storico.</li>'
  +'<li><b>Non viene più considerato nei monitoraggi</b>: niente email di alert né badge su ACTION PLAN, ed è escluso dal conteggio degli OBJ e dall’avanzamento.</li>'
  +'<li>Non si può più modificare e <b>non si può riattivare</b>.</li>'
  +'<li>La disattivazione diventa definitiva quando salvi l’Action Plan.</li></ul>'
  +'<label><span>Per confermare scrivi <b>DISATTIVA</b></span><input type="text" id="apConfirmInput" autocomplete="off" spellcheck="false"></label>'
  +'<div class="ap-confirm-foot"><button type="button" class="btn small" id="apConfirmCancel">ANNULLA</button><button type="button" class="btn small danger" id="apConfirmOk" disabled>DISATTIVA</button></div></div>';
 document.body.appendChild(box);
 const input=box.querySelector('#apConfirmInput'),ok=box.querySelector('#apConfirmOk'),close=()=>box.remove();
 input.oninput=()=>{ok.disabled=input.value.trim()!=='DISATTIVA'};
 input.onkeydown=e=>{if(e.key==='Enter'&&!ok.disabled)ok.click();if(e.key==='Escape')close()};
 box.querySelector('#apConfirmCancel').onclick=close;
 box.onclick=e=>{if(e.target===box)close()};
 ok.onclick=()=>{if(input.value.trim()!=='DISATTIVA')return;close();onOk()};
 input.focus();
}
/* Storico modifiche dell'obiettivo: una riga per ogni tipo di modifica, con
   data e utente. Si confronta la versione salvata con quella confermata. */
function apObjChangeTypes(old,oldMeta,newText,newMeta){
 const out=[],d=apCheckDateLabel;
 if(String(old?.objective_text||'')!==String(newText||''))out.push('Obiettivo: '+(old?.objective_text||'—')+' → '+newText);
 const before=apGuidedPairsFromMeta(oldMeta,old),after=newMeta.pairs||[];
 after.forEach(p=>{const q=before.find(x=>x.action===p.action);if(!q)out.push('Azione aggiunta: '+p.action+(p.tool?' ('+p.tool+')':''));else if((q.tool||'')!==(p.tool||''))out.push('Strumento di “'+p.action+'”: '+(q.tool||'—')+' → '+(p.tool||'—'))});
 before.forEach(q=>{if(!after.some(p=>p.action===q.action))out.push('Azione tolta: '+q.action)});
 const oldAlerts=(oldMeta?.alerts||[]).map(a=>a.date);
 (newMeta.alerts||[]).forEach(a=>{if(!oldAlerts.includes(a.date))out.push('Alert impostato per il '+d(a.date))});
 const oldChecks=Array.isArray(oldMeta?.checks)?oldMeta.checks:[];
 (newMeta.checks||[]).forEach(c=>{const o=oldChecks.find(x=>x.id===c.id);if(!o)out.push('CHECK del '+d(c.date)+' registrato');else if((c.history||[]).length>(o.history||[]).length)out.push('CHECK del '+d(c.date)+' modificato')});
 return out;
}
function apEditsHtml(edits,open){
 const rows=(Array.isArray(edits)?edits:[]).slice().sort((a,b)=>String(b.at).localeCompare(String(a.at)));
 return '<section class="ap-edits"><button type="button" class="btn small" id="apEditsBtn" aria-expanded="'+!!open+'">STORICO MODIFICHE ('+rows.length+')</button>'
  +'<div class="ap-edits-body'+(open?'':' hidden')+'">'+(rows.length?'<table class="ap-edits-table"><thead><tr><th>DATA</th><th>TIPO MODIFICA</th><th>UTENTE</th></tr></thead><tbody>'
  +rows.map(e=>'<tr><td>'+esc(apCheckStamp(e.at))+'</td><td>'+esc(e.type||'')+'</td><td>'+esc(e.by||'—')+'</td></tr>').join('')+'</tbody></table>'
  :'<p class="ap-checks-empty">Nessuna modifica registrata.</p>')+'</div></section>';
}
function apGuidedAmount(n,u){return Number(n).toLocaleString('it-IT',{maximumFractionDigits:2})+(u==='€'?' €':u==='%'?'%':u==='ingressi'?' ingressi':u==='capi/scontrino'?' capi/scontrino':'')}
function apGuidedProjection(kpi,target,v){
 const d=apYtdCalculate(v);if(!d||!Number.isFinite(target)||target<=0||((kpi==='cr'||kpi==='ms')&&target>100)||(kpi==='visits'&&!Number.isInteger(target)))return null;
 const base={sales:v.sales,visits:d.visitsAC,cr:v.cr,upt:v.upt,asp:v.asp,atv:v.atv,ms:v.ms}[kpi];
 if(!Number.isFinite(base)||base<=0&&kpi!=='ms')return null;
 /* MS: stessa regola del grafico IMPATTO ECONOMICO, da MS AC al target. */
 const msImpact=kpi==='ms'?apYtdMsImpact(v,d.ticketsAC,v.ms,target):null;
 const forecast=kpi==='ms'?(msImpact&&msImpact.k!==null?v.sales+msImpact.value:null):kpi==='sales'?target:v.sales*target/base;
 return {base,sales:v.sales,forecast,delta:forecast===null?null:forecast-v.sales};
}
/* Coppie azione/strumento: dai metadati nuovi, oppure ricostruite dai vecchi
   obiettivi (azioni e strumenti scelti in liste separate). */
/* Coppia azione/strumenti: {action, how:[...], tools:[max 3], tool:"a · b"}.
   'tool' (stringa) resta per CHECK, task, PDF e backend. */
function apPairNorm(kpi,p){const tools=apPairTools(p).slice(0,AP_GUIDED_MAX_TOOLS),action=String(p?.action||''),manual=!!p?.manualAction||(!!action&&!apCatalogAction(kpi,action)),how=apPairHow(kpi,p);
 /* coppie salvate prima del catalogo: l'azione resta 'scritta a mano' con i suoi strumenti; il COME non e' obbligatorio */
 return {action,how,tools,tool:tools.join(' · '),manualAction:manual,legacy:manual&&!how.length}}
function apGuidedPairsFromMeta(meta,old){
 const kpi=meta?.kpi||'';
 if(Array.isArray(meta?.pairs))return meta.pairs.map(p=>apPairNorm(kpi,p));
 const acts=[...(meta?.actions||[]),...(meta?.otherAction?[meta.otherAction]:[])],tools=[...(meta?.tools||[]),...(meta?.otherTool?[meta.otherTool]:[])];
 if(acts.length)return acts.slice(0,AP_GUIDED_MAX_ACTIONS).map((a,i)=>apPairNorm(kpi,{action:a,tool:tools[i]||''}));
 return (Array.isArray(old?.tasks)?old.tasks:[]).slice(0,AP_GUIDED_MAX_ACTIONS).map(t=>apPairNorm(kpi,{action:String(t.task||''),tool:String(t.tools||'')}));
}
function apGuidedPairsHtml(kpi,pairs){
 const cat=apCatalogFor(kpi);
 const rows=pairs.map((p,i)=>{
  const c=apCatalogAction(kpi,p.action),manualA=!!p.action&&!c||!!p.manualAction,picked=apPairTools(p),proposte=(p.action||manualA)?apGuidedToolsFor(kpi,manualA?'':p.action):[];
  const extra=picked.filter(t=>!proposte.includes(t)),taken=pairs.filter((x,j)=>j!==i).map(x=>x.action),full=picked.length>=AP_GUIDED_MAX_TOOLS;
  const how=manualA?'<label class="ap-pair-how-edit">COME · AZIONI CONCRETE<textarea rows="3" maxlength="900" data-ap-pair-how placeholder="Una riga per ogni azione concreta">'+esc((Array.isArray(p.how)?p.how:[]).join('\n'))+'</textarea></label>'
   :(c?'<div class="ap-pair-how"><span>COME · AZIONI CONCRETE</span><ul>'+c.how.map(h=>'<li>'+esc(h)+'</li>').join('')+'</ul>'+(c.verify?'<p class="ap-pair-verify"><b>Verifica:</b> '+esc(c.verify)+'</p>':'')+'</div>':'<p class="ap-pair-hint">Scegli l’azione: qui comparirà il COME.</p>');
  const toolBox=(p.action||manualA)?'<fieldset class="ap-pair-tools"><legend>STRUMENTI <small>'+picked.length+' / '+AP_GUIDED_MAX_TOOLS+' · scegline fino a '+AP_GUIDED_MAX_TOOLS+'</small></legend>'
   +[...proposte,...extra].map(t=>{const on=picked.includes(t);return '<label class="ap-tool-chip'+(on?' selected':'')+'"><input type="checkbox" data-ap-pair-toolbox value="'+esc(t)+'"'+(on?' checked':'')+(!on&&full?' disabled':'')+'> '+esc(t)+'</label>'}).join('')
   +'<div class="ap-tool-add"><input type="text" maxlength="160" data-ap-pair-tool-new placeholder="Altro strumento: scrivilo e premi AGGIUNGI"'+(full?' disabled':'')+'><button type="button" class="btn small" data-ap-pair-tool-add="'+i+'"'+(full?' disabled':'')+'>AGGIUNGI</button></div></fieldset>'
   :'<p class="ap-pair-hint">Gli strumenti si scelgono dopo l’azione.</p>';
  return '<article class="ap-pair" data-ap-pair="'+i+'"><header class="ap-pair-head"><strong>AZIONE '+(i+1)+(c?' <small>· n° '+c.n+' del piano</small>':'')+'</strong><button type="button" class="ap-check-remove" data-ap-pair-remove="'+i+'" aria-label="Togli azione '+(i+1)+'">×</button></header>'
   +'<div class="ap-pair-body"><div class="ap-pair-col"><label>AZIONE<select data-ap-pair-action><option value="">Seleziona un’azione</option>'+cat.map(a=>'<option value="'+esc(a.action)+'"'+(!manualA&&p.action===a.action?' selected':'')+(taken.includes(a.action)?' disabled':'')+'>'+a.n+'. '+esc(a.action)+'</option>').join('')+'<option value="__manual"'+(manualA?' selected':'')+'>Altro: scrivi l’azione</option></select></label>'
   +(manualA?'<input type="text" maxlength="160" data-ap-pair-action-text value="'+esc(p.action||'')+'" placeholder="Scrivi l’azione">':'')+how+'</div>'
   +'<div class="ap-pair-col">'+toolBox+'</div></div></article>';
 }).join('');
 return '<div class="ap-pairs">'+(rows||'<p class="ap-checks-empty">Nessuna azione. Aggiungine una: per ciascuna vedrai il COME e sceglierai fino a '+AP_GUIDED_MAX_TOOLS+' strumenti.</p>')+'</div>'
  +'<div class="ap-pairs-foot"><button type="button" class="btn small primary" id="apAddPairBtn"'+(pairs.length>=AP_GUIDED_MAX_ACTIONS?' disabled':'')+'>+ AGGIUNGI AZIONE</button>'
  +'<span class="ap-pairs-count">'+pairs.length+' / '+AP_GUIDED_MAX_ACTIONS+' azioni</span><span class="ap-pairs-legend">★ strumento da preparare in negozio</span></div>';
}
function apGuidedPairsRead(root,pairs,kpi){
 return [...root.querySelectorAll('[data-ap-pair]')].map(n=>{
  const i=Number(n.dataset.apPair),prev=pairs[i]||{},sa=n.querySelector('[data-ap-pair-action]')?.value||'';
  const manualAction=sa==='__manual',action=manualAction?(n.querySelector('[data-ap-pair-action-text]')?.value.trim()??''):sa;
  /* cambiando azione gli strumenti e il COME scelti prima non valgono piu' */
  const same=action===prev.action&&manualAction===!!prev.manualAction||(manualAction&&prev.manualAction);
  const tools=same?[...n.querySelectorAll('[data-ap-pair-toolbox]:checked')].map(x=>x.value).slice(0,AP_GUIDED_MAX_TOOLS):[];
  const howBox=n.querySelector('[data-ap-pair-how]'),how=manualAction?(howBox?howBox.value.split('\n').map(x=>x.trim()).filter(Boolean):[]):(apCatalogAction(kpi,action)?.how||[]);
  return {action,manualAction,how,tools,tool:tools.join(' · '),legacy:!!(same&&prev.legacy&&action===prev.action)};
 });
}
function openApGuidedObjective(index=null){
 const editor=document.getElementById('actionObjectiveEditor');
 if(!editor)return;
 const old=Number.isInteger(index)?actionPlanDraftObjectives[index]:null,meta=apGuidedMeta(old?.notes);
 const v=apYtdRead('app-');if(!apYtdCalculate(v)){toast('Completa i KPI del PERIODO ACTION PLAN prima di aggiungere un obiettivo.',true);return}
 const pairs=apGuidedPairsFromMeta(meta,old);
 const data={kpi:meta?.kpi||'',target:meta?.target??'',pairs,alerts:Array.isArray(meta?.alerts)?meta.alerts.map(a=>({date:String(a.date||''),set_at:String(a.set_at||''),next_steps:String(a.next_steps||''),by:String(a.by||'')})).filter(a=>a.date):[],disabled:meta?.disabled?.at?meta.disabled:null,edits:Array.isArray(meta?.edits)?meta.edits:[],
  checks:Array.isArray(meta?.checks)?meta.checks.map(c=>({...c,saved:true,rows:(c.rows||[]).map(r=>({...r}))})):apChecksFromTasks(old?.tasks,pairs),legacyNotes:apGuidedNotes(old?.notes),status:old?.status||'IN_PROGRESS'};
 const page=document.getElementById('ap-objectives-page');page?.classList.add('ap-guided-editing');
 editor.classList.remove('hidden');
 editor.innerHTML='<div class="ap-guided-objective"><header class="ap-guided-head"><strong>'+(old?'OBIETTIVO':'AGGIUNGI OBIETTIVO')+'</strong><span id="apGuidedProgress">1 / 3</span><button type="button" class="btn small" id="apGuidedCancel">CHIUDI</button></header><div id="apGuidedStep"></div><div id="apGuidedEdits"></div><footer class="apy-footer ap-guided-footer"><button type="button" class="btn apy-back-button" id="apGuidedPrevious">INDIETRO</button><button type="button" class="btn primary" id="apGuidedContinue">PROCEDI</button></footer></div>';
 const root=editor.querySelector('#apGuidedStep'),next=editor.querySelector('#apGuidedContinue'),back=editor.querySelector('#apGuidedPrevious');
 let step=0;
 const close=()=>{editor.innerHTML='';editor.classList.add('hidden');page?.classList.remove('ap-guided-editing');renderActionPlanObjectivesDraft();requestAnimationFrame(apFitActionPlanStage)};
 const collect=()=>{
  if(step===0){data.kpi=editor.querySelector('#apGuidedKpi')?.value||'';data.target=editor.querySelector('#apGuidedTarget')?.value||''}
  if(step===1)data.pairs=apGuidedPairsRead(root,data.pairs,data.kpi);
  if(step===2)data.checks=apChecksRead(editor);
 };
 const preview=()=>{
  const k=editor.querySelector('#apGuidedKpi')?.value||'',target=apYtdParse(editor.querySelector('#apGuidedTarget')?.value),def=AP_GUIDED_KPIS.find(x=>x.id===k),p=apGuidedProjection(k,target,v),out=editor.querySelector('#apGuidedPreview');
  if(!out)return;
  if(!def||!p){out.innerHTML='<p class="apy-help">Seleziona un KPI e inserisci un target valido.</p>';return}
  out.innerHTML='<div class="ap-guided-metrics"><div><small>AC · PERIODO ACTION PLAN</small><strong>'+apGuidedAmount(p.base,def.unit)+'</strong></div><div><small>OBIETTIVO '+esc(def.label)+'</small><strong>'+apGuidedAmount(target,def.unit)+'</strong></div><div><small>INCASSATO AC</small><strong>'+apYtdEuro(p.sales)+'</strong></div>'+(p.forecast===null?'<div><small>IMPATTO FATTURATO</small><strong>Non stimabile</strong></div>':'<div><small>INCASSATO IPOTETICO</small><strong>'+apYtdEuro(p.forecast)+'</strong></div><div><small>VARIAZIONE POTENZIALE</small><strong class="'+(p.delta>=0?'ap-guided-positive':'ap-guided-negative')+'">'+(p.delta>=0?'+':'')+apYtdEuro(p.delta)+'</strong></div>')+'</div><p class="apy-explain">Stima indicativa: cambia solo il KPI scelto; tutti gli altri valori AC del PERIODO ACTION PLAN rimangono costanti. Gli impatti non sono sommabili.'+(k==='ms'?(p.forecast===null?' Senza scontrini multipli in AC l’effetto di MS non è stimabile.':' MS: ogni scontrino che passa da singolo a multiplo vale i pezzi in più per l’ASP AC.'):'')+'</p>';
 };
 const draw=()=>{
  editor.querySelector('#apGuidedProgress').textContent=(step+1)+' / 3';
  back.disabled=step===0;next.textContent=step===2?'CONFERMA OBIETTIVO':'PROCEDI';
  if(step===0){
   const kpis=AP_GUIDED_KPIS.filter(k=>AP_GUIDED_SELECTABLE.includes(k.id)||k.id===data.kpi);
   root.innerHTML='<h4>1. KPI E TARGET</h4><div class="ap-guided-fields"><label>SELEZIONA KPI<select id="apGuidedKpi"><option value="">Seleziona un KPI</option>'+kpis.map(k=>'<option value="'+k.id+'"'+(data.kpi===k.id?' selected':'')+'>'+k.label+'</option>').join('')+'</select></label><label>VALORE OBIETTIVO <span id="apGuidedUnit"></span><input type="text" inputmode="decimal" id="apGuidedTarget" value="'+esc(data.target)+'" placeholder="Inserisci il valore"></label></div><div id="apGuidedPreview" aria-live="polite"></div>';
   const update=()=>{const k=AP_GUIDED_KPIS.find(x=>x.id===editor.querySelector('#apGuidedKpi').value);editor.querySelector('#apGuidedUnit').textContent=k?'('+k.unit+')':'';preview()};
   editor.querySelector('#apGuidedKpi').onchange=update;editor.querySelector('#apGuidedTarget').oninput=preview;update();
  }else if(step===1){
   root.innerHTML='<h4>2. AZIONI E STRUMENTI</h4><p class="muted">'+esc(AP_KPI_GROUP_LABEL[AP_KPI_GROUP[data.kpi]]||'')+' · fino a '+AP_GUIDED_MAX_ACTIONS+' azioni: scegli tra le 6 del piano d’azione o scrivila tu; per ciascuna leggi il COME e seleziona fino a '+AP_GUIDED_MAX_TOOLS+' strumenti.</p>'+apGuidedPairsHtml(data.kpi,data.pairs);
   const read=()=>{data.pairs=apGuidedPairsRead(root,data.pairs,data.kpi)},redraw=()=>{read();draw()};
   root.querySelectorAll('[data-ap-pair-action],[data-ap-pair-toolbox]').forEach(x=>x.onchange=redraw);
   root.querySelectorAll('[data-ap-pair-action-text],[data-ap-pair-how]').forEach(x=>x.onchange=read);
   root.querySelectorAll('[data-ap-pair-tool-add]').forEach(b=>b.onclick=()=>{const n=b.closest('[data-ap-pair]'),t=n.querySelector('[data-ap-pair-tool-new]')?.value.trim()||'';read();const pr=data.pairs[Number(b.dataset.apPairToolAdd)];if(!t){toast('Scrivi lo strumento da aggiungere.',true);return}if(pr.tools.length>=AP_GUIDED_MAX_TOOLS){toast('Massimo '+AP_GUIDED_MAX_TOOLS+' strumenti per azione.',true);return}if(!pr.tools.includes(t))pr.tools.push(t);pr.tool=pr.tools.join(' · ');draw()});
   root.querySelectorAll('[data-ap-pair-tool-new]').forEach(x=>x.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();x.closest('[data-ap-pair]').querySelector('[data-ap-pair-tool-add]')?.click()}});
   root.querySelectorAll('[data-ap-pair-remove]').forEach(b=>b.onclick=()=>{read();data.pairs.splice(Number(b.dataset.apPairRemove),1);draw()});
   const add=root.querySelector('#apAddPairBtn');if(add)add.onclick=()=>{read();if(data.pairs.length>=AP_GUIDED_MAX_ACTIONS){toast('Massimo '+AP_GUIDED_MAX_ACTIONS+' azioni.',true);return}data.pairs.push({action:'',how:[],tools:[],tool:''});draw()};
  }else{
   root.innerHTML='<h4>3. MONITORAGGIO</h4>'+apAlertsHtml(data)+apChecksHtml(data);
   apAlertsWire(editor,data,draw);apChecksWire(editor,data,draw);
  }
  if(data.disabled){
   root.insertAdjacentHTML('afterbegin','<p class="ap-disabled-banner">OBIETTIVO DISATTIVATO il '+esc(apCheckStamp(data.disabled.at))+(data.disabled.by?' da '+esc(data.disabled.by):'')+': consultabile, escluso dai monitoraggi.</p>');
   root.querySelectorAll('input,select,textarea,button').forEach(x=>{if(x.id!=='apAlertHistoryBtn')x.disabled=true});
   if(step===2)next.textContent='CHIUDI';
  }
  const ed=editor.querySelector('#apGuidedEdits');ed.innerHTML=old?apEditsHtml(data.edits,data.editsOpen):'';
  const eb=ed.querySelector('#apEditsBtn');if(eb)eb.onclick=()=>{collect();data.editsOpen=!data.editsOpen;draw()};
  requestAnimationFrame(apFitActionPlanStage);
 };
 back.onclick=()=>{collect();if(step>0){step--;draw()}};
 editor.querySelector('#apGuidedCancel').onclick=close;
 next.onclick=()=>{
  if(data.disabled){if(step<2){step++;draw()}else close();return}
  collect();
  if(step===0){const target=apYtdParse(data.target);if(!apGuidedProjection(data.kpi,target,v)){toast('Inserisci un KPI e un valore valido. CR e MS max 100%.',true);return}data.target=target;step=1;draw();return}
  if(step===1){
   if(!data.pairs.length){toast('Aggiungi almeno una AZIONE.',true);return}
   if(data.pairs.some(p=>!p.action)){toast('Scegli o scrivi ogni AZIONE.',true);return}
   if(data.pairs.some(p=>p.manualAction&&!p.legacy&&!(p.how||[]).length)){toast('Scrivi il COME dell’azione inserita a mano.',true);return}
   if(data.pairs.some(p=>!(p.tools||[]).length)){toast('Seleziona almeno uno STRUMENTO per ogni azione.',true);return}
   if(data.pairs.some(p=>(p.tools||[]).length>AP_GUIDED_MAX_TOOLS)){toast('Massimo '+AP_GUIDED_MAX_TOOLS+' strumenti per azione.',true);return}
   if(new Set(data.pairs.map(p=>p.action.toLowerCase())).size!==data.pairs.length){toast('La stessa azione è inserita due volte.',true);return}
   step=2;draw();return}
  if(data.checks.some(c=>!c.saved)){toast('Salva o annulla il CHECK aperto prima di confermare l obiettivo.',true);return}
  const def=AP_GUIDED_KPIS.find(x=>x.id===data.kpi),p=apGuidedProjection(data.kpi,Number(data.target),v);if(!def||!p){toast('KPI non valido: verifica il valore target.',true);return}
  const basePairs=data.pairs.map(x=>({action:x.action,how:x.how||[],tools:x.tools||[],tool:(x.tools||[]).join(' · ')})),all=apChecksAllPairs(basePairs,data.checks);
  const checks=data.checks.map(c=>({id:c.id,date:c.date,note:c.note||'',rows:(c.rows||[]).map(r=>({action:r.action,tool:r.tool||'',light:r.light,newAction:r.newAction||'',newTool:r.newTool||''})),created_at:c.created_at||'',history:c.history||[]}));
  const metadata={kpi:data.kpi,target:data.target,ac:p.base,baselineSales:p.sales,projectedSales:p.forecast,projectedDelta:p.delta,pairs:basePairs,actions:basePairs.map(x=>x.action),tools:basePairs.map(x=>x.tool),alerts:data.alerts,checks};
  const objectiveText=def.label+' '+apGuidedAmount(data.target,def.unit),editAt=new Date().toISOString(),editBy=apUserLabel();
  metadata.edits=[...data.edits,...(old?apObjChangeTypes(old,meta,objectiveText,metadata):['Obiettivo creato']).map(type=>({at:editAt,by:editBy,type}))];
  const notes=(data.legacyNotes?data.legacyNotes+'\n':'')+'[APOBJ2:'+btoa(encodeURIComponent(JSON.stringify(metadata)))+']',oldTasks=old?.tasks||[];
  const obj={objective_id:old?.objective_id||'',objective_text:objectiveText,actions:all.map(x=>x.action).join(' · '),tools:[...new Set(all.map(x=>x.tool).filter(Boolean))].join(' · '),status:data.status,notes,tasks:all.map(x=>({task:x.action,tools:x.tool,owner:apPlanOwner(),timing_monitoraggio:'',checkpoints:apChecksToCheckpoints(x.action,data.checks,oldTasks)}))};
  if(old)actionPlanDraftObjectives[index]=obj;else actionPlanDraftObjectives.push(obj);
  if(currentUser?.role==='STORE'){actionPlanStoreDirty=true;++actionPlanStoreRevision}
  close();
 };
 draw();
}
/* Il referente non si dichiara piu' per singolo obiettivo: si indica una volta
   sola sull'Action Plan, e le azioni lo ereditano. */
function apPlanOwner(){return String(document.getElementById('apOwner')?.value||'').trim()}

/* ===========================================================================
   ALERT PROSSIMO CHECK
   Ogni alert e' una data: si aggiungono, non si cancellano (lo garantisce anche
   il backend al salvataggio). Il giorno dell'alert il negozio riceve un'email
   e vede il badge su ACTION PLAN. Nello storico ogni alert scaduto ha il colore
   della distanza dal CHECK piu' vicino: stesso giorno verde, poi giallo e rosso
   fino a 7 giorni prima o dopo; oltre, o senza CHECK, rosso.
   =========================================================================== */
const AP_ALERT_WINDOW_DAYS=7;
function apToday(){return typeof isoDate==='function'?isoDate(new Date()):new Date().toISOString().slice(0,10)}
function apDayDiff(a,b){const x=Date.parse(a+'T12:00:00Z'),y=Date.parse(b+'T12:00:00Z');return Number.isFinite(x)&&Number.isFinite(y)?Math.round((x-y)/86400000):null}
function apAlertLatest(alerts){return (Array.isArray(alerts)?alerts:[]).map(a=>String(a.date||'')).filter(Boolean).sort().pop()||''}
function apAlertMatch(alertDate,checks){
 let best=null;(Array.isArray(checks)?checks:[]).forEach(c=>{if(c.saved===false||!c.date)return;const d=apDayDiff(c.date,alertDate);if(d!==null&&(best===null||Math.abs(d)<Math.abs(best.diff)))best={diff:d,date:c.date}});
 return best;
}
function apAlertColor(diff){
 if(diff===null||diff===undefined||Math.abs(diff)>AP_ALERT_WINDOW_DAYS)return {hue:0,bg:'hsl(0 75% 93%)',fg:'hsl(0 62% 33%)'};
 const hue=Math.round(125*(1-Math.abs(diff)/AP_ALERT_WINDOW_DAYS));
 return {hue,bg:'hsl('+hue+' 70% 91%)',fg:'hsl('+hue+' 62% 27%)'};
}
function apAlertsExpired(alerts,today=apToday()){return (Array.isArray(alerts)?alerts:[]).filter(a=>a.date&&a.date<=today).slice().sort((a,b)=>b.date.localeCompare(a.date))}
/* Storico: tutti gli alert, dal piu' recente. Quelli scaduti hanno il colore
   della distanza dal CHECK; quelli futuri sono neutri (in programma). */
function apAlertsHtml(data){
 const today=apToday(),latest=apAlertLatest(data.alerts),expired=apAlertsExpired(data.alerts,today),open=!!data.alertHistoryOpen;
 const all=(data.alerts||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
 const storico=all.map(a=>{const due=a.date<=today,m=due?apAlertMatch(a.date,data.checks):null,c=due?apAlertColor(m?.diff):{bg:'#f1f3f5',fg:'#44505d'};
  const esito=!due?'In programma':m&&Math.abs(m.diff)<=AP_ALERT_WINDOW_DAYS?'CHECK '+apCheckDateLabel(m.date)+(m.diff===0?' · stesso giorno':' · '+(m.diff>0?'+':'−')+Math.abs(m.diff)+' gg'):'Nessun CHECK entro '+AP_ALERT_WINDOW_DAYS+' giorni';
  return '<li class="ap-alert-row'+(due?'':' is-future')+'" style="background:'+c.bg+';color:'+c.fg+'"><div class="ap-alert-row-head"><strong>ALERT '+apCheckDateLabel(a.date)+'</strong><span>'+esito+'</span></div>'
   +'<div class="ap-alert-row-next"><b>NEXT STEPS:</b> '+(a.next_steps?esc(a.next_steps):'—')+'</div>'
   +'<div class="ap-alert-row-by">Inserito da '+esc(a.by||'—')+(a.set_at?' · '+esc(apCheckStamp(a.set_at)):'')+'</div></li>'}).join('');
 return '<section class="ap-alert-box"><div class="ap-alert-head"><h5>IMPOSTA ALERT PROSSIMO CHECK</h5>'
  +'<span class="ap-alert-current'+(latest&&latest<=today?' is-due':'')+'">'+(latest?(latest<today?'Ultimo alert scaduto: ':latest===today?'Alert di oggi: ':'Prossimo alert: ')+apCheckDateLabel(latest):'Nessun alert impostato')+'</span></div>'
  +'<div class="ap-alert-set"><label class="ap-alert-field">DATA<input type="date" id="apAlertDate" min="'+today+'" aria-label="Data del prossimo check"></label>'
  +'<label class="ap-alert-field ap-alert-next">NEXT STEPS<textarea id="apAlertNext" rows="2" maxlength="500" placeholder="Cosa verificare al prossimo check"></textarea></label>'
  +'<div class="ap-alert-buttons"><button type="button" class="btn small primary" id="apAlertSetBtn">IMPOSTA ALERT</button>'
  +'<button type="button" class="btn small" id="apAlertHistoryBtn" aria-expanded="'+open+'">STORICO ALERT ('+all.length+')</button></div></div>'
  +'<p class="ap-alert-note">Il giorno dell’alert il negozio riceve un’email e vede il badge su ACTION PLAN. Gli alert non si possono cancellare.</p>'
  +'<ul class="ap-alert-history'+(open?'':' hidden')+'">'+(storico||'<li class="ap-checks-empty">Nessun alert impostato.</li>')+'</ul>'
  +'</section>';
}
function apAlertsWire(editor,data,draw){
 const set=editor.querySelector('#apAlertSetBtn'),hist=editor.querySelector('#apAlertHistoryBtn');
 if(set)set.onclick=()=>{const d=editor.querySelector('#apAlertDate')?.value||'';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d)){toast('Indica la data del prossimo check.',true);return}
  if(d<apToday()){toast('La data dell’alert non può essere nel passato.',true);return}
  if(data.alerts.some(a=>a.date===d)){toast('Alert già impostato per questa data.',true);return}
  const next=editor.querySelector('#apAlertNext')?.value.trim()||'';if(!next){toast('Scrivi i NEXT STEPS dell’alert.',true);return}
  data.checks=apChecksRead(editor);data.alerts.push({date:d,set_at:new Date().toISOString(),next_steps:next,by:apUserLabel()});draw();toast('Alert impostato: '+apCheckDateLabel(d)+'. Salva l’Action Plan per attivarlo.')};
 if(hist)hist.onclick=()=>{data.checks=apChecksRead(editor);data.alertHistoryOpen=!data.alertHistoryOpen;draw()};
}
/* Badge del menu ACTION PLAN (solo profilo NEGOZIO): conta gli obiettivi il cui
   alert piu' recente e' scaduto, cioe' ha data di oggi o passata e non ne e'
   stato impostato uno successivo. */
function apAlertBadgeCount(plans,today=apToday()){
 let n=0;(Array.isArray(plans)?plans:[]).forEach(p=>{if(p&&p.active===false||p?.closed||p?.is_draft)return;(p?.objectives||[]).forEach(o=>{if(apObjDisabled(o))return;const latest=apAlertLatest(apGuidedMeta(o.notes)?.alerts);if(latest&&latest<=today)n++})});
 return n;
}
/* DM: Action Plan da verificare e chiudere = salvati, non chiusi, propri, con
   data di FINE oggi o gia' passata. */
function apCloseBadgeCount(plans,today=apToday(),adminId=String(currentUser?.admin_id||'')){
 return (Array.isArray(plans)?plans:[]).filter(p=>p&&p.active!==false&&!p.is_draft&&!p.closed&&p.end_date&&p.end_date<=today&&(!p.admin_id||!adminId||String(p.admin_id)===adminId)).length;
}
/* Badge su ACTION PLAN: sia sulla voce del sottomenu sia su quella principale.
   NEGOZIO: alert scaduti. DM: Action Plan da chiudere. */
function apUpdateAlertBadge(){
 const store=currentUser?.role==='STORE',dm=currentUser?.role==='ADMIN'&&currentUser?.profile_role==='DM';
 const n=store?apAlertBadgeCount(actionPlanCache?.plans):dm?apCloseBadgeCount(actionPlanCache?.plans):0;
 const label=store?(n===1?' alert scaduto':' alert scaduti'):(n===1?' Action Plan da chiudere':' Action Plan da chiudere');
 [document.querySelector('.nav-btn[data-page="actionplans"]'),document.querySelector('.nav-group-btn[data-nav-group="action-plans"]')].forEach(btn=>{
  if(!btn)return;let b=btn.querySelector('.nav-alert-badge');
  if(!n){if(b)b.remove();btn.removeAttribute('data-alerts');return}
  if(!b){b=document.createElement('span');b.className='nav-alert-badge'+(dm?' nav-close-badge':'');(btn.querySelector('span')&&btn.classList.contains('nav-group-btn')?btn.querySelector('span'):btn).appendChild(b)}
  b.textContent=String(n);b.setAttribute('aria-label',n+label);b.title=n+label;btn.setAttribute('data-alerts',String(n));
 });
}

/* ===========================================================================
   CHECK · sessioni di monitoraggio dell'obiettivo
   Un CHECK e' una data piu' un semaforo per ciascuna azione con il suo
   strumento. Il rosso apre una nuova azione (con strumento), che entra
   nell'elenco e viene monitorata dal CHECK successivo. Un CHECK salvato si
   puo' modificare: ogni modifica successiva al primo salvataggio resta in un
   piccolo storico dentro il CHECK. I CHECK salvati non si cancellano.
   =========================================================================== */
const AP_CHECK_LIGHTS=[
 ['GREEN','🟢','Consolida'],
 ['YELLOW','🟡','Intensifica'],
 ['RED','🔴','Inserisci nuova azione']];

/* Obiettivi salvati prima dei metadati CHECK: le sessioni si ricompongono dai
   checkpoint delle azioni, raggruppandoli per data. */
function apChecksFromTasks(tasks,pairs){
 const perDate=new Map(),toolOf=a=>(pairs||[]).find(p=>p.action===a)?.tool||'';
 (Array.isArray(tasks)?tasks:[]).forEach(t=>{
  (t.checkpoints||[]).forEach(c=>{
   const d=String(c.date||''); if(!d)return;
   if(!perDate.has(d))perDate.set(d,{id:'CHK'+d.replace(/-/g,''),date:d,note:'',rows:[],saved:true,history:[]});
   const check=perDate.get(d);
   if(!check.note&&String(c.note||'').trim())check.note=String(c.note).trim();
   check.rows.push({action:String(t.task||''),tool:String(t.tools||'')||toolOf(String(t.task||'')),light:String(c.contingency||''),newAction:'',newTool:''});
  });
 });
 return [...perDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
}

/* Le coppie su cui si lavora: quelle scelte al passo 2 piu' quelle nate da
   un semaforo rosso nei CHECK gia' salvati, senza ripetizioni. */
function apChecksAllPairs(base,checks){
 const out=base.map(p=>({action:p.action,tool:p.tool||''}));
 (Array.isArray(checks)?checks:[]).forEach(c=>{
  if(c.saved===false)return;
  (c.rows||[]).forEach(r=>{
   const nuova=String(r.newAction||'').trim();
   if(r.light==='RED'&&nuova&&!out.some(x=>x.action===nuova))out.push({action:nuova,tool:String(r.newTool||'').trim()});
  });
 });
 return out;
}
/* Azioni da monitorare in un CHECK: quelle scelte al passo 2, dove un semaforo
   rosso dei CHECK precedenti SOSTITUISCE l'azione con la nuova scritta a mano
   (l'azione superata non viene piu' riproposta). */
function apChecksActivePairs(base,checks){
 const out=(base||[]).map(p=>({action:p.action,tool:p.tool||apPairTools(p).join(' · ')}));
 (Array.isArray(checks)?checks:[]).filter(c=>c.saved!==false).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.created_at||'').localeCompare(String(b.created_at||''))).forEach(c=>{
  (c.rows||[]).forEach(r=>{
   const nuova=String(r.newAction||'').trim();if(r.light!=='RED'||!nuova)return;
   const i=out.findIndex(x=>x.action===r.action),rec={action:nuova,tool:String(r.newTool||'').trim()};
   if(out.some(x=>x.action===nuova))return;
   if(i>=0)out[i]=rec;else out.push(rec);
  });
 });
 return out;
}
/* Compatibilita': elenco delle sole azioni. */
function apChecksAllActions(base,checks){return apChecksAllPairs(base.map(a=>typeof a==='string'?{action:a,tool:''}:a),checks).map(x=>x.action)}

function apChecksToCheckpoints(task,checks,oldTasks){
 const vecchi=(Array.isArray(oldTasks)?oldTasks:[]).find(t=>t.task===task)?.checkpoints||[];
 const dalleSessioni=(Array.isArray(checks)?checks:[]).filter(c=>c.saved!==false&&c.date).map(c=>{
  const r=(c.rows||[]).find(x=>x.action===task);
  return r&&r.light?{date:c.date,note:c.note||'',contingency:r.light}:null;
 }).filter(Boolean);
 /* Un'azione mai toccata da una sessione conserva i propri checkpoint. */
 return dalleSessioni.length?dalleSessioni:vecchi;
}

function apChecksPairsFor(data){return apChecksActivePairs(data.pairs||[],data.checks)}
function apChecksHtml(data){
 const aperto=(data.checks||[]).some(c=>!c.saved);
 /* il CHECK n mostra le azioni attive dopo i CHECK precedenti */
 const blocchi=(data.checks||[]).map((c,i)=>apCheckHtml(c,i,apChecksActivePairs(data.pairs||[],(data.checks||[]).slice(0,i)))).join('');
 return '<section class="ap-checks"><div class="ap-checks-head"><h5>CHECK · MONITORAGGIO</h5>'
  +'<button type="button" class="btn small primary" id="apAddCheckBtn"'+(aperto?' disabled':'')+'>EFFETTUA CHECK</button></div>'
  +(blocchi||'<p class="ap-checks-empty">Nessun CHECK. Usa EFFETTUA CHECK per registrare l’esito delle azioni.</p>')
  +'</section>';
}

function apCheckRowLabel(r){return esc(r.action)+(r.tool?' <small>· '+esc(r.tool)+'</small>':'')}
function apCheckHtml(c,i,coppie){
 const storico=Array.isArray(c.history)?c.history:[];
 if(c.saved)return '<div class="ap-check ap-check-saved" data-ap-check="'+i+'">'
  +'<div class="ap-check-summary"><strong>CHECK '+(c.date?apCheckDateLabel(c.date):'senza data')+'</strong>'
  +'<span class="ap-check-counts">'+AP_CHECK_LIGHTS.map(([k,icona])=>icona+' '+(c.rows||[]).filter(r=>r.light===k).length).join(' · ')+'</span>'
  +(storico.length?'<span class="ap-check-edited">modificato '+storico.length+(storico.length===1?' volta':' volte')+'</span>':'')
  +'<button type="button" class="btn small" data-ap-check-edit="'+i+'">MODIFICA</button></div>'
  +'<ul class="ap-check-mini">'+(c.rows||[]).map(r=>{const l=AP_CHECK_LIGHTS.find(x=>x[0]===r.light);return '<li><span aria-hidden="true">'+(l?l[1]:'⚪')+'</span> '+apCheckRowLabel(r)+(l?' · <em>'+l[2]+'</em>':'')+(r.light==='RED'&&r.newAction?' → <b>'+esc(r.newAction)+'</b>'+(r.newTool?' <small>· '+esc(r.newTool)+'</small>':''):'')+'</li>'}).join('')+'</ul>'
  +(c.note?'<p class="ap-check-mini-note">'+esc(c.note)+'</p>':'')
  +'</div>';
 const righe=coppie.map((p,j)=>{
  const r=(c.rows||[]).find(x=>x.action===p.action)||{light:'',newAction:'',newTool:''};
  return '<div class="ap-check-action" data-ap-check-action="'+esc(p.action)+'" data-ap-check-tool="'+esc(p.tool||'')+'">'
   +'<span class="ap-check-action-text">'+apCheckRowLabel(p)+'</span>'
   +'<div class="ap-check-lights" role="radiogroup" aria-label="Esito di '+esc(p.action)+'">'
   +AP_CHECK_LIGHTS.map(([k,icona,etichetta])=>'<label class="ap-check-light ap-check-'+k.toLowerCase()+(r.light===k?' selected':'')+'">'
     +'<input type="radio" name="apCheck'+i+'_'+j+'" value="'+k+'" data-ap-check-light'+(r.light===k?' checked':'')+'>'
     +'<span aria-hidden="true">'+icona+'</span> '+etichetta+'</label>').join('')
   +'</div>'
   +'<div class="ap-check-new'+(r.light==='RED'?'':' hidden')+'"><label>NUOVA AZIONE<input type="text" maxlength="160" data-ap-check-new value="'+esc(r.newAction||'')+'" placeholder="Azione da monitorare al CHECK successivo"></label>'
   +'<label>STRUMENTO<input type="text" maxlength="160" data-ap-check-new-tool value="'+esc(r.newTool||'')+'" placeholder="Strumento della nuova azione"></label></div>'
   +'</div>';
 }).join('');
 return '<div class="ap-check ap-check-open" data-ap-check="'+i+'">'
  +'<div class="ap-check-head"><label>DATA CHECK<input type="date" data-ap-check-date min="'+esc(apCheckMinDate(c))+'" value="'+esc(c.date||'')+'"></label></div>'
  +'<div class="ap-check-actions">'+(righe||'<p class="ap-checks-empty">Nessuna azione selezionata al passo 2.</p>')+'</div>'
  +'<label class="ap-check-note">NOTE<textarea rows="2" data-ap-check-note placeholder="Cosa è emerso da questo check">'+esc(c.note||'')+'</textarea></label>'
  +(c.isNew?'<div class="ap-check-next-alert"><strong>PROSSIMO ALERT · obbligatorio</strong><p>Dopo ogni CHECK si fissa il successivo: data e cosa verificare.</p><div class="ap-check-next-grid"><label>DATA<input type="date" data-ap-check-alert-date min="'+esc(apToday())+'" value="'+esc(c.nextAlert?.date||'')+'"></label><label>NEXT STEPS<textarea rows="2" maxlength="500" data-ap-check-alert-next placeholder="Cosa verificare al prossimo check">'+esc(c.nextAlert?.next||'')+'</textarea></label></div></div>':'')
  +(storico.length?'<div class="ap-check-history"><strong>MODIFICHE DOPO IL PRIMO SALVATAGGIO</strong><ul>'+storico.map(h=>'<li><b>'+esc(apCheckStamp(h.at))+'</b> · '+(h.changes||[]).map(esc).join(' · ')+'</li>').join('')+'</ul></div>':'')
  +'<div class="ap-check-foot"><button type="button" class="btn small" data-ap-check-cancel="'+i+'">ANNULLA</button><button type="button" class="btn primary small" data-ap-check-save="'+i+'">SALVA CHECK</button></div>'
  +'</div>';
}

function apCheckDateLabel(d){
 const p=String(d||'').split('-');
 return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:String(d||'');
}
function apCheckStamp(iso){const t=new Date(iso);if(!Number.isFinite(t.getTime()))return String(iso||'');const p=n=>String(n).padStart(2,'0');return p(t.getDate())+'/'+p(t.getMonth()+1)+'/'+t.getFullYear()+' '+p(t.getHours())+':'+p(t.getMinutes())}

/* Legge dal documento il CHECK aperto, cosi' tornando indietro e avanti nel
   wizard non si perde nulla. I CHECK gia' salvati restano come sono. */
function apChecksRead(editor){
 const blocchi=[...editor.querySelectorAll('[data-ap-check]')];
 if(!blocchi.length)return apChecksState;
 return blocchi.map(n=>{
  const i=Number(n.dataset.apCheck),precedente=apChecksState[i]||{};
  if(n.classList.contains('ap-check-saved'))return precedente;
  return {...precedente,
   date:n.querySelector('[data-ap-check-date]')?.value||'',
   note:n.querySelector('[data-ap-check-note]')?.value.trim()||'',
   rows:[...n.querySelectorAll('[data-ap-check-action]')].map(r=>({
    action:r.dataset.apCheckAction,tool:r.dataset.apCheckTool||'',
    light:r.querySelector('[data-ap-check-light]:checked')?.value||'',
    newAction:r.querySelector('[data-ap-check-new]')?.value.trim()||'',
    newTool:r.querySelector('[data-ap-check-new-tool]')?.value.trim()||''})),
   ...(precedente.isNew?{nextAlert:{date:n.querySelector('[data-ap-check-alert-date]')?.value||'',next:n.querySelector('[data-ap-check-alert-next]')?.value.trim()||''}}:{}),
   saved:false};
 });
}
let apChecksState=[];

/* Differenze fra la versione salvata e quella nuova, in parole. */
function apCheckChanges(prima,dopo){
 const out=[],nome=k=>(AP_CHECK_LIGHTS.find(x=>x[0]===k)||[,,'—'])[2];
 if(prima.date!==dopo.date)out.push('data '+apCheckDateLabel(prima.date)+' → '+apCheckDateLabel(dopo.date));
 (dopo.rows||[]).forEach(r=>{const p=(prima.rows||[]).find(x=>x.action===r.action);
  if(!p){out.push(r.action+': '+nome(r.light));return}
  if(p.light!==r.light)out.push(r.action+': '+nome(p.light)+' → '+nome(r.light));
  if((p.newAction||'')!==(r.newAction||'')||(p.newTool||'')!==(r.newTool||''))out.push(r.action+': nuova azione '+(r.newAction||'—')+(r.newTool?' ('+r.newTool+')':''));});
 if((prima.note||'')!==(dopo.note||''))out.push('note aggiornate');
 return out;
}

function apChecksWire(editor,data,draw){
 apChecksState=data.checks;
 const aggiorna=()=>{data.checks=apChecksRead(editor);apChecksState=data.checks};
 const bottone=editor.querySelector('#apAddCheckBtn');
 if(bottone)bottone.onclick=()=>{
  aggiorna();
  if(data.checks.some(c=>!c.saved)){toast('Completa il CHECK aperto.',true);return}
  data.checks.push({id:'CHK'+Date.now().toString(36).toUpperCase(),date:apToday(),note:'',rows:[],saved:false,isNew:true,history:[]});
  draw();
 };
 editor.querySelectorAll('[data-ap-check-light]').forEach(radio=>radio.onchange=()=>{
  const riga=radio.closest('[data-ap-check-action]'),campo=riga?.querySelector('.ap-check-new');
  riga?.querySelectorAll('.ap-check-light').forEach(l=>l.classList.toggle('selected',l.contains(radio)));
  if(campo)campo.classList.toggle('hidden',radio.value!=='RED');
 });
 editor.querySelectorAll('[data-ap-check-edit]').forEach(b=>b.onclick=()=>{
  aggiorna();
  if(data.checks.some(c=>!c.saved)){toast('Completa il CHECK aperto.',true);return}
  const c=data.checks[Number(b.dataset.apCheckEdit)];
  if(c){c.snapshot=JSON.parse(JSON.stringify({date:c.date,note:c.note,rows:c.rows}));c.saved=false}
  draw();
 });
 editor.querySelectorAll('[data-ap-check-cancel]').forEach(b=>b.onclick=()=>{
  aggiorna();
  const i=Number(b.dataset.apCheckCancel),c=data.checks[i];if(!c)return;
  if(c.isNew)data.checks.splice(i,1);
  else{Object.assign(c,c.snapshot||{});delete c.snapshot;c.saved=true}
  draw();
 });
 editor.querySelectorAll('[data-ap-check-save]').forEach(b=>b.onclick=()=>{
  aggiorna();
  const i=Number(b.dataset.apCheckSave),c=data.checks[i];
  if(!c)return;
  const errore=apCheckValidate(c);
  if(errore){toast(errore,true);return}
  let nuovoAlert='';
  if(c.isNew){c.created_at=new Date().toISOString();delete c.isNew;
   const a=c.nextAlert;delete c.nextAlert;
   if(a&&a.date&&Array.isArray(data.alerts)&&!data.alerts.some(x=>x.date===a.date)){data.alerts.push({date:a.date,set_at:new Date().toISOString(),next_steps:a.next,by:apUserLabel()});nuovoAlert=a.date}}
  else if(c.snapshot){const changes=apCheckChanges(c.snapshot,c);if(changes.length)(c.history=c.history||[]).push({at:new Date().toISOString(),changes})}
  delete c.snapshot;c.saved=true;
  draw();
  toast(nuovoAlert?'CHECK salvato · prossimo alert '+apCheckDateLabel(nuovoAlert):'CHECK salvato');
  if(typeof data.onCheckSaved==='function')data.onCheckSaved();
 });
}

/* La DATA CHECK non puo' essere precedente a oggi (data del dispositivo
   dell'utente). Un CHECK gia' salvato puo' tenere la sua data originale. */
function apCheckMinDate(c,today=apToday()){const orig=c?.snapshot?.date||'';return orig&&orig<today?orig:today}
function apCheckValidate(c,today=apToday()){
 if(!c.date)return 'Indica la DATA CHECK.';
 if(c.date<today&&!(c.snapshot&&c.snapshot.date===c.date))return 'La DATA CHECK non può essere precedente a oggi.';
 if(!c.rows.length)return 'Non ci sono azioni da monitorare.';
 if(c.rows.some(r=>!r.light))return 'Assegna un semaforo a ogni azione.';
 if(c.rows.some(r=>r.light==='RED'&&!r.newAction))return 'Con il semaforo rosso indica la nuova azione da monitorare.';
 if(c.rows.some(r=>r.light==='RED'&&!r.newTool))return 'Con il semaforo rosso indica anche lo STRUMENTO della nuova azione.';
 if(c.isNew){const a=c.nextAlert||{};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(a.date||''))return 'Imposta la data del PROSSIMO ALERT.';
  if(a.date<=c.date)return 'Il PROSSIMO ALERT deve essere successivo alla data del CHECK.';
  if(!a.next)return 'Scrivi i NEXT STEPS del prossimo alert.';}
 return '';
}

/* ===========================================================================
   BOX OBIETTIVO (pagina STEP 04 · OBIETTIVI) e finestra CHECK MONITORAGGIO
   =========================================================================== */
function apObjCardHtml(o,i,opts={}){
 const meta=apGuidedMeta(o.notes)||{},off=apObjDisabled(o),def=AP_GUIDED_KPIS.find(k=>k.id===meta.kpi),closed=!!opts.closed;
 const pairs=apChecksActivePairs(apGuidedPairsFromMeta(meta,o),(meta.checks||[]).map(c=>({...c,saved:true})));
 const alerts=(meta.alerts||[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))),today=apToday(),next=alerts.filter(a=>a.date>=today)[0],lastDue=alerts.filter(a=>a.date<today).pop();
 const checks=(meta.checks||[]).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))),last=checks[0];
 const due=!next&&lastDue;
 return '<article class="action-obj-card ap-obj-card'+(off?' is-disabled':'')+'" data-ap-obj-card="'+i+'">'
  +'<header class="ap-obj-card-head"><span class="ap-obj-num">OBJ '+(i+1)+'</span><strong>'+esc(o.objective_text||'')+'</strong><span class="action-status '+actionPlanStatusClass(o.status)+'">'+(off?'Disattivato':actionPlanStatusLabel(o.status))+'</span></header>'
  +(off?'<p class="action-obj-disabled">DISATTIVATO il '+esc(apCheckStamp(off.at))+(off.by?' da '+esc(off.by):'')+' · escluso dai monitoraggi</p>':'')
  +(def?'<div class="ap-obj-kpi"><div><small>AC PERIODO</small><b>'+apGuidedAmount(meta.ac,def.unit)+'</b></div><span aria-hidden="true">→</span><div><small>OBIETTIVO '+esc(def.label)+'</small><b>'+apGuidedAmount(meta.target,def.unit)+'</b></div></div>':'')
  +'<ul class="ap-obj-actions">'+pairs.map(p=>'<li><b>'+esc(p.action)+'</b>'+(p.tool?'<small>'+esc(p.tool)+'</small>':'')+'</li>').join('')+'</ul>'
  +'<div class="ap-obj-monitor"><span class="'+(due?'is-due':'')+'">⏰ '+(next?'Prossimo alert '+apCheckDateLabel(next.date):due?'Alert scaduto il '+apCheckDateLabel(lastDue.date):'Nessun alert')+'</span>'
  +(next?.next_steps||due?.next_steps?'<span class="ap-obj-next">'+esc((next||due).next_steps)+'</span>':'')
  +'<span>✔ '+(last?'Ultimo CHECK '+apCheckDateLabel(last.date):'Nessun CHECK')+'</span></div>'
  +'<footer class="action-obj-actions">'+(closed||off?(meta.kpi?'<button type="button" class="btn small" data-ap-obj-edit="'+i+'">Consulta</button>':'')
   :(meta.kpi&&!opts.draft?'<button type="button" class="btn small primary" data-ap-obj-check="'+i+'">EFFETTUA CHECK</button>':'')+'<button type="button" class="btn small" data-ap-obj-edit="'+i+'">Modifica</button><button type="button" class="btn small danger" data-ap-obj-disable="'+i+'">DISATTIVA</button>')+'</footer>'
  +'</article>';
}
/* Aggiorna CHECK e alert di un obiettivo (e i task/checkpoint collegati) senza
   toccare KPI, obiettivo e azioni scelte. */
function apObjApplyMonitoring(o,checks,alerts){
 const meta=apGuidedMeta(o.notes)||{},at=new Date().toISOString(),by=apUserLabel(),before={...meta};
 const pairs=apGuidedPairsFromMeta(meta,o),base=pairs.map(x=>({action:x.action,how:x.how||[],tools:x.tools||[],tool:x.tool||''}));
 meta.checks=checks.map(c=>({id:c.id,date:c.date,note:c.note||'',rows:(c.rows||[]).map(r=>({action:r.action,tool:r.tool||'',light:r.light,newAction:r.newAction||'',newTool:r.newTool||''})),created_at:c.created_at||'',history:c.history||[]}));
 meta.alerts=alerts;
 const types=apObjChangeTypes(o,before,o.objective_text,{...meta,pairs:meta.pairs||base});
 meta.edits=[...(Array.isArray(meta.edits)?meta.edits:[]),...types.map(type=>({at,by,type}))];
 const all=apChecksAllPairs(base,meta.checks.map(c=>({...c,saved:true})));
 o.notes=apGuidedNotesWithMeta(apGuidedNotes(o.notes),meta);
 o.actions=all.map(x=>x.action).join(' · ');o.tools=[...new Set(all.map(x=>x.tool).filter(Boolean))].join(' · ');
 o.tasks=all.map(x=>({task:x.action,tools:x.tool,owner:apPlanOwner(),timing_monitoraggio:'',checkpoints:apChecksToCheckpoints(x.action,meta.checks.map(c=>({...c,saved:true})),o.tasks||[])}));
 return o;
}
function apOpenCheckWindow(index){
 const o=actionPlanDraftObjectives[index];if(!o)return;const meta=apGuidedMeta(o.notes);if(!meta?.kpi){toast('Il CHECK si fa sugli obiettivi del percorso guidato.',true);return}
 document.querySelector('.ap-check-window')?.remove();
 const pairs=apGuidedPairsFromMeta(meta,o);
 const data={kpi:meta.kpi,pairs,alerts:(meta.alerts||[]).map(a=>({...a})),checks:(meta.checks||[]).map(c=>({...c,saved:true,rows:(c.rows||[]).map(r=>({...r}))})),alertHistoryOpen:false};
 data.checks.push({id:'CHK'+Date.now().toString(36).toUpperCase(),date:apToday(),note:'',rows:[],saved:false,isNew:true,history:[]});
 const box=document.createElement('div');box.className='ap-check-window';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
 box.innerHTML='<div class="ap-check-window-inner"><header><div><small>CHECK MONITORAGGIO</small><h3>OBJ '+(index+1)+' · '+esc(o.objective_text||'')+'</h3></div><button type="button" class="icon-btn" data-ap-cw-close aria-label="Chiudi">×</button></header><div class="ap-check-window-body" id="apCheckWindowBody"></div></div>';
 /* dentro il modulo Action Plan, cosi' eredita gli stili del monitoraggio */
 (document.getElementById('actionPlanForm')||document.body).appendChild(box);
 box.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName!=='TEXTAREA')e.preventDefault()});
 const body=box.querySelector('#apCheckWindowBody'),close=()=>box.remove();
 let saved=false;
 const draw=()=>{body.innerHTML=apChecksHtml(data);apChecksWire(body,data,draw);
  /* qui si registra un CHECK alla volta */
  body.querySelectorAll('[data-ap-check-edit]').forEach(b=>b.remove());const add=body.querySelector('#apAddCheckBtn');if(add)add.remove();
  if(saved){body.insertAdjacentHTML('afterbegin','<p class="ap-check-window-ok">CHECK registrato. Salvataggio dell’Action Plan in corso…</p>')}
 };
 data.onCheckSaved=()=>{saved=true;apObjApplyMonitoring(o,data.checks.filter(c=>c.saved),data.alerts);if(currentUser?.role==='STORE'){actionPlanStoreDirty=true;++actionPlanStoreRevision}renderActionPlanObjectivesDraft();close();
  /* salvataggio immediato; finche' non va a buon fine il CHECK resta 'da salvare' e chiudere chiede conferma */
  actionPlanPendingMonitoring=true;apShowPendingMonitoring();
  const form=document.getElementById('actionPlanForm');if(form)form.dispatchEvent(new Event('submit',{cancelable:true}))};
 box.querySelector('[data-ap-cw-close]').onclick=()=>{if(!saved&&!window.confirm('Chiudere senza salvare il CHECK?'))return;close()};
 draw();
 box.querySelector('[data-ap-check-date]')?.focus();
}

/* ===========================================================================
   CHIUDI ACTION PLAN (solo DM). Per ogni obiettivo attivo: valore consolidato,
   delta rispetto all'obiettivo (in unita' e in %) ed emoji dell'esito; nota
   finale e data di chiusura. NEGOZIO ed RM consultano in sola lettura.
   Dopo la chiusura gli alert del piano non partono piu'.
   =========================================================================== */
const AP_CLOSE_SCALE=[[5,'🏆','Oltre l’obiettivo','top'],[0,'✅','Obiettivo raggiunto','ok'],[-5,'🤏','Quasi raggiunto','near'],[-15,'⚠️','Sotto l’obiettivo','warn'],[-Infinity,'❌','Lontano dall’obiettivo','ko']];
function apCloseEsito(deltaPct){if(deltaPct===null||deltaPct===undefined||!Number.isFinite(Number(deltaPct)))return {emoji:'➖',label:'Senza obiettivo numerico',cls:'na'};const d=Number(deltaPct),r=AP_CLOSE_SCALE.find(x=>d>=x[0]);return {emoji:r[1],label:r[2],cls:r[3]}}
function apCloseDelta(final,target){const f=Number(final),t=Number(target);if(!Number.isFinite(f)||!Number.isFinite(t)||target===''||target===null||target===undefined)return {delta:null,pct:null};return {delta:f-t,pct:t!==0?(f-t)/Math.abs(t)*100:null}}
function apCloseFmtDelta(d,unit){if(d===null||d===undefined)return '—';const sign=d>0?'+':d<0?'−':'±',abs=Math.abs(d),n=abs.toLocaleString('it-IT',{minimumFractionDigits:unit==='€'&&abs>=100?0:2,maximumFractionDigits:2});return sign+n+(unit==='%'?' pt':unit==='€'?' €':unit==='capi/scontrino'?' pz':unit?' '+unit:'')}
function apCloseRows(plan){
 const saved=new Map((Array.isArray(plan?.close_results)?plan.close_results:[]).map(r=>[String(r.objective_id),r]));
 return (plan?.objectives||[]).filter(apObjActive).map(o=>{const m=apGuidedMeta(o.notes)||{},def=AP_GUIDED_KPIS.find(k=>k.id===m.kpi),r=saved.get(String(o.objective_id));
  return {o,meta:m,def,unit:def?.unit||'',ac:Number.isFinite(Number(m.ac))?Number(m.ac):null,target:m.target===''||m.target===undefined||m.target===null?null:Number(m.target),final:r?Number(r.final_value):null}});
}
function apCanClosePlan(plan){return currentUser?.role==='ADMIN'&&currentUser?.profile_role==='DM'&&!!plan&&!plan.is_draft&&(!plan.admin_id||String(plan.admin_id)===String(currentUser.admin_id))}
function apOpenClosePage(plan,opts={}){
 if(!plan){toast('Action Plan non disponibile.',true);return}
 const edit=!opts.readOnly&&apCanClosePlan(plan),rows=apCloseRows(plan),today=apToday(),store=typeof actionPlanStoreLabel==='function'?actionPlanStoreLabel(plan.store_id,plan):'';
 const row=(x,i)=>{const d=apCloseDelta(x.final,x.target),e=x.final===null||!Number.isFinite(x.final)?null:apCloseEsito(d.pct);
  return '<tr data-ap-close-row="'+i+'"><td><b>OBJ '+(i+1)+'</b><br>'+esc(x.o.objective_text||'')+'</td><td>'+(x.ac===null?'—':esc(apGuidedAmount(x.ac,x.unit)))+'</td><td><b>'+(x.target===null?'—':esc(apGuidedAmount(x.target,x.unit)))+'</b></td>'
   +'<td>'+(edit?'<input type="text" inputmode="decimal" data-ap-close-final value="'+(x.final===null||!Number.isFinite(x.final)?'':esc(String(x.final).replace('.',',')))+'" placeholder="Consolidato'+(x.unit?' ('+esc(x.unit)+')':'')+'" aria-label="Valore consolidato OBJ '+(i+1)+'">':'<b>'+(x.final===null||!Number.isFinite(x.final)?'—':esc(apGuidedAmount(x.final,x.unit)))+'</b>')+'</td>'
   +'<td data-ap-close-delta class="'+(d.delta>0?'is-up':d.delta<0?'is-down':'')+'">'+(x.final===null?'—':esc(apCloseFmtDelta(d.delta,x.unit))+(d.pct!==null?' <small>('+(d.pct>=0?'+':'−')+Math.abs(d.pct).toLocaleString('it-IT',{maximumFractionDigits:1})+'%)</small>':''))+'</td>'
   +'<td data-ap-close-esito>'+(e?'<span class="ap-close-esito ap-close-'+e.cls+'"><span aria-hidden="true">'+e.emoji+'</span> '+esc(e.label)+'</span>':'—')+'</td></tr>'};
 const html='<div class="ap-close-page"><header class="apy-hero"><small>CHIUSURA ACTION PLAN</small><h3>'+(plan.closed?'Action Plan chiuso':'Verifica finale degli obiettivi')+'</h3><p>'+esc(store)+' · '+esc(actionPlanPeriodLabel(plan))+' · inizio '+esc(fmtDmy(plan.plan_date||''))+(plan.end_date?' · fine '+esc(fmtDmy(plan.end_date)):'')+(plan.closed?' · chiuso il '+esc(fmtDmy(plan.close_date||''))+(plan.closed_by?' da '+esc(plan.closed_by):''):'')+'</p></header>'
  +(rows.length?'<div class="ap-close-table-wrap"><table class="data-table ap-close-table"><thead><tr><th>Obiettivo</th><th>AC iniziale</th><th>Obiettivo fissato</th><th>Consolidato</th><th>Delta vs obiettivo</th><th>Esito</th></tr></thead><tbody>'+rows.map(row).join('')+'</tbody></table></div>':'<div class="empty">Nessun obiettivo attivo.</div>')
  +'<p class="ap-close-legend">'+AP_CLOSE_SCALE.map(x=>x[1]+' '+x[2]+(Number.isFinite(x[0])?(x[0]>0?' (≥ +'+x[0]+'%)':x[0]===0?' (≥ 0%)':' (≥ '+x[0]+'%)'):' (oltre −15%)')).join(' · ')+'</p>'
  +'<div class="ap-close-fields"><label>DATA DI CHIUSURA<input type="date" id="apCloseDate" value="'+esc(plan.close_date||today)+'" min="'+esc(plan.plan_date||'')+'"'+(edit?'':' disabled')+'></label>'
  +'<label class="full">NOTA FINALE<textarea id="apCloseNote" rows="4" maxlength="4000" placeholder="Cosa ha funzionato, cosa portiamo nel prossimo Action Plan"'+(edit?'':' disabled')+'>'+esc(plan.close_note||'')+'</textarea></label></div>'
  +(!plan.closed&&!edit?'<p class="ap-close-info">Il DM non ha ancora chiuso questo Action Plan.</p>':'')
  +'<div class="modal-actions"><span class="spacer"></span><button type="button" class="btn" id="apCloseCancel">'+(edit?'Annulla':'Chiudi')+'</button>'+(edit?'<button type="button" class="btn primary" id="apCloseSave">'+(plan.closed?'AGGIORNA CHIUSURA':'CHIUDI ACTION PLAN')+'</button>':'')+'</div></div>';
 showModal('Chiusura Action Plan · '+store,html,true);document.querySelector('#modalRoot .modal')?.classList.add('ap-fullpage','ap-close-modal');
 document.getElementById('apCloseCancel').onclick=()=>closeModal();
 if(!edit)return;
 const refresh=tr=>{const i=Number(tr.dataset.apCloseRow),x=rows[i],v=apYtdParse(tr.querySelector('[data-ap-close-final]').value);x.final=Number.isFinite(v)?v:null;const d=apCloseDelta(x.final,x.target),e=x.final===null?null:apCloseEsito(d.pct),dc=tr.querySelector('[data-ap-close-delta]');
  dc.className=d.delta>0?'is-up':d.delta<0?'is-down':'';dc.innerHTML=x.final===null?'—':esc(apCloseFmtDelta(d.delta,x.unit))+(d.pct!==null?' <small>('+(d.pct>=0?'+':'−')+Math.abs(d.pct).toLocaleString('it-IT',{maximumFractionDigits:1})+'%)</small>':'');
  tr.querySelector('[data-ap-close-esito]').innerHTML=e?'<span class="ap-close-esito ap-close-'+e.cls+'"><span aria-hidden="true">'+e.emoji+'</span> '+esc(e.label)+'</span>':'—'};
 document.querySelectorAll('[data-ap-close-row]').forEach(tr=>tr.querySelector('[data-ap-close-final]').addEventListener('input',()=>refresh(tr)));
 document.getElementById('apCloseSave').onclick=async()=>{
  document.querySelectorAll('[data-ap-close-row]').forEach(refresh);
  const missing=rows.findIndex(x=>x.final===null);if(missing>=0){toast('Inserisci il valore consolidato di OBJ '+(missing+1)+'.',true);document.querySelectorAll('[data-ap-close-final]')[missing]?.focus();return}
  const date=document.getElementById('apCloseDate').value;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){toast('Indica la data di chiusura.',true);return}
  if(plan.plan_date&&date<plan.plan_date){toast('La data di chiusura non può precedere la data di inserimento.',true);return}
  if(!plan.closed&&!window.confirm('Chiudere l’Action Plan di '+store+'?\n\nGli alert dei suoi obiettivi non partiranno più e il piano non sarà più modificabile.'))return;
  const btn=document.getElementById('apCloseSave');btn.disabled=true;btn.textContent='Chiusura in corso…';
  try{const saved=await window.agendaCloudApi.request('closeActionPlan',{plan_id:plan.plan_id,close_date:date,close_note:document.getElementById('apCloseNote').value.trim(),results:rows.map(x=>({objective_id:x.o.objective_id,final_value:x.final}))});
   if(!saved?.plan_id)throw new Error('Il server non ha confermato la chiusura.');
   actionPlanCache=actionPlanCache||{plans:[]};const k=actionPlanCache.plans.findIndex(p=>String(p.plan_id)===String(saved.plan_id));if(k>=0)actionPlanCache.plans[k]=saved;else actionPlanCache.plans.unshift(saved);actionPlanReportCache=null;
   closeModal(true);renderActionPlans();apUpdateAlertBadge();toast(plan.closed?'Chiusura aggiornata.':'Action Plan chiuso.');
  }catch(err){toast(err.message||'Chiusura non riuscita',true);if(btn.isConnected){btn.disabled=false;btn.textContent=plan.closed?'AGGIORNA CHIUSURA':'CHIUDI ACTION PLAN'}}
 };
}

/* CHECK registrato ma Action Plan non ancora salvato (es. conferma DM annullata). */
function apShowPendingMonitoring(){const page=document.getElementById('ap-objectives-page');if(!page)return;let b=page.querySelector('.ap-pending-banner');if(!actionPlanPendingMonitoring){b?.remove();return}
 if(!b){b=document.createElement('div');b.className='ap-pending-banner';(page.querySelector('.apy-hero')||page.firstChild)?.after?.(b)}
 b.innerHTML='<b>CHECK registrato ma non ancora salvato.</b> Premi SALVA ACTION PLAN per confermarlo.'}
function apConfirmDiscardMonitoring(){return !actionPlanPendingMonitoring||window.confirm('Hai registrato un CHECK che non è ancora stato salvato. Chiudere e perderlo?')}
