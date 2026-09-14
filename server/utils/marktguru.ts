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

interface RawOffer {
  id?: string | number
  name?: string
  title?: string
  brand?: string
  retailer?: { name?: string } | string
  merchant?: { name?: string } | string
  price?: { value?: number; formattedValue?: string } | number
  formattedPrice?: string
  unit?: string
  validFrom?: string
  validTo?: string
  startDate?: string
  endDate?: string
  image?: string
  imageUrl?: string
  images?: { url?: string }[]
  url?: string
  webUrl?: string
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

async function searchOffers(
  query: string,
  creds: ClientCredentials,
  zipCode: string
): Promise<RawOffer[]> {
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
  const json = await res.json()
  // Die API wrappt Treffer je nach Version in `.offers`, `.items` oder liefert direkt ein Array.
  return json.offers ?? json.items ?? (Array.isArray(json) ? json : [])
}

function retailerName(offer: RawOffer): string {
  const r = offer.retailer ?? offer.merchant
  if (typeof r === 'string') return r
  return r?.name ?? 'Unbekannt'
}

function priceValue(offer: RawOffer): number | null {
  if (typeof offer.price === 'number') return offer.price
  if (typeof offer.price?.value === 'number') return offer.price.value
  return null
}

function priceText(offer: RawOffer): string | null {
  if (typeof offer.price === 'object' && offer.price?.formattedValue) return offer.price.formattedValue
  if (offer.formattedPrice) return offer.formattedPrice
  const value = priceValue(offer)
  return value != null ? `${value.toFixed(2).replace('.', ',')} €` : null
}

function imageUrl(offer: RawOffer): string | null {
  return offer.imageUrl ?? offer.image ?? offer.images?.[0]?.url ?? null
}

export interface MonsterDeal {
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

/**
 * Sucht bei Marktguru nach "Monster Energy" und filtert clientseitig nochmal
 * auf Treffer, die "monster" im Titel/Marke enthalten - die Such-API liefert
 * sonst auch thematisch verwandte, aber irrelevante Treffer zurück.
 */
export function isMonsterOffer(offer: RawOffer): boolean {
  const haystack = `${offer.title ?? offer.name ?? ''} ${offer.brand ?? ''}`.toLowerCase()
  return haystack.includes('monster')
}

export function mapOffer(offer: RawOffer): MonsterDeal {
  return {
    id: String(offer.id ?? `${retailerName(offer)}-${offer.title ?? offer.name}`),
    title: offer.title ?? offer.name ?? 'Monster Energy',
    retailer: retailerName(offer),
    price: priceValue(offer),
    priceText: priceText(offer),
    unit: offer.unit ?? null,
    validFrom: offer.validFrom ?? offer.startDate ?? null,
    validUntil: offer.validTo ?? offer.endDate ?? null,
    imageUrl: imageUrl(offer),
    sourceUrl: offer.webUrl ?? offer.url ?? null
  }
}

export async function fetchMonsterDeals(zipCode: string): Promise<MonsterDeal[]> {
  const creds = await fetchClientCredentials()
  const raw = await searchOffers('Monster Energy', creds, zipCode)
  return raw.filter(isMonsterOffer).map(mapOffer)
}
