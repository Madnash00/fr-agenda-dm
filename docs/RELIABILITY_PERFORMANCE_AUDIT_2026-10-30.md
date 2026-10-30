# AGENDA DM — Audit, affidabilità e primo intervento P0
**Data:** 30 ottobre 2026  
**Baseline GitHub `main`:** `fd757ea3627ac27a0756b4d2bc9ce0da1b729e4d`  
**Branch di lavoro:** `fix/reliability-write-read-races-20261030`  
**Ambito:** audit statico delle sorgenti, revisione delle chiamate API e test sintetici deterministici; nessun accesso a sessioni di produzione, Google Sheets reale o log Apps Script.

## A. Performance audit

| Componente | Problema | Evidenza nel codice baseline | Impatto UX | Gravità | Causa probabile | Correzione | Rischio regressione |
|---|---|---|---|---|---|---|---|
| API cache | Risposta di lettura precedente a una scrittura può ricreare la cache obsoleta | `cloud-api.js`: `remember()` accetta ogni risposta terminata dopo `invalidateForWrite()`; mancava una generazione per dominio | Dati salvati che sembrano sparire | P0 | Gara tra GET e write, risposta fuori ordine | Generazioni per dominio, barriere di scrittura, refresh delle letture obsolete | Medio: varia la tempistica delle GET |
| API | Lettura avviata durante una mutazione può mostrare dati non ancora aggiornati | `request()` non attendeva i write attivi | Flicker o dati incoerenti | P0 | Nessuna coordinazione read/write | Attesa delle sole scritture del medesimo dominio | Medio |
| Planning ferie | Due salvataggi batch possono sovrapporsi | `flushHolidayPlanQueue()` svuota la coda prima dell'await senza serializzazione | Scrittura in ordine errato o successo prematuro | P0 | Batch concorrenti | Un solo flush, in coda gli aggiornamenti successivi | Medio |
| Planning ferie | Batch fallito reinserisce vecchi valori sopra modifiche successive | `holidayPlanQueue.set(key, x)` incondizionato nel catch | Perdita dell'ultima modifica | P0 | Rollback della coda non basato sulla versione della cella | Reinserimento solo se chiave non già modificata | Basso |
| Planning ferie | Cambio anno/negozio può mostrare risposta del filtro precedente | `loadHolidayPlanning()` mancava request sequencing | Tabella non coerente col filtro | P1 | Response race | Sequenza richiesta e verifica dei filtri | Basso |
| Action Plan | Un refresh vecchio può sovrascrivere una scheda appena salvata | `loadActionPlans()` assegna sempre `actionPlanCache` | Nuova scheda apparentemente scomparsa | P1 | Nessun controllo generazionale del rendering | Sequenza delle letture + invalidazione dopo save | Basso |
| Calendario | Refresh intervallo elimina eventi ancora in attesa di conferma | `syncCalendarRangeFromServer()` sostituisce il range con eventi server | Evento provvisorio scompare visivamente | P1 | Rebuild indiscriminato dello stato locale | Preservazione degli eventi `TMP:` finché la scrittura è in corso | Medio |
| Frontend | Monolite con rendering di grandi tabelle/calendari | `app.js` ≈362k caratteri, 1.555 righe (molte estremamente lunghe); numerosi `innerHTML` | Lentezza e maggiore rischio refactoring | P2 | Alta densità/interdipendenza | Profilazione e ottimizzazioni mirate, non mega-refactoring | Alto |
| Cache | Stale-while-revalidate usato per report ed elenchi | TTL e `AGENDA_CACHE_STALE_FACTOR=6` in `cloud-api.js` | Obsolescenza accettabile solo entro politiche coerenti | P2 | Riutilizzo letture per velocità | Non cambiare policy di dati sensibili senza test backend | Alto |
| Backend | Rischio di doppie scritture e autorizzazioni non verificabile | Repository frontend non contiene Apps Script effettivamente distribuito | Affidabilità/concorrenza e sicurezza non certificabili | P0 *da investigare* | Evidenza insufficiente | Ottenere sorgente deploy, versioni e misure Apps Script | Alto |
| Sicurezza | Autorizzazione SV non collaudabile dal solo frontend | `getStoreCalendarContext` ha cache TTL 0, ma regola server non visibile | Potenziale esposizione dati | P0 *da verificare* | Manca accesso al backend | Test su account di prova e controllo risposta server | Alto |

**Nota:** P0 “da verificare” non significa vulnerabilità accertata. È una lacuna di evidenza da colmare prima di certificare il prodotto.

## Baseline verificabile

- `index.html`: 42.520 caratteri.
- `assets/js/app.js`: 361.873 caratteri, 1.555 righe.
- `assets/js/cloud-api.js`: 15.827 caratteri.
- `assets/css/app.css`: 155.298 caratteri.
- `assets/js/personnel-hours.js`: 11.029 caratteri.
- `assets/css/personnel-hours.css`: 1.710 caratteri.
- 50 azioni API distinte referenziate letteralmente da `app.js` (conteggio statico; **non** misura richieste in rete).
- Il backend indicato dal frontend è un deployment Apps Script; `EXPECTED_BACKEND_BUILD` riporta `2026-10-08-rm-iphone-icon-r31` ma **non prova** quale versione del codice sia effettivamente distribuita.
- I tempi di risposta Apps Script, p50/p95/p99, dimensione delle risposte e Core Web Vitals **non sono stati misurati**: mancano sessioni di collaudo e accesso ai log/backend.

## B. Changelog tecnico (prima tranche)

| File | Problema e causa | Soluzione | Impatto atteso | Verifica | Rischio residuo |
|---|---|---|---|---|---|
| `assets/js/cloud-api.js` | Cache rimpopolata da richieste vecchie e letture simultanee a write | Generazione per dominio, dedup per generazione, write fence, refresh letture obsolete e pulizia | Evita che vecchie risposte riportino lo stato precedente | Test sintetico richieste fuori ordine + check statico | Non sostituisce controllo versione server |
| `assets/js/app.js` | Batch ferie sovrapposti, ripristino di versioni precedenti nella coda, filtri fuori ordine | Flush seriale, preservazione dell'ultima modifica, sequenza richiesta per ferie/Action Plan, conservazione eventi pendenti | Maggior affidabilità del flusso locale | Check statico; collaudo E2E **non eseguito** | Errori di rete dopo commit server producono stato ambiguo: no retry automatici |
| `index.html` | Asset fingerprint obsoleti dopo modifiche JS | Aggiornamento con algoritmo FNV dello script ufficiale | Evita mix di versioni in cache | `scripts/check.mjs` | Browser e CDN reali non profilati |
| `scripts/test-api-reliability.mjs` | Mancavano test di concorrenza | Simulatore di risposte ritardate e dedup senza credenziali | Regressioni rilevabili in CI | Esecuzione su GitHub Actions | Non replica Apps Script/Sheets |
| `.github/workflows/quality.yml` | Solo check strutturali | Aggiunge test API comportamentali | Copertura CI migliore | GitHub Actions | Non è E2E |

## C. Performance report — prima/dopo

| Metrica | Prima | Dopo | Stato |
|---|---|---|---|
| Dimensione sorgente | Valori baseline riportati sopra | File P0 in diff della PR | Misurazione statica, non latenza |
| Richieste di lettura duplicate nello stesso scope | Dedup esistente, non testato nel caso di write | Test sintetico dedup + generazione | Test deterministico, non rete reale |
| Risposta precedente a write che ripopola cache | Possibile per ispezione codice | Protetta da generazione e refresh | Test sintetico |
| Salvare planning con modifiche durante request | Rischio identificato | Serializzazione e conservazione ultime modifiche | Verifica codice; test E2E non eseguito |
| Click-to-feedback, navigazione, rendering calendario | N/D | N/D | Non misurati |
| API p50 / p95 / p99 | N/D | N/D | Non misurati |
| Caricamento iniziale / Web Vitals | N/D | N/D | Non misurati |

I target del master prompt restano obiettivi progettuali; non sono risultati raggiunti o dimostrati.

## D. UX improvement report

Modifiche funzionali senza alterazione del visual design: nelle ferie, durante invio e conferma dei batch lo stato distingue salvataggio in corso, errore e conferma; il cambio filtro non sostituisce il planning con risposte precedenti e non deve scartare celle ancora non confermate. La navigazione generale e i componenti grafici restano invariati. Le altre proposte premium UX sono ancora da sviluppare, dopo il collaudo P0.

## E. Regression report

**Copertura automatica prevista:** `node scripts/check.mjs` (integrità markup, sintassi, asset fingerprint, invarianti storici); `node scripts/test-api-reliability.mjs` (invalidation, dedup, risposte fuori ordine).

**Non eseguiti:** Playwright per ADMIN/DM/RM/NEGOZIO, test autorizzazioni reali e visibilità SV server-side, drag & drop su touchscreen, read-after-write sul database reale, Chrome DevTools Performance e Lighthouse, test rete instabile con salvataggi reali, test visual desktop/mobile. Nessun database di produzione è stato modificato per i test.

## F. Deployment report

- Baseline: `fd757ea3627ac27a0756b4d2bc9ce0da1b729e4d`.
- Branch: `fix/reliability-write-read-races-20261030`.
- PR: [#38](https://github.com/Madnash00/fr-agenda-dm/pull/38), **draft**.
- Pubblicazione frontend `main`: **non eseguita** per questo intervento.
- Apps Script: **nessuna modifica né distribuzione**. La versione effettiva del deployment va confermata accedendo al progetto Apps Script reale.
- Rollback: chiudere la PR senza merge; se un futuro merge fosse autorizzato, revert del commit associato dopo controllo dei test.

## Prossime attività indispensabili

1. Collegare in modo controllato sorgente e log del backend reale, identificare URL deployment, versione e schema database, senza trasferire credenziali.
2. Testare write idempotency, revisione ottimistica e controllo del conflitto lato Apps Script. Non promettere salvataggi “assoluti” finché non sono verificati.
3. Ambiente di staging/autorizzato con account di prova nei quattro ruoli, visibilità SV disabilitata, codici negozio duplicati in DM distinti.
4. Strumentare latenze anonime (p50/p95), conteggi API e timing render prima di ottimizzare ulteriormente.
5. Intervenire su calendari, report e UX con PR ulteriori e confronto before/after reale.

## Aggiornamento tranche P0 — 30/10/2026

### Ulteriore materiale backend locale esaminato
Durante la revisione è stata rilevata una copia di sorgente Apps Script denominata `Code_AGENDA_DM_ORE_PERSONALE_MESI_STRAORDINARI_2026-10-28.gs` nel contesto del progetto. Questo file dichiara `BACKEND_BUILD = 2026-10-28-personnel-hours-month-store-match-v10`, mentre il client versionato in repository indica `EXPECTED_BACKEND_BUILD = 2026-10-08-rm-iphone-icon-r31`. **La divergenza non dimostra quale build sia in produzione:** occorre una lettura autorizzata dell'endpoint health e la verifica del deployment Apps Script associato.

La copia mostra `LockService.getScriptLock()` sulle mutazioni del planning ferie, restituzione `{saved: entries.length}` da `saveHolidayPlanBatch`, e idempotenza per `createEvent` tramite `client_key`/`source_key`. Non dimostra un controllo di conflitto ottimistico per ogni record o idempotenza di tutte le altre operazioni. Il codice backend non è stato modificato né distribuito.

### Test comportamentali aggiunti
`scripts/test-holiday-reliability.mjs` usa richieste differite senza account né dati reali per testare: flush concorrenti deduplicati, sequenza dei batch, modifica della stessa cella durante la scrittura, errore di rete e conservazione del valore più recente, assenza di retry automatici per scritture ambigue e conferma incompleta del numero di celle.

Nel client, lo stato di salvataggio ora richiede una risposta `saved` esattamente pari al numero di celle inviate. In caso contrario mantiene le modifiche pendenti ed espone l'errore. Il contratto deve essere verificato sul deployment reale prima del merge.

**Limite di ambito:** questi sono test unitari/sintetici su codice frontend. Non verificano atomicità, serializzazione cross-user o persistenza Google Sheets. I target p50/p95 e le prestazioni del calendario sono ancora privi di baseline reale. La PR deve restare draft sino al collaudo autorizzato.

## Aggiornamento affidabilità — riprova esplicita e protezione sessioni

- Il planning ferie espone ora il pulsante **RIPROVA SALVATAGGIO** solo in presenza di una scrittura non confermata. Dopo un errore non partono nuovi batch automatici senza un'azione esplicita dell'utente. Le modifiche successive restano in coda.
- Il logout con modifiche ferie ancora pendenti richiede una conferma che avverte del rischio. Il salvataggio non viene dichiarato completato al termine del logout.
- La coda di scrittura conserva l'ambito negozio e la sessione iniziale; un esito tardivo non deve modificare lo stato visualizzato dopo un cambio sessione.
- È stato aggiunto un pulsante di recupero con etichetta esplicita e focus visibile; il nuovo comportamento è controllato dal test `scripts/test-holiday-reliability.mjs` con errore di rete e riprova manuale.

**Limiti:** le modifiche non sono pubblicate; nessuna persistenza reale Google Sheets è stata collaudata, e la build Apps Script distribuita rimane non confermata. Le letture e i salvataggi delle altre sezioni richiedono ulteriore verifica. Non sono disponibili benchmark comparabili prima/dopo per il calendario e i report.

## Tranche successiva — controllo delle chiavi cache e letture NEGOZIO (30 ottobre 2026)

Durante l'ispezione di `cloud-api.js` sono stati rilevati due problemi dimostrabili per lettura del codice:

1. **`getStoreCalendarContext` assente dall'insieme `readActions`.** Anche se l'azione era presente nella mappa dei domini e aveva TTL 0, non seguiva il percorso di lettura (deduplicazione, gestione di controller e generazioni). Ora è esplicitamente una lettura con TTL 0: non viene memorizzata come risposta riutilizzabile e il controllo di visibilità/autorizzazioni deve continuare a essere eseguito dal backend.
2. **`stableKey` con replacer `JSON.stringify(payload,Object.keys(payload).sort())`.** Il replacer array filtrava anche le proprietà degli oggetti annidati, rischiando di generare la medesima chiave per due filtri diversi. Ora la normalizzazione delle chiavi è ricorsiva per oggetti e array.
3. **Refresh stale duplicati.** Ora i refresh già programmati o in volo per la stessa chiave sono deduplicati. I payload di scrittura non sono serializzati inutilmente per costruire chiavi cache; il tracking dei write resta per dominio. Il reset completo della sessione cancella anche lo stato dei refresh programmati.

**Regression test aggiunti:** `scripts/test-api-reliability.mjs` confronta due richieste al calendario NEGOZIO con filtri annidati differenti e verifica che `getStoreCalendarContext` non restituisca un risultato in cache senza interrogare il server. Il test usa un server sintetico senza dati reali.

**CI:** GitHub Actions run [41038222802](https://github.com/Madnash00/fr-agenda-dm/actions/runs/41038222802) ha completato con esito SUCCESS sul commit `0e2f3a06b894be53bbae2d24b05f1b8ba7a14cee`.

**Limitazioni:** il test dimostra il comportamento client, non l'effettiva esclusione delle SV dai payload Apps Script. Persistenza Google Sheets, controllo di ruoli in backend e benchmark dei tempi in browser non sono ancora certificati. Non è stato effettuato alcun deploy su `main` o Apps Script.

## Tranche aggiuntiva — refresh asincroni e perimetro di sessione (30 ottobre 2026)

**Rischio individuato:** un refresh stale-while-revalidate già pianificato mediante `setTimeout` poteva essere avviato dopo logout, cambio token o mutazione del dominio. Il codice precedente svuotava la coda logica, ma non invalidava esplicitamente l'esecuzione futura del callback.

**Modifica:** in `assets/js/cloud-api.js`, ogni refresh pianificato registra epoca della sessione, token e generazione del dominio e ricontrolla questi tre elementi prima di avviare `request()`. È inoltre imposto TTL 0 a `getStoreCalendarContext` anche se il chiamante prova a fornire `__cacheTtl`: il contesto NEGOZIO rimane una lettura server, non una cache riutilizzabile per autorizzazioni.

**Test:** `scripts/test-api-reliability.mjs` comprende ora un caso con timer simulato che cambia sessione e invalida la cache prima dell'esecuzione del callback. Il workflow [41039094796](https://github.com/Madnash00/fr-agenda-dm/actions/runs/41039094796) ha restituito `SUCCESS` al commit `193a65fe8679e44cf76b33609661eff8cee6f577`. I test sono sintetici; non provano il comportamento del backend Apps Script.

**Prestazioni:** questa modifica elimina una categoria di lavoro differito obsoleto, ma non è disponibile una misura reale prima/dopo del numero di chiamate o dei millisecondi risparmiati. Non viene dichiarato alcun miglioramento quantitativo. Staging E2E, benchmark calendario e read-after-write backend restano aperti.

**Distribuzione:** nessun merge su `main`, nessuna modifica a Sheets e nessun deploy Apps Script.

## Tranche successiva — discovery Drive e baseline sintetica (30 ottobre 2026)

### Verifica dell'archivio
È stato verificato attraverso metadata Google Drive un documento denominato `AGENDA_DM_DATABASE` e un backup di AGENDA DM datato 28 ottobre 2026. La presenza e il nome di tali file **non dimostrano** che il deployment Apps Script attualmente attivo li utilizzi; la verifica richiede il sorgente deployment identificato o un endpoint diagnostico autorizzato. Per prudenza **non sono stati letti né modificati i record operativi del database**.

### Benchmark del client
Aggiunto `scripts/benchmark-api-client.mjs` al CI, con endpoint mock e dati sintetici, nessuna credenziale o scrittura di produzione. Esito del workflow [41039946312](https://github.com/Madnash00/fr-agenda-dm/actions/runs/41039946312):
- Campione: 120 chiamate ripetute.
- Risposte da cache: 119/120.
- Richieste inviate al mock: 3 totali, comprendendo due successive variazioni di filtro/ambito.
- Latenza della chiamata cached-side sintetica: p50 0,0117 ms, p95 0,0422 ms.

**Interpretazione obbligatoria:** misura eseguita in GitHub Actions con API mock, non un benchmark di rete o di interfaccia utente. Non può essere confrontata con i target UX, né supporta affermazioni su p50/p95 di Google Apps Script o sull'accelerazione del calendario. La baseline reale prima/dopo resta N/D.

### Deployment
La PR #38 resta draft; nessun merge o deployment del frontend, backend o database. Il collaudo end-to-end dei ruoli e delle scritture persistenti resta indispensabile.

## Tranche P0 — Action Plan, modifiche durante il salvataggio (30 ottobre 2026)

**Difetto accertato da codice:** nel flusso `saveActionPlanForm`, i pulsanti venivano disabilitati ma non i campi. Una modifica successiva all'avvio del salvataggio poteva essere perduta: la risposta precedente chiudeva sempre il modale e riportava “salvato”, anche se l'utente aveva aggiunto testo o cambiato un input durante l'attesa.

**Correzione frontend:** il modulo NEGOZIO registra una revisione locale incrementale; al ritorno della scrittura chiude il modale soltanto se tale revisione è identica a quella inviata. In caso contrario mantiene la compilazione aperta, segnala che la versione precedente è stata confermata e richiede un nuovo salvataggio. Il form mantiene l'ID del piano restituito dal backend così il successivo invio viene indirizzato al record esistente invece di essere sempre trattato come nuova creazione. Una risposta priva di `plan_id` non viene riconosciuta come salvataggio verificato.

**Validazione effettuata:** controlli di sintassi e invarianti statici in `scripts/check.mjs`, suite frontend di CI (run [41041965858](https://github.com/Madnash00/fr-agenda-dm/actions/runs/41041965858): SUCCESS). **Non eseguito** un test E2E del modulo con editing concorrente e rete reale.

**Rischio aperto:** nella creazione di un nuovo piano senza `plan_id`, una richiesta già confermata lato server ma la cui risposta è persa può risultare ambigua. Non è sicuro proporre un nuovo invio automatico: serve verifica del contratto di idempotenza e/o lettura di riconciliazione lato backend. La protezione di revisione riguarda l'editor NEGOZIO, non costituisce un lock concorrente cross-user. Produzione e Apps Script non modificati.

## Tranche QA — salvataggio Action Plan e risposte ambigue (30 ottobre 2026)

È stato aggiunto `scripts/test-action-plan-reliability.mjs` alla pipeline Frontend quality. Il test esegue l'effettivo handler di salvataggio frontend in un ambiente Node VM isolato con risposte backend sintetiche e differite, senza credenziali né dati reali.

Scenari verificati automaticamente:
- Un doppio click durante il primo salvataggio non produce una seconda richiesta API.
- Una modifica locale effettuata mentre la scrittura è in corso non viene scartata né fa chiudere il modulo quando arriva la risposta della versione precedente.
- Dopo la prima creazione, l'identificativo restituito dal server viene usato nel successivo invio, impedendo una seconda creazione nel caso in cui l'ID sia stato effettivamente ricevuto.
- Una risposta senza `plan_id` non viene considerata una conferma valida e non chiude il modulo.

Il workflow GitHub Actions [41042804498](https://github.com/Madnash00/fr-agenda-dm/actions/runs/41042804498) ha esito SUCCESS.

**Limiti:** il caso di creazione riuscita lato server con risposta completamente persa rimane non risolto; la riconciliazione senza duplicati richiede identificativi idempotenti o ricerca sicura nella sorgente Apps Script realmente distribuita. Il test non dimostra atomicità, persistenza Google Sheets, isolamento tra utenti, o comportamento E2E del browser. Nessun cambiamento sul backend o sulla produzione.

## Tranche P0 — creazione eventi calendario con risposta ambigua (30 ottobre 2026)

**Difetto identificato:** gli handler `createEventFromQuick` e `saveInfoVarieEvent` eliminavano immediatamente l'evento provvisorio dopo qualunque errore, anche in caso di rete interrotta dopo l'elaborazione lato server. Questo può far apparire fallita una scrittura che potrebbe invece essere stata registrata e incentivare inserimenti duplicati.

**Correzione reversibile:** i due handler ora passano per `submitNewCalendarEvent`. Solo una risposta con identificativo evento valido è trattata come salvataggio confermato. In caso di `API_UNAVAILABLE` o conferma priva di ID, l'evento provvisorio viene mantenuto con stato `unconfirmed`, messaggio esplicito e avviso di verificare prima di reinserire. Sono stati aggiunti un avviso nel dettaglio evento, un marcatore nella vista mobile e protezioni da modifica degli eventi con ID temporaneo. Logout e chiusura scheda segnalano la presenza di eventi ancora in attesa di conferma. Gli errori server esplicitamente restituiti continuano a rimuovere la previsione ottimistica.

**Verifiche:** controlli statici e sintassi in `scripts/check.mjs`; GitHub Actions run [41045806871](https://github.com/Madnash00/fr-agenda-dm/actions/runs/41045806871): SUCCESS. Non è stato ancora eseguito un test browser end-to-end.

**Limiti importanti:** la mancata risposta non consente di sapere se l'evento esista nel database. Gli avvisi temporanei sono conservati solo nella sessione corrente e non costituiscono una coda offline persistente. Una risposta `getCalendar` non contiene necessariamente il `client_key` nel modello locale, per cui non è stata introdotta riconciliazione automatica tra eventi temporanei e persistiti: potrebbero comparire entrambi finché l'utente verifica. Non si effettuano retry di `createEvent` senza un contratto idempotente del backend effettivamente distribuito. Permessi e infrastruttura Apps Script invariati. Nessun merge né distribuzione in produzione.

## Tranche — sincronizzazione calendario e riconciliazione per identificativo (30 ottobre 2026)

**Problema comprovato:** `syncCalendarRangeFromServer` applicava indiscriminatamente qualsiasi risposta, anche quando una lettura più recente dello stesso intervallo aveva già aggiornato lo stato locale. Questo poteva far apparire eventi obsoleti dopo cambi di vista o refresh ravvicinati.

**Modifica:** introdotta sequenza di richieste per intervallo calendario. Una risposta di lettura superata non sostituisce gli eventi o il contratto di visibilità già aggiornati da una risposta successiva dello stesso intervallo. Il modello locale mantiene `client_key` quando presente nella risposta del backend: una lettura può riconciliare un evento `TMP:` solo se il server restituisce lo stesso identificativo di richiesta. Non sono utilizzate corrispondenze di testo/data/negozio.

**Nuovo test eseguibile:** `scripts/test-calendar-sync.mjs` con risposta vecchia arrivata dopo la nuova, deduplicazione per `client_key` e conservazione del provvisorio senza corrispondenza. Il test è ora incluso nel workflow di qualità; la suite comprende anche API, ferie, Action Plan e benchmark mock. Il workflow [41051646604](https://github.com/Madnash00/fr-agenda-dm/actions/runs/41051646604) ha superato tutti i passaggi di validazione e i test.

**Limitazioni:** la sequenza attuale è distinta per stringa `from|to`; non rappresenta una revisione transazionale delle scritture cross-user né garantisce che intervalli sovrapposti non richiedano ulteriori test. La riconciliazione funziona solo quando il backend effettivo include `client_key` nella risposta; senza tale dato l'evento resta in attesa di verifica. I test sono sintetici: nessun E2E reale, benchmark Chrome comparabile o prova di read-after-write su Google Sheets. La PR rimane draft; nessun deploy di frontend o Apps Script e nessuna modifica ai dati di produzione.

## Tranche — richieste calendario con intervalli sovrapposti (30 ottobre 2026)

**Problema confermato:** la protezione precedente era associata alla stringa esatta `from|to`; due intervalli diversi, ma sovrapposti, potevano quindi rimpiazzare in ordine errato gli stessi giorni.

**Correzione:** introduzione della revisione delle letture per singola data (UTC, giorno ISO) e applicazione limitata ai giorni di cui la risposta possiede ancora la revisione più recente. Le date non sovrapposte della risposta precedente restano utilizzabili, mentre quelle già aggiornate da una richiesta successiva non vengono sovrascritte. Invalidazione anche delle scorciatoie di freschezza che coprono intervalli sovrapposti.

**Visibilità SV:** la risposta del calendario NEGOZIO non utilizza più la scorciatoia locale di 30 secondi; viene richiesta al server. Solo la risposta con revisione più recente può aggiornare il contratto di visibilità/directory, e gli eventi SV restituiti sono filtrati in base al flag di quella risposta. Questa protezione frontend **non sostituisce** il test backend obbligatorio che, a visibilità disattivata, le SV non vengano restituite affatto.

**Test:** esteso `scripts/test-calendar-sync.mjs` con due intervalli parzialmente sovrapposti, risolti in ordine inverso. Verificati la conservazione dell'evento più recente nel giorno sovrapposto e il mantenimento del dato valido in un giorno non sovrapposto. Suite completa GitHub Actions [41056528246](https://github.com/Madnash00/fr-agenda-dm/actions/runs/41056528246), test inclusi, verificata senza accesso ai dati reali.

**Limiti:** la revisione vive nella sessione frontend, non è un `record_version` server-side. Non sono stati collaudati browser reali, visibilità SV dal server, read-after-write Google Sheets, latenza p50/p95 reali o autorizzazioni tra DM differenti. PR #38 ancora draft; nessun deployment frontend/backend.
