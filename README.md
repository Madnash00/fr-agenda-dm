# AGENDA DM · Fiorella Rubino

Frontend su GitHub Pages, con autenticazione, dati e permessi gestiti da Google Apps Script.

## Struttura

- `index.html`: stessa interfaccia HTML, dati seed e riferimenti agli asset separati.
- `assets/css/app.css`: CSS estratto **senza modifiche** dalla precedente pagina.
- `assets/js/cloud-api.js`: client cloud, cache, sessioni e caricamento Excel, **senza modifiche**.
- `assets/js/app.js`: calendari, ferie, report, navigation, WOP e ruoli, **senza modifiche**.
- `manifest.webmanifest` e icone nella radice: conservati.
- `scripts/check.mjs`: controllo statico senza dipendenze aggiuntive.
- `scripts/bump-asset-versions.mjs`: aggiornamento delle versioni cache di CSS e JS.
- `.github/workflows/quality.yml`: controlli automatici su push/PR, senza modificare il deploy.
- `docs/ARCHITECTURE.md`, `SECURITY.md`: architettura e limiti di sicurezza.

## Verifica

Servire il progetto via HTTP, non tramite `file://`:

```sh
python3 -m http.server 8000
node scripts/check.mjs
```

Quando si modifica intenzionalmente una risorsa CSS o JavaScript, aggiornare i parametri di versione:

```sh
node scripts/bump-asset-versions.mjs
node scripts/check.mjs
```

I browser scaricano le risorse indipendentemente e le riutilizzano in cache quando l'impronta non cambia. I due script sono di tipo classico, con `defer`, e mantengono l'ordine di esecuzione precedente. Non sono stati aggiunti pacchetti npm, service worker o nuovi endpoint.

**La configurazione GitHub Pages resta invariata.** L'azione GitHub verifica il codice: non modifica autonomamente la pubblicazione.

La sicurezza dei dati e i permessi rimangono responsabilità del backend; leggere `SECURITY.md`.
