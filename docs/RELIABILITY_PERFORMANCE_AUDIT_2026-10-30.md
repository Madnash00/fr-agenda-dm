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
