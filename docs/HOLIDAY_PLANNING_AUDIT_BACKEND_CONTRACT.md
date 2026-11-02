# Registro attività Planning Ferie · contratto backend richiesto (PR #42)

## Stato e vincolo di rilascio

Frontend in bozza, **non pubblicabile** senza implementare e collaudare l'API server `getHolidayPlanningAudit` nel Code.gs in uso. Non è possibile dedurre chi ha fatto cosa dal solo stato attuale del planning, né ricostruire fedelmente attività passate prive di audit. Il repository GitHub contiene esclusivamente il frontend; il backend Apps Script non è versionato qui.

## Perimetro della modifica

Solo profilo DM (ruolo interno `ADMIN`, `profile_role='DM'`), pagina PLANNING FERIE, pannello sotto la griglia giornaliera. STORE non visualizza il log, RM e ADMIN super-user non sono inclusi dal requisito. Nessun cambiamento ai calcoli di ferie, ai permessi degli altri moduli o alla logica di scrittura delle ferie.

## Persistenza necessaria

Creare una tabella dedicata `HOLIDAY_PLANNING_AUDIT` (o un datastore equivalente non modificabile dagli utenti frontend) contenente almeno:

- `audit_id`: ID unico immutabile; assegnato dal server
- `created_at`: timestamp server ISO 8601 con fuso orario definito
- `admin_id`, `store_id`: ambito del negozio determinato dal backend, mai fidandosi del client
- `actor_user_id`, `actor_username`, `actor_display_name`, `actor_role`: identità dalla sessione verificata; `actor_role='STORE'` per le azioni NEGOZIO
- `action`, `action_label`, `employee_id`, `employee_name`, `plan_date`, `field_label`
- `old_value`, `new_value` e `details`: prima/dopo effettivo, oppure descrizione per azioni non scalari
- `request_id` e `subchange_index`: per idempotenza in caso di retry e per cambiamenti multipli nella stessa richiesta.

Registrare **dopo aver verificato/committato l'effettiva modifica** e nello stesso perimetro transazionale/lock applicativo, per tutti i metodi STORE:
1. `createHolidayEmployee`: dipendente e valori iniziali;
2. `updateHolidayEmployee`: nome, residuo AP, maturazione AC, con prima/dopo;
3. `saveHolidayEmployeeOrder`: cambiamento effettivo della sequenza (prima/dopo);
4. `deleteHolidayEmployee`: dipendente eliminato e impatto sulle celle di planning;
5. `saveHolidayPlanBatch`: una voce per ogni cella che cambia davvero, includendo data, dipendente, valore precedente e nuovo (ore, 'R' o vuoto), escludendo no-op.

Nessun audit per salvataggi falliti, no-op o tentativi non confermati. Se audit e salvataggio non possono essere atomici, esplicitare e mitigare questa lacuna. Scritture idempotenti: l'accoppiata `request_id` e `subchange_index` non deve duplicarsi.

## API richiesta dal frontend

Azione autenticata: `getHolidayPlanningAudit`.

Input:
```json
{"store_id":"STORE_ID oppure __ALL__","year":2026,"limit":100,"cursor":""}
```

Il server deve estrarre l'identità dal token di sessione e:
- consentire solo ai DM nel rispettivo `admin_id`; rifiutare gli STORE e gli utenti fuori perimetro;
- verificare `store_id` rispetto ai negozi assegnati al DM, anche nelle pagine successive;
- interpretare `__ALL__` come *tutti e solo i negozi del DM autenticato*;
- filtrare per anno della data effettiva dell'operazione (non solo per `plan_date`, che può essere diverso);
- ordinare `created_at DESC, audit_id DESC`, usare cursor opaco/autenticato e mantenere la paginazione consistente per il perimetro richiesto;
- limitare `limit` (massimo 100 consigliato), bloccare mass assignment o override di `admin_id`, `actor_role` e identità;
- non restituire eventi di altri DM, dati di altri negozi, password, token o altre informazioni riservate.

Output:
```json
{
  "events":[
    {
      "audit_id":"id_unico",
      "created_at":"2026-11-02T13:00:00.000Z",
      "store_id":"STORE_ID",
      "store_name":"Negozio di esempio",
      "actor_role":"STORE",
      "actor_username":"nome_utente",
      "actor_display_name":"Operatore negozio",
      "action":"UPDATE_HOLIDAY_PLAN",
      "action_label":"Modifica ferie giornaliere",
      "employee_name":"Dipendente di esempio",
      "plan_date":"2026-11-08",
      "field_label":"Ore ferie",
      "old_value":"4",
      "new_value":"8",
      "details":""
    }
  ],
  "next_cursor":null
}
```

La riga è puramente **di esempio**, non un evento realmente registrato. Rispondere con `events: []` soltanto quando il registro è disponibile ed effettivamente vuoto; su errore/incompatibilità restituire un errore esplicito, per non mostrare un falso “nessuna attività”.

## Collaudo vincolante prima del merge

- DM A legge uno e tutti i suoi negozi, ma non quelli del DM B; STORE, RM e altri ruoli non possono usare l'endpoint;
- modifiche di celle (incluso 'R' → ore, ore → vuoto), creazione, aggiornamento, riordino, cancellazione sono tracciati con identità e prima/dopo;
- richieste duplicate e retry non generano eventi doppi;
- no-op, cancellazioni fallite e salvataggi non confermati non producono audit;
- paginazione su >100 eventi senza duplicati o salti, ordinamento corretto, cambio negozio e anno senza risultati stantii;
- lo storico pregresso non viene presentato come completo se non era registrato a livello server.

## Pubblicazione

1. Integrare Code.gs V13 effettivamente deployato con le operazioni sopra, preservando idempotenza e convalide esistenti.
2. Pubblicare la nuova versione Apps Script e verificare l'azione con sessioni DM/STORE reali di test.
3. Verificare GitHub Actions della PR #42.
4. Solo dopo i test backend e frontend, portare la PR su main e attendere GitHub Pages.


## Implementazione predisposta dal Code.gs V13 caricato il 2 novembre 2026

È disponibile nella conversazione un file privato completo `Code_PlanningFerie_Audit_V13_compatibile.gs`, ricavato dal Code.gs caricato dall'utente. Non pubblicare il file integrale nel repository GitHub pubblico, perché include riferimenti all'infrastruttura applicativa.

- Nuovo foglio `HOLIDAY_PLANNING_AUDIT` (22 colonne), inizializzato automaticamente oppure eseguendo dall'editor Apps Script `initializeHolidayPlanningAudit()`.
- Tutti e cinque i metodi di scrittura delle ferie generano eventi per le **variazioni effettive**; le celle eliminate con un dipendente sono tracciate separatamente.
- `getHolidayPlanningAudit` è una nuova azione di sola lettura, filtrata per anno dell'operazione in fuso `Europe/Rome`, negozio o `__ALL__`, scope del DM autenticato.
- L'identità `actor_user_id` e i campi visualizzati sono derivati dalla sessione e dalle anagrafiche server. Un account NEGOZIO condiviso identifica l'account, non necessariamente la persona fisica.
- La paginazione usa cursori firmati HMAC legati a DM, negozio e anno.
- `BACKEND_BUILD` resta **`2026-10-30-event-idempotency-v13`**, senza cambiare il contratto della versione attualmente online e senza modifiche a credenziali/password.
- Test locali simulati: validazione sintattica, inserimento/aggiornamento/eliminazione/riordino, prima-dopo delle celle, ripetizioni no-op, ruolo SM, isolamento tra DM, oltre 200 righe e paginazione firmata. **Non sono test reali sull'Apps Script distribuito**.

**Limite di consistenza di Google Sheets:** le scritture del planning e del nuovo registro sono effettuate sotto lo stesso lock applicativo, ma su fogli distinti, senza transazione atomica multi-foglio. Il codice prepara il foglio prima della modifica e registra dopo la scrittura, ma errori del servizio Sheets tra i due passaggi possono comunque causare un dato modificato privo del corrispondente log. Nessuna garanzia di completezza assoluta in presenza di errori parziali, e nessun recupero automatico dello storico precedente.

### Installazione e verifica obbligatorie

1. Eseguire un backup del Code.gs effettivamente distribuito e del Google Sheet.
2. Sostituire il Code.gs in Apps Script con il file fornito privatamente all'utente e salvare.
3. Nell'editor Apps Script eseguire una sola volta `initializeHolidayPlanningAudit()` e verificare `ready: true`, `columns: 22`. La funzione crea l'archivio vuoto, senza cambiare il planning.
4. Aggiornare la distribuzione Web App esistente a una nuova versione mantenendo lo stesso URL `/exec`.
5. Collaudare con un account NEGOZIO dedicato e un DM, in un punto vendita di test: almeno un salvataggio ferie, una modifica dipendente, lettura del log, impossibilità di leggere lo storico di un altro DM, assenza di duplicati su ripetizione. Non introdurre dati di test in produzione senza pulizia.
6. **Solo dopo** comunicazione di riuscita del deployment Apps Script e collaudo, rendere pronta e integrare la PR #42 su `main`.
