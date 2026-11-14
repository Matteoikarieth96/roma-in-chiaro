# Come contribuire

Grazie per l'aiuto. Questo sito pubblica numeri sui soldi pubblici: un errore può finire in un comunicato o in un dibattito, quindi le regole sui dati sono rigide.

## Correggere un dato

Ogni correzione di un numero richiede una **fonte ufficiale**: un documento o una pagina di Roma Capitale, di un Municipio, di ANAC o di un altro ente pubblico. Articoli di giornale, post, comunicati di partito e stime non bastano, ma possono indicare dove guardare.

Per segnalare un errore apri una issue con il modello "Errore nei dati" e indica:

1. la pagina del sito e il numero che non torna;
2. il link alla fonte ufficiale e, se è un PDF, la pagina e la tabella;
3. il periodo a cui si riferisce il dato;
4. il valore che leggi nella fonte.

Se non vuoi usare GitHub, scrivi all'indirizzo della sezione Contatti del sito con le stesse informazioni.

## Cambiare il codice o i dati

- I numeri non si modificano a mano negli snapshot (`data/snapshot/*.json`). Si corregge lo script ETL che li produce (`scripts/etl_*.py`) e si rigenera lo snapshot. Se la fonte ha un errore evidente, la correzione va scritta nello script con un commento che la spiega, e resta visibile nelle note del sito.
- Ogni dato nuovo porta `fonte`, `periodo`, `verificato`, `misura` e `non_misura`, come gli altri snapshot.
- Un dato mancante resta "non disponibile": non diventa zero e non viene stimato.
- Stanziamenti, importi di gara e costi dei progetti restano separati.
- Finché esistono i due siti (`web/` e `scripts/template.html`), un testo si cambia in entrambi. I file elencati in `docs/TECNICO.md` si portano al sito statico con `cd web && npm run porta`.
- Prima di aprire una pull request lancia i controlli offline:

  ```bash
  ./aggiorna.sh sito
  .venv/bin/python -I scripts/controlla_snapshot.py
  cd web && npm ci && npm run build
  ```

- Descrivi nella pull request cosa cambia nei numeri del sito, con la fonte.

## Licenza dei contributi

Inviando codice accetti che sia distribuito sotto GNU AGPL-3.0 o successiva, come il resto del progetto. I dati restano sotto la licenza della loro fonte (`LICENZE.md`).

## Comportamento

Vale il `CODE_OF_CONDUCT.md`. Si discute dei dati e del codice, non delle persone.
