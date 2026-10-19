# Gestione Baretto

Applicazione per la gestione di un bar. Il progetto usa Node.js, Express e MySQL 8; Docker Compose avvia il database e Express espone le interfacce e le API.

## Requisiti

- Node.js 20.6 o successivo e npm
- Docker con Docker Compose v2

## Configurazione

Per l'avvio locale con Node.js, installa le dipendenze e crea la configurazione:

```sh
npm ci
cp .env.example .env
```

Il file `.env` contiene i parametri di sviluppo:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=utente
DB_PASSWORD=password
DB_NAME=baretto
PORT=3000
ADMIN_PASSWORD=8900
```

`PORT` è facoltativa e predefinita a `3000`. `.env` è escluso dal controllo versione. La password admin iniziale è `8900`: cambiala prima di esporre il servizio fuori da un ambiente locale.

## Avvio

Avvia MySQL e Express con un solo comando:

```sh
npm run dev
```

Lo script avvia il container MySQL, attende che sia pronto e poi esegue `node server.js`. In alternativa, avvia prima MySQL con `docker compose up -d mysql` e poi Express con `npm start`.

Apri `http://localhost:3000` per le impostazioni, `http://localhost:3000/stato-ordini.html` per il monitor separato oppure, dopo il login, `http://localhost:3000/admin.html` per l'amministrazione. Il servizio MySQL ha un healthcheck basato su una query autenticata; Express crea le tabelle all'avvio.

All'avvio vengono create o verificate le tabelle `prodotti`, `personale` e `ordini`; quelle già esistenti non vengono svuotate. `GET /api/health` verifica anche la connessione al database:

```sh
curl http://localhost:3000/api/health
```

La risposta attesa è `{"status":"ok","database":"connected"}`. Ferma Express con `Ctrl+C`, poi, se necessario, ferma il database senza eliminare i dati:

```sh
docker compose down
```

I dati MySQL persistono nel volume Docker `mysql_data`. `docker compose down -v` elimina anche il volume e i dati.

Per controllare direttamente le tabelle del database:

```bash
docker exec -it mysql-dev mysql -uutente -ppassword -Dbaretto
```

## Interfacce

- `/` e `/settings.html`: impostazioni tema e accesso admin con password.
- `/menu.html`: menu pubblico con immagini, prezzi, carrello e invio dell'ordine. Il pagamento viene regolato al banco, non online.
- Il tema predefinito usa verde bosco e ottone; dalle impostazioni si può scegliere la variante chiara avorio e ottone. La navigazione mostra le pagine operative dopo l'accesso admin.
- `/admin.html`: gestione prodotti e personale, protetta da sessione.
- `/ordini.html`: gestione ordini, protetta da sessione.
- `/stato-ordini.html`: monitor pubblico in sola lettura, aggiornato automaticamente.
- `/api/health`: stato della connessione a MySQL.

Per mostrare una foto specifica nel menu, inserisci il relativo URL immagine nel campo prodotto del pannello amministratore. Se manca, il menu prova una foto in base al nome del prodotto e poi alla categoria. Le descrizioni inserite nel catalogo vengono mostrate sulle schede; se sono vuote, il menu usa un testo breve neutro.

Per popolare un catalogo locale dimostrativo, avvia prima MySQL e poi esegui `npm run seed:demo-menu`. Il comando aggiunge dieci prodotti con immagini e prezzi indicativi solo se il catalogo è vuoto; i prezzi demo vanno verificati prima dell'uso reale e il comando non modifica prodotti già presenti.
