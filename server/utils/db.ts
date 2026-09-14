import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

// Einfache JSON-Datei statt einer echten Datenbank - braucht keine native
// Kompilierung (kein node-gyp/Visual-Studio-Build-Tools nötig) und reicht für
// die paar Dutzend Angebote dieser App völlig aus.
const dbPath = process.env.DEALS_DB_PATH || join(process.cwd(), '.data', 'monster-deals.json')
mkdirSync(dirname(dbPath), { recursive: true })

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

interface StoredDeal extends DealRecord {
  firstSeenAt: string
  lastSeenAt: string
  active: boolean
}

export interface ScrapeRun {
  id: number
  startedAt: string
  finishedAt: string | null
  status: 'running' | 'ok' | 'error'
  dealsFound: number
  error: string | null
}

interface Store {
  deals: StoredDeal[]
  runs: ScrapeRun[]
}

function load(): Store {
  if (!existsSync(dbPath)) {
    return { deals: [], runs: [] }
  }
  try {
    return JSON.parse(readFileSync(dbPath, 'utf-8'))
  } catch {
    // beschädigte/leere Datei - lieber frisch anfangen als die App crashen lassen
    return { deals: [], runs: [] }
  }
}

function save(store: Store) {
  writeFileSync(dbPath, JSON.stringify(store, null, 2), 'utf-8')
}

export function upsertDeals(deals: DealRecord[]) {
  const store = load()
  const now = new Date().toISOString()
  const byId = new Map(store.deals.map((d) => [d.id, d]))

  for (const deal of deals) {
    const existing = byId.get(deal.id)
    byId.set(deal.id, {
      ...deal,
      firstSeenAt: existing?.firstSeenAt ?? now,
      lastSeenAt: now,
      active: true
    })
  }

  store.deals = Array.from(byId.values())
  save(store)
  return now
}

// Angebote, die im aktuellen Scrape nicht mehr auftauchen, als inaktiv markieren
// (Marktguru zeigt sie i.d.R. nicht mehr an, sobald das Prospekt abgelaufen ist).
export function deactivateStale(seenAfter: string) {
  const store = load()
  for (const deal of store.deals) {
    if (deal.active && deal.lastSeenAt < seenAfter) {
      deal.active = false
    }
  }
  save(store)
}

export function listActiveDeals() {
  const store = load()
  return store.deals
    .filter((d) => d.active)
    .sort((a, b) => {
      if (a.price == null && b.price == null) return a.retailer.localeCompare(b.retailer)
      if (a.price == null) return 1
      if (b.price == null) return -1
      return a.price - b.price || a.retailer.localeCompare(b.retailer)
    })
}

export function recordRunStart() {
  const store = load()
  const startedAt = new Date().toISOString()
  const runId = (store.runs.at(-1)?.id ?? 0) + 1
  store.runs.push({ id: runId, startedAt, finishedAt: null, status: 'running', dealsFound: 0, error: null })
  save(store)
  return { runId, startedAt }
}

export function recordRunFinish(runId: number, dealsFound: number, error?: string) {
  const store = load()
  const run = store.runs.find((r) => r.id === runId)
  if (run) {
    run.finishedAt = new Date().toISOString()
    run.status = error ? 'error' : 'ok'
    run.dealsFound = dealsFound
    run.error = error ?? null
  }
  save(store)
}

export function lastRun(): ScrapeRun | null {
  const store = load()
  return store.runs.at(-1) ?? null
}
