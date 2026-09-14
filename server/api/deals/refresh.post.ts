import { runScrape } from '../../utils/scrapeAndStore'

export default defineEventHandler(async () => {
  try {
    const result = await runScrape()
    return result
  } catch (err) {
    throw createError({
      statusCode: 502,
      statusMessage: err instanceof Error ? err.message : 'Scrape fehlgeschlagen'
    })
  }
})
