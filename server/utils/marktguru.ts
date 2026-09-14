import * as cheerio from 'cheerio'

const HOMEPAGE_URL = 'https://www.marktguru.de/'
// Trailing slash ist Pflicht: new URL('offers/search', base) würde sonst das
// letzte Pfadsegment von base (hier "v1") verwerfen statt anzuhängen.
const API_BASE = 'https://api.marktguru.de/api/v1/'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

interface ClientCredentials {
  apiKey: string
  clientKey: string
}

// Feldform anhand einer echten API-Antwort ermittelt (per Debug-Route
// server/api/debug/marktguru.get.ts). Die Suchtreffer liegen unter `.results`,
// nicht unter `.offers`/`.items` wie ursprünglich angenommen.
interface RawOffer {
  id?: string | number
  brand?: { name?: string } | string
  advertisers?: ({ name?: string } | string)[]
  product?: { name?: string }
  price?: number | { value?: number; formattedValue?: string }
  oldPrice?: number | null
  volume?: number
  unit?: { shortName?: string } | string
  validityDates?: { from?: string; to?: string }[]
}

/**
 * Marktguru liefert seine öffentlichen API-Zugangsdaten eingebettet als JSON
 * im HTML der Startseite aus (dieselben Keys, die der Browser jedes Besuchers
 * nutzt). Es gibt keine offizielle/dokumentierte API - dieser Ansatz kann bei
 * einem Redesign der Seite brechen und muss dann angepasst werden.
 */
async function fetchClientCredentials(): Promise<ClientCredentials> {
  const res = await fetch(HOMEPAGE_URL, {
    headers: { 'user-agent': USER_AGENT, 'accept-language': 'de-DE,de;q=0.9' }
  })
  if (!res.ok) {
    throw new Error(`Marktguru Startseite antwortete mit ${res.status}`)
  }
  const html = await res.text()
  const $ = cheerio.load(html)

  let apiKey: string | undefined
  let clientKey: string | undefined

  $('script[type="application/json"]').each((_, el) => {
    if (apiKey && clientKey) return
    const raw = $(el).contents().text()
    if (!raw || (!raw.includes('apiKey') && !raw.includes('clientKey'))) return
    try {
      const json = JSON.parse(raw)
      const found = findKeysDeep(json)
      apiKey ||= found.apiKey
      clientKey ||= found.clientKey
    } catch {
      // dieses <script> war kein gültiges JSON, ignorieren und weitersuchen
    }
  })

  if (!apiKey || !clientKey) {
    throw new Error(
      'Konnte apiKey/clientKey nicht aus der Marktguru-Startseite extrahieren. ' +
        'Die Seite hat vermutlich ihr Markup geändert - server/utils/marktguru.ts anpassen.'
    )
  }

  return { apiKey, clientKey }
}

export function findKeysDeep(node: unknown, depth = 0): Partial<ClientCredentials> {
  if (depth > 6 || node === null || typeof node !== 'object') return {}
  const obj = node as Record<string, unknown>
  const result: Partial<ClientCredentials> = {}
  if (typeof obj.apiKey === 'string') result.apiKey = obj.apiKey
  if (typeof obj.clientKey === 'string') result.clientKey = obj.clientKey
  if (result.apiKey && result.clientKey) return result

  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      const nested = findKeysDeep(value, depth + 1)
      result.apiKey ||= nested.apiKey
      result.clientKey ||= nested.clientKey
      if (result.apiKey && result.clientKey) break
    }
  }
  return result
}

export function buildSearchUrl(query: string, zipCode: string): URL {
  const url = new URL('offers/search', API_BASE)
  url.searchParams.set('as', 'web')
  url.searchParams.set('q', query)
  url.searchParams.set('limit', '200')
  url.searchParams.set('offset', '0')
  url.searchParams.set('zipCode', zipCode)
  return url
}

async function searchRaw(query: string, creds: ClientCredentials, zipCode: string): Promise<unknown> {
  const url = buildSearchUrl(query, zipCode)

  const res = await fetch(url, {
    headers: {
      'x-apikey': creds.apiKey,
      'x-clientkey': creds.clientKey,
      'user-agent': USER_AGENT,
      accept: 'application/json'
    }
  })
  if (!res.ok) {
    throw new Error(`Marktguru Such-API antwortete mit ${res.status}`)
  }
  return res.json()
}

function extractOffers(json: any): RawOffer[] {
  return json?.results ?? json?.offers ?? json?.items ?? (Array.isArray(json) ? json : [])
}

async function searchOffers(query: string, creds: ClientCredentials, zipCode: string): Promise<RawOffer[]> {
  return extractOffers(await searchRaw(query, creds, zipCode))
}

// Mehrere Felder (brand, advertisers, unit) liefert die API mal als String,
// mal als Objekt mit `.name`/`.shortName` - hier auf beide Formen vorbereiten.
function nameOf(value: { name?: string } | string | undefined): string {
  if (typeof value === 'string') return value
  return value?.name ?? ''
}

function retailerName(offer: RawOffer): string {
  return nameOf(offer.advertisers?.[0]) || 'Unbekannt'
}

function brandName(offer: RawOffer): string {
  return nameOf(offer.brand)
}

function productName(offer: RawOffer): string {
  return offer.product?.name || 'Energy Drink'
}

function priceValue(offer: RawOffer): number | null {
  if (typeof offer.price === 'number') return offer.price
  if (typeof offer.price?.value === 'number') return offer.price.value
  return null
}

function priceText(offer: RawOffer): string | null {
  if (typeof offer.price === 'object' && offer.price?.formattedValue) return offer.price.formattedValue
  const value = priceValue(offer)
  return value != null ? `${value.toFixed(2).replace('.', ',')} €` : null
}

function oldPriceText(offer: RawOffer): string | null {
  const value = offer.oldPrice
  const current = priceValue(offer)
  if (typeof value !== 'number' || (current != null && value <= current)) return null
  return `${value.toFixed(2).replace('.', ',')} €`
}

function unitText(offer: RawOffer): string | null {
  const shortName = typeof offer.unit === 'string' ? offer.unit : offer.unit?.shortName
  if (typeof offer.volume === 'number' && shortName) {
    return `${offer.volume.toString().replace('.', ',')} ${shortName}`
  }
  return null
}

// Marktguru liefert im Suchergebnis keine fertige Bild-URL, nur `images.count`.
// Bilder werden über ein bekanntes CDN-Muster anhand der Angebots-ID
// zusammengesetzt (siehe github.com/sydev/marktguru). "large" ist eine
// Vermutung für den Größen-Parameter - falls Bilder nicht laden, hier
// anpassen; das Frontend fängt einen 404 ohnehin mit einem Platzhalter ab.
function imageUrl(offer: RawOffer): string | null {
  if (offer.id == null) return null
  return `https://mg2de.b-cdn.net/api/v1/offers/${offer.id}/images/default/0/large.jpg`
}

export interface MonsterDeal {
  id: string
  title: string
  retailer: string
  price: number | null
  priceText: string | null
  oldPriceText: string | null
  unit: string | null
  validFrom: string | null
  validUntil: string | null
  imageUrl: string | null
  sourceUrl: string | null
}

/**
 * Sucht bei Marktguru nach "Monster Energy" und filtert clientseitig nochmal
 * auf Treffer, die "monster" im Produktnamen/Marke enthalten - die Such-API
 * liefert i.d.R. schon nur passende Treffer, das ist nur ein Sicherheitsnetz.
 */
export function isMonsterOffer(offer: RawOffer): boolean {
  const haystack = `${productName(offer)} ${brandName(offer)}`.toLowerCase()
  return haystack.includes('monster')
}

// Der Produktname ist bei Marktguru oft nur die generische Kategorie
// ("Energy Drink"), die eigentliche Marke steckt separat in `brand`. Damit
// Karten unterscheidbar sind, wird die Marke vorangestellt, falls der Name
// sie nicht schon enthält.
function dealTitle(offer: RawOffer): string {
  const base = productName(offer)
  const brand = brandName(offer)
  if (brand && !base.toLowerCase().includes(brand.toLowerCase())) {
    return `${brand} ${base}`
  }
  return base
}

export function mapOffer(offer: RawOffer): MonsterDeal {
  const validity = offer.validityDates?.[0]
  return {
    id: String(offer.id ?? `${retailerName(offer)}-${productName(offer)}`),
    title: dealTitle(offer),
    retailer: retailerName(offer),
    price: priceValue(offer),
    priceText: priceText(offer),
    oldPriceText: oldPriceText(offer),
    unit: unitText(offer),
    validFrom: validity?.from ?? null,
    validUntil: validity?.to ?? null,
    imageUrl: imageUrl(offer),
    sourceUrl: null
  }
}

// Nur für die Debug-Route (server/api/debug/marktguru.get.ts) - liefert die
// KOMPLETTE, ungefilterte Rohantwort (nicht erst durch extractOffers()
// geschickt), damit sichtbar wird, ob der Grund für 0 Treffer eine falsche
// Envelope-Annahme oder eine wirklich leere API-Antwort ist.
export async function debugRawSearch(zipCode: string) {
  const creds = await fetchClientCredentials()
  const url = buildSearchUrl('Monster Energy', zipCode)
  const body = await searchRaw('Monster Energy', creds, zipCode)
  const extracted = extractOffers(body)
  return {
    requestUrl: url.href,
    topLevelKeys: body && typeof body === 'object' ? Object.keys(body) : typeof body,
    extractedCount: extracted.length,
    matchedCount: extracted.filter(isMonsterOffer).length,
    mapped: extracted.filter(isMonsterOffer).map(mapOffer),
    rawBody: body
  }
}

export async function fetchMonsterDeals(zipCode: string): Promise<MonsterDeal[]> {
  const creds = await fetchClientCredentials()
  const raw = await searchOffers('Monster Energy', creds, zipCode)
  const filtered = raw.filter(isMonsterOffer)

  if (raw.length > 0 && filtered.length === 0) {
    // Die Such-API liefert Treffer, aber unser Monster-Filter erkennt keinen
    // davon - vermutlich hat sich die Feldstruktur wieder geändert. Diese
    // Ausgabe zeigt im Server-Log, wie ein Rohangebot tatsächlich aussieht.
    console.warn(
      '[marktguru] Such-API lieferte', raw.length,
      'Treffer, aber keiner wurde als Monster Energy erkannt. Beispiel-Rohdaten:',
      JSON.stringify(raw[0], null, 2)
    )
  }

  return filtered.map(mapOffer)
}
