# Monster Energy Finder

Full-Stack-App (Nuxt 4 – Vue-Frontend + Nitro-Backend in einem Projekt), die
wöchentlich automatisch nach Monster-Energy-Angeboten in deutschen
Supermarkt-Prospekten sucht und sie übersichtlich anzeigt.

## Wie es funktioniert

- **Datenquelle:** [marktguru.de](https://www.marktguru.de) bündelt die
  wöchentlichen Prospekte vieler Händler (Rewe, Edeka, Netto, Kaufland, dm,
  Rossmann, Lidl, ...) in einer durchsuchbaren Datenbank.
- **Scraper** (`server/utils/marktguru.ts`): Marktguru hat keine offizielle
  öffentliche API. Der Scraper lädt die Marktguru-Startseite, liest die dort
  eingebetteten öffentlichen `apiKey`/`clientKey`-Werte aus (dieselben, die
  der Browser jedes Besuchers nutzt) und ruft damit die interne Such-API
  `api.marktguru.de/api/v1/offers/search?q=Monster Energy` auf. Treffer, die
  nicht wirklich "Monster" im Titel/Marke enthalten, werden rausgefiltert.
- **Speicherung** (`server/utils/db.ts`): Ergebnisse landen in einer lokalen
  SQLite-Datenbank (`.data/monster-deals.sqlite`). Angebote, die bei einem
  neuen Lauf nicht mehr auftauchen (abgelaufenes Prospekt), werden als
  inaktiv markiert statt gelöscht.
- **Wöchentliches Update** (`server/plugins/scheduler.ts`): Ein
  [node-cron](https://www.npmjs.com/package/node-cron)-Job läuft standardmäßig
  jeden Montag um 06:00 Uhr und stößt einen neuen Scrape an. Beim allerersten
  Start (leere Datenbank) wird zusätzlich sofort einmal gescraped.
- **Frontend** (`app/pages/index.vue`): Zeigt alle aktuellen Angebote als
  Karten (Bild, Preis, Händler, Gültigkeitszeitraum), mit Filter nach Händler
  und einem "Jetzt aktualisieren"-Button für manuelle Scrapes.

## Setup

```bash
npm install
cp .env.example .env   # ggf. PLZ/Cron anpassen
npm run dev
```

Danach ist die App unter `http://localhost:3000` erreichbar.

### Umgebungsvariablen (`.env`)

| Variable         | Bedeutung                                              | Standard        |
|------------------|---------------------------------------------------------|-----------------|
| `DEALS_ZIP_CODE` | PLZ, für die Angebote gesucht werden                     | `10115`         |
| `CRON_SCHEDULE`  | Cron-Ausdruck für den automatischen Scrape               | `0 6 * * 1`     |
| `DEALS_DB_PATH`  | Pfad zur SQLite-Datei                                    | `.data/monster-deals.sqlite` |

## API-Endpunkte

- `GET /api/deals` – aktuelle aktive Angebote + Infos zum letzten Scrape-Lauf
- `POST /api/deals/refresh` – stößt sofort einen neuen Scrape an (auch über
  den "Jetzt aktualisieren"-Button im Frontend nutzbar)

## Tests

```bash
npm run test
```

Die Tests (`server/utils/marktguru.test.ts`) prüfen die reine Parsing-/
Filterlogik (Erkennung der API-Keys im HTML, Monster-Filter, Mapping der
Rohdaten) ohne echte Netzwerkzugriffe.

## Production Build

```bash
npm run build
node .output/server/index.mjs
```

Oder per Docker:

```bash
docker build -t monster-finder .
docker run -p 3000:3000 -v $(pwd)/.data:/app/.data --env-file .env monster-finder
```

## Wichtige Hinweise

- **Diese Sandbox konnte marktguru.de beim Entwickeln nicht erreichen**
  (Netzwerk-Policy dieser Umgebung blockt den Zugriff auf beliebige externe
  Domains). Der Scraper wurde daher anhand der bekannten Struktur der
  Marktguru-Website und öffentlich dokumentierter Community-Projekte gebaut,
  aber **nicht live gegen die echte Seite getestet**. Beim ersten Start mit
  echtem Internetzugang (z.B. auf deinem eigenen Rechner/Server) unbedingt
  einmal `POST /api/deals/refresh` aufrufen bzw. den Button klicken und die
  Server-Logs prüfen. Falls Marktguru ihr Seiten-Markup geändert hat, muss
  ggf. nur `fetchClientCredentials()` in `server/utils/marktguru.ts`
  angepasst werden – der Rest der App bleibt unberührt.
- Marktguru hat keine öffentlich dokumentierte/offizielle API. Der Zugriff
  nutzt dieselben Endpunkte, die auch die normale Website im Browser lädt.
  Für den privaten, nicht-kommerziellen Gebrauch (wie hier) ist das ein
  gängiger Ansatz für Preisvergleichs-Tools, dennoch gilt: kein exzessives
  Scraping (der wöchentliche Rhythmus ist bewusst niedrig gewählt), keine
  Weiterverbreitung der Daten, und im Zweifel die Nutzungsbedingungen von
  Marktguru selbst prüfen.
