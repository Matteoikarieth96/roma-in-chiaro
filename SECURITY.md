# Sicurezza

Il sito è statico: niente server applicativo, niente database, niente account utente. Le sole richieste esterne del browser sono le tile della mappa di OpenStreetMap.

## Cosa segnalare

- codice che si può iniettare nelle pagine (per esempio un testo di una fonte che finisce nell'HTML senza essere filtrato);
- un segreto, una chiave o un dato personale finito per errore nel repository o nella sua storia;
- una dipendenza con una vulnerabilità che tocca il sito pubblicato;
- un modo per far pubblicare al sito un numero diverso da quello della fonte.

Un errore in un numero, senza un problema di sicurezza, va segnalato come "Errore nei dati" (`CONTRIBUTING.md`).

## Come segnalare

Non aprire una issue pubblica. Usa la segnalazione privata di GitHub (scheda **Security**, poi **Report a vulnerability**) oppure scrivi all'indirizzo della sezione Contatti del sito, con oggetto "Sicurezza".

Rispondiamo entro 7 giorni. È un progetto volontario: non c'è un programma di ricompense.

## Versioni coperte

Solo il ramo `main` e il sito pubblicato da esso.
