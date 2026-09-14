import { debugRawSearch } from '../../utils/marktguru'

// Temporäre Debug-Route: zeigt die rohen Marktguru-Suchtreffer im Browser an,
// damit die tatsächliche API-Feldstruktur sichtbar wird (statt sie zu
// erraten). Kann wieder gelöscht werden, sobald der Scraper zuverlässig läuft.
export default defineEventHandler(async () => {
  const zipCode = process.env.DEALS_ZIP_CODE || '10115'
  return debugRawSearch(zipCode)
})
