import { fetchMonsterDeals } from './marktguru'
import { upsertDeals, deactivateStale, recordRunStart, recordRunFinish } from './db'

let running = false

export async function runScrape() {
  if (running) {
    return { skipped: true as const, reason: 'Ein Scrape läuft bereits.' }
  }
  running = true
  const { runId, startedAt } = recordRunStart()

  try {
    const zipCode = process.env.DEALS_ZIP_CODE || '10115'
    const deals = await fetchMonsterDeals(zipCode)
    const seenAt = upsertDeals(deals)
    deactivateStale(seenAt)
    recordRunFinish(runId, deals.length)
    return { skipped: false as const, startedAt, dealsFound: deals.length }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    recordRunFinish(runId, 0, message)
    throw err
  } finally {
    running = false
  }
}
