import cron from 'node-cron'
import { runScrape } from '../utils/scrapeAndStore'
import { lastRun } from '../utils/db'

// Standard: jeden Montag um 06:00 Uhr. Über die Env-Variable CRON_SCHEDULE anpassbar.
const schedule = process.env.CRON_SCHEDULE || '0 6 * * 1'

export default defineNitroPlugin(() => {
  if (!cron.validate(schedule)) {
    console.error(`[scheduler] Ungültiger CRON_SCHEDULE: "${schedule}" - Scheduler wird nicht gestartet.`)
    return
  }

  cron.schedule(schedule, () => {
    console.log('[scheduler] Starte wöchentlichen Monster-Energy-Scrape...')
    runScrape()
      .then((result) => console.log('[scheduler] Scrape fertig:', result))
      .catch((err) => console.error('[scheduler] Scrape fehlgeschlagen:', err))
  })

  console.log(`[scheduler] Wöchentlicher Scrape geplant: "${schedule}"`)

  // Beim allerersten Start (leere DB) direkt einmal laden, damit die Seite nicht leer ist.
  if (!lastRun()) {
    console.log('[scheduler] Keine bisherigen Daten gefunden, starte initialen Scrape...')
    runScrape().catch((err) => console.error('[scheduler] Initialer Scrape fehlgeschlagen:', err))
  }
})
