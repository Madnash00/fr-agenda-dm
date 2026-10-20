# Audit mirato sessioni · 20 ottobre 2026

Diagnosi sul frontend reale: reset di visibilità incompleto dopo un cambio RM → DM; cache in memoria senza chiave di sessione; richieste asincrone e prefetch che possono completare dopo logout.

Correzioni: chiavi cache in memoria basate sul token, invalidazione epoch delle richieste, abort delle letture al cambio di sessione, pulizia cache persistenti relative all'app, ricostruzione delle sezioni menu, blocco del prefetch della sessione precedente e logout locale immediato (revoca remota inviata in parallelo).

Nessuna modifica agli stili, criteri dei profili, logiche di business, API invocate o backend. Test statici di sintassi e invarianti; per validazione completa restano necessari test E2E con account demo e metriche su rete reale. L'attuale Code.gs ricevuto fuori dal repository non è automaticamente prova della versione backend distribuita.
