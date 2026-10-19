# Architettura e prestazioni: migrazione conservativa

## Modifiche eseguite

L'originale `index.html` includeva CSS (circa 93 KB) e due script JS (circa 311 KB). **Sono stati estratti testualmente, senza cambiarne caratteri, logica o selettori**. Il nuovo HTML carica la CSS come file esterno e i due classic script con `defer`, ordinati prima cloud e poi applicazione. Il seed JSON resta nel documento e viene letto quando il DOM è completo.

Ogni asset CSS/JS espone un fingerprint del suo contenuto nel parametro `?v=`. Questo permette riutilizzo in cache e riduce il rischio di versioni miste a seguito di pubblicazione su GitHub Pages. Lo script `scripts/bump-asset-versions.mjs` aggiorna i fingerprint nelle modifiche future. La connessione con Apps Script è segnalata al browser tramite `preconnect` per un eventuale risparmio sul setup di rete.

## Comportamenti invariati

Nessuna modifica a grafica, CSS, logiche, ruoli, API, autorizzazioni frontend, database, cache delle chiamate API, filtri, WOP, importazioni, report, icone, manifest o backend. Nessun service worker introdotto: non servire dati sensibili o calendario da cache offline non validata.

## Verifica e limiti

`node scripts/check.mjs` controlla sintassi JavaScript, integrità dei riferimenti locali, stamp cache, ordine di esecuzione, seed e entrypoint essenziali. In GitHub Actions viene ripetuto a ogni commit/PR.

Questi sono controlli strutturali, non test visuali/end-to-end né prestazionali su rete reale. I tempi delle API Apps Script e del rendering di molti giorni possono ancora contribuire alla lentezza. Testare con account di prova e DevTools dopo pubblicazione.

## Evoluzioni solo dopo un collaudo dedicato

Misurare il tempo di avvio, rendering del calendario, payload cloud, eventuale virtualizzazione del calendario; ottimizzare lossless il logo (attualmente immutato); validare localizzazione della dipendenza Excel; implementare controlli lato server. Evitare refactor massicci delle logiche senza test end-to-end.
