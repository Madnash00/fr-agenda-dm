# Sicurezza

Questo sito GitHub Pages è un frontend **pubblico**. Separare JS/CSS, introdurre test e limitare i cambiamenti riduce il rischio di regressioni e semplifica gli audit, ma **non equivale a proteggere il backend**.

- Non inserire segreti, credenziali o token permanenti nel repository.
- Il backend Google Apps Script deve validare **ogni lettura e scrittura** controllando sessione, ruolo, negozi autorizzati e distretto. Nascondere un pulsante non costituisce autorizzazione.
- Verificare revoca/scadenza sessioni, controllo abusi, audit e concorrenza dei salvataggi sullo script Apps Script effettivamente distribuito.
- Il frontend usa ancora `sessionStorage` per la sessione; un XSS potrebbe comprometterla. I template `innerHTML` e i dati esterni richiedono un audit dedicato.
- L'importazione Excel utilizza ancora il caricamento dinamico della libreria `xlsx@0.18.5` da jsDelivr. Una copia verificata con integrità/autohosting richiede collaudo e non viene cambiata da questo rilascio.
- GitHub Pages non supporta file `_headers` per impostare CSP e gli altri header HTTP arbitrari. Non aggiungere false protezioni; per CSP rigorosa valutare un proxy o hosting adatto e verificare compatibilità con funzionalità esistenti.
- I controlli automatici non sostituiscono penetration test né test con account reali ADMIN/DM/RM/NEGOZIO.

Per segnalazioni di vulnerabilità usare una comunicazione privata con il manutentore, senza pubblicare credenziali nelle issue.
