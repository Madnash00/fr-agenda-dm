# ACTION PLAN · periodo libero, prerequisito backend

Questa PR interviene **esclusivamente** sulla maschera Action Plan per DM e NEGOZIO e non modifica il backend attualmente pubblicato.

## Cambio minimo del backend prima del merge

Nell'Apps Script V13 in uso, `actionPlanFraction(v)` accetta solo i periodi `Q1`–`Q4`, `H1`, `H2`. Per mantenere i nuovi periodi liberi `PERIODO ACTION PLAN` senza errori al salvataggio, occorre sostituire **solo** tale validatore nel `Code.gs` attualmente pubblicato con:

```javascript
function actionPlanFraction(v){var x=String(v==null?'':v).trim().toUpperCase();if(!x||x.length>60||/[\\x00-\\x1f\\x7f]/.test(x))throw err('VALIDATION_ERROR','Il periodo Action Plan deve contenere da 1 a 60 caratteri validi.');return x;}
```

**Nota:** questa è la modifica di compatibilità minima: preserva i periodi precedenti, normalizza le stringhe in maiuscolo e conserva le protezioni esistenti. Anno e data mantengono le convalide preesistenti. Se un altro backend è ora in produzione, verificare la versione effettiva prima della sostituzione e non sovrascrivere aggiornamenti successivi.

È disponibile nella conversazione un `Code_ActionPlan_PeriodoLibero_V13.gs` integrale per installazione manuale (file privato, non inserito nel repository pubblico). Prima del deployment è necessario confrontarlo con il Code.gs realmente distribuito, fare backup, aggiornare la distribuzione Web App mantenendo URL e permessi, ed effettuare un salvataggio di prova con periodo libero, sia come DM sia come NEGOZIO.

## Frontend

1. In apertura: negozio (solo DM, obbligatorio per un nuovo piano), data inserimento, anno riferimento e periodo Action Plan (testo libero).
2. Step YTD: nota per estrazione dati da REPORT STORE REVIEW fino all'ultimo mese consolidato.
3. Analisi periodo: stessi KPI e campi preesistenti.
4. Analisi finale: entrambi i grafici YTD e AP immediatamente prima del campo ANALISI; testo ANALISI non in grassetto.

Impatto KPI: barre verdi sopra e rosse sotto una sola baseline orizzontale, formule di impatto rimaste invariate.

## Rilascio

Non pubblicare il frontend su `main` prima di aver confermato l'aggiornamento del validatore Apps Script; altrimenti il periodo personalizzato sarà rifiutato dal backend. Testare anche salvataggio, modifica e recupero piani già registrati, accessi DM / STORE e la maschera su viewport differenti. La disponibilità di scroll sulle schermate piccole rimane un fallback di accessibilità.
