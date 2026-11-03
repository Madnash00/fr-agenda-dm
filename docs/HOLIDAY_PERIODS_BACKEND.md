# PERIODI FERIE · contratto backend richiesto

## Perché questa scheda

La pagina **PERIODI FERIE** (`data-page="holidayperiods"`, riservata al profilo ADMIN) e la colorazione degli alert nella griglia di **PLANNING FERIE** dipendono da due azioni Apps Script: `getHolidayPeriods` e `saveHolidayPeriods`. Il frontend le invoca da `assets/js/app.js` dal 19/10/2026, ma nel `Code.gs` build `2026-10-30-event-idempotency-v13` **non esistono**: non sono nella mappa `M` di `route()`, non sono definite come funzioni e non hanno persistenza associata. Il backend risponde `UNKNOWN_ACTION`.

Il repository contiene esclusivamente il frontend; il backend Apps Script non è versionato qui. Questa scheda documenta il contratto atteso, perché la dipendenza non resti implicita nel solo codice client.

## Sintomi quando il backend non espone le due azioni

- **PERIODI FERIE**: errore visibile nella barra di stato, «Impossibile caricare i periodi ferie condivisi»; il salvataggio riporta «Periodi NON salvati».
- **PLANNING FERIE**: nessun errore visibile. La chiamata in `loadHolidayPlanning()` è `void loadHolidayPeriodYear(...).catch(()=>{})`, quindi il fallimento è silenzioso: la griglia si apre regolarmente ma le colonne di ALTO PRESIDIO e TEAM COMPLETO non si colorano mai, e le store manager non ricevono alcuna indicazione di presidio.

Il secondo caso è il più insidioso: la funzione appare attiva e non lo è.

## Contratto atteso dal frontend

### `getHolidayPeriods`

Richiesta `{ year }`. Risposta `{ year, days, revision }`, dove `days` è una mappa `"AAAA-MM-GG" → "high" | "full"` e `revision` è un intero non negativo. Un anno mai configurato restituisce `days` vuoto e `revision: 0`; il client salva poi con `expected_revision: 0`.

Riferimenti client: `loadHolidayPeriodYear()`, `holidayPeriodNormalizeDays()`.

### `saveHolidayPeriods`

Richiesta `{ year, days, expected_revision }`. Risposta nella stessa forma, con `revision` incrementata. Se `expected_revision` non coincide con la revisione corrente la scrittura va **rifiutata**, non applicata: il client la usa come protezione contro la sovrascrittura di modifiche altrui, e mostra il messaggio d'errore restituito dal server.

Riferimento client: `saveHolidayPeriodsEditor()`.

### Validazione e permessi

- Solo i livelli `high` e `full`; qualsiasi altro valore va scartato.
- Solo date appartenenti all'anno richiesto. **La verifica di forma non basta**: `2026-99-99` supera un controllo basato sul solo `^\d{4}-\d{2}-\d{2}$`. Serve un controllo di esistenza reale della data, che rifiuti anche `2026-02-30`.
- Lettura consentita a ogni sessione del distretto, perché serve anche al profilo NEGOZIO per la griglia del Planning Ferie.
- Scrittura riservata al profilo ADMIN, coerente con `isSuperAdmin()` del frontend (`profile_role === 'ADMIN' || admin_enabled`), che corrisponde ad `adminCreatorOnly()` lato backend. Il controllo frontend non è sufficiente da solo.
- Ambito per distretto (`admin_id`): i periodi di un DM non devono essere visibili o scrivibili da un altro.
- Scrittura sotto il lock applicativo esistente e tracciata in `AUDIT_LOG`.

## Implementazione predisposta (non ancora distribuita)

È disponibile fuori dal repository, come file privato, una patch minima sul `Code.gs` in uso: 2 righe modificate (registrazione in `route()` e in `isReadActionName()`) e le due funzioni con i relativi helper. Persistenza su `META` con chiave `HOLIDAY_PERIODS_V1:<admin_id>:<anno>`: nessun foglio aggiuntivo, `SCHEMA` e `BACKEND_BUILD` invariati, `actionPlanFraction()` non toccata.

La patch è accompagnata da un test offline (42 verifiche) che esegue il `Code.gs` patchato in un mock di Apps Script: instradamento, salvataggio e rilettura, incremento e conflitto di revisione, permessi per ruolo, isolamento fra distretti, scarto dei dati non validi, più i controlli anti-regressione su `BACKEND_BUILD`, `SCHEMA`, contratto calendario NEGOZIO e `created_at` in `login()`.

**Il test è offline e non sostituisce il collaudo sul deployment.** Dopo aver incollato il file in Apps Script e aggiornato la distribuzione mantenendo URL e permessi, verificare: caricamento dell'anno in PERIODI FERIE, salvataggio e ricarica, comparsa degli alert nella griglia del Planning Ferie, e accesso con un profilo NEGOZIO.

## Nota di sicurezza

Il `Code.gs` contiene l'identificativo del foglio di database: non va pubblicato nel repository, nelle issue o nelle pull request.
