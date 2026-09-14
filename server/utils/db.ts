import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

// Die DB-Datei liegt außerhalb von .nuxt/.output, damit sie Neustarts übersteht.
const dbPath = process.env.DEALS_DB_PATH || join(process.cwd(), '.data', 'monster-deals.sqlite')
mkdirSync(dirname(dbPath), { recursive: true })

export const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS deals (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    retailer TEXT NOT NULL,
    price REAL,
    price_text TEXT,
    unit TEXT,
    valid_from TEXT,
    valid_until TEXT,
    image_url TEXT,
    source_url TEXT,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS scrape_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    deals_found INTEGER NOT NULL DEFAULT 0,
    error TEXT
  );
`)

export interface DealRecord {
  id: string
  title: string
  retailer: string
  price: number | null
  priceText: string | null
  unit: string | null
  validFrom: string | null
  validUntil: string | null
  imageUrl: string | null
  sourceUrl: string | null
}

const upsertStmt = db.prepare(`
  INSERT INTO deals (
    id, title, retailer, price, price_text, unit, valid_from, valid_until,
    image_url, source_url, first_seen_at, last_seen_at, active
  ) VALUES (
    @id, @title, @retailer, @price, @priceText, @unit, @validFrom, @validUntil,
    @imageUrl, @sourceUrl, @now, @now, 1
  )
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    retailer = excluded.retailer,
    price = excluded.price,
    price_text = excluded.price_text,
    unit = excluded.unit,
    valid_from = excluded.valid_from,
    valid_until = excluded.valid_until,
    image_url = excluded.image_url,
    source_url = excluded.source_url,
    last_seen_at = excluded.last_seen_at,
    active = 1
`)

export function upsertDeals(deals: DealRecord[]) {
  const now = new Date().toISOString()
  const tx = db.transaction((items: DealRecord[]) => {
    for (const deal of items) {
      upsertStmt.run({ ...deal, now })
    }
  })
  tx(deals)
  return now
}

// Angebote, die im aktuellen Scrape nicht mehr auftauchen, als inaktiv markieren
// (Marktguru zeigt sie i.d.R. nicht mehr an, sobald das Prospekt abgelaufen ist).
export function deactivateStale(seenAfter: string) {
  db.prepare(`UPDATE deals SET active = 0 WHERE last_seen_at < ? AND active = 1`).run(seenAfter)
}

export function listActiveDeals() {
  return db.prepare(`
    SELECT id, title, retailer, price, price_text as priceText, unit,
           valid_from as validFrom, valid_until as validUntil,
           image_url as imageUrl, source_url as sourceUrl,
           last_seen_at as lastSeenAt
    FROM deals
    WHERE active = 1
    ORDER BY (price IS NULL), price ASC, retailer ASC
  `).all()
}

export function recordRunStart() {
  const startedAt = new Date().toISOString()
  const info = db.prepare(`INSERT INTO scrape_runs (started_at, status) VALUES (?, 'running')`).run(startedAt)
  return { runId: info.lastInsertRowid as number, startedAt }
}

export function recordRunFinish(runId: number, dealsFound: number, error?: string) {
  db.prepare(`
    UPDATE scrape_runs
    SET finished_at = ?, status = ?, deals_found = ?, error = ?
    WHERE id = ?
  `).run(new Date().toISOString(), error ? 'error' : 'ok', dealsFound, error ?? null, runId)
}

export function lastRun() {
  return db.prepare(`SELECT * FROM scrape_runs ORDER BY id DESC LIMIT 1`).get()
}
