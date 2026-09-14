import { describe, expect, it } from 'vitest'
import { buildSearchUrl, findKeysDeep, isMonsterOffer, mapOffer } from './marktguru'

// Gekürztes, aber echtes Angebot aus der Marktguru-Such-API (eingefangen über
// die Debug-Route GET /api/debug/marktguru). Als Fixture verwenden, statt
// Feldnamen zu erraten.
const realOffer = {
  brand: { name: 'Monster Energy', uniqueName: 'monster-energy', id: 118604 },
  advertisers: [{ name: 'REWE', id: 'retailers/126802' }],
  id: 24841118,
  description: 'HINWEIS: MIT APP 0,10 € REWE BONUS versch. Sorten, koffeinhaltig, je 0,5-l-Dose zzgl. 0.25 Pfand',
  volume: 0.5,
  quantity: 1,
  price: 0.99,
  oldPrice: null,
  referencePrice: 1.98,
  validityDates: [{ from: '2026-09-13T22:00:00Z', to: '2026-09-19T21:59:59Z' }],
  product: { id: 31835, name: 'Energy Drink', description: null },
  unit: { shortName: 'l', id: 1, name: 'Liter' },
  images: { count: 1 }
}

describe('buildSearchUrl', () => {
  it('behält das /api/v1 Pfadsegment (Regression: URL-Auflösung verschluckte es)', () => {
    const url = buildSearchUrl('Monster Energy', '10115')
    expect(url.href).toMatch(/^https:\/\/api\.marktguru\.de\/api\/v1\/offers\/search\?/)
  })
})

describe('findKeysDeep', () => {
  it('findet apiKey/clientKey egal wie tief verschachtelt', () => {
    const json = { app: { config: { auth: { apiKey: 'abc', clientKey: 'xyz' } } } }
    expect(findKeysDeep(json)).toEqual({ apiKey: 'abc', clientKey: 'xyz' })
  })

  it('gibt leeres Objekt zurück, wenn nichts gefunden wird', () => {
    expect(findKeysDeep({ foo: 'bar' })).toEqual({})
  })
})

describe('isMonsterOffer', () => {
  it('erkennt ein echtes Marktguru-Angebot (Marke steckt in brand.name, product.name ist generisch)', () => {
    expect(isMonsterOffer(realOffer)).toBe(true)
  })

  it('lehnt unrelated Treffer ab', () => {
    expect(isMonsterOffer({ product: { name: 'Energy Drink' }, brand: { name: 'Red Bull' } })).toBe(false)
  })
})

describe('mapOffer', () => {
  it('mappt ein echtes Rohangebot korrekt auf das DB-Format', () => {
    const deal = mapOffer(realOffer)

    expect(deal.id).toBe('24841118')
    // "Monster Energy" + "Energy Drink" - das doppelte Wort fällt weg
    expect(deal.title).toBe('Monster Energy Drink')
    expect(deal.retailer).toBe('REWE')
    expect(deal.price).toBe(0.99)
    expect(deal.priceText).toBe('0,99 €')
    expect(deal.oldPriceText).toBeNull() // oldPrice ist null in diesem Beispiel
    expect(deal.unit).toBe('0,5 l')
    expect(deal.validFrom).toBe('2026-09-13T22:00:00Z')
    expect(deal.validUntil).toBe('2026-09-19T21:59:59Z')
    expect(deal.imageUrl).toBe('https://mg2de.b-cdn.net/api/v1/offers/24841118/images/default/0/large.jpg')
  })

  it('zeigt einen Streichpreis, wenn oldPrice höher als price ist', () => {
    const deal = mapOffer({ ...realOffer, price: 0.99, oldPrice: 1.49 })
    expect(deal.oldPriceText).toBe('1,49 €')
  })

  it('lässt einen Produktnamen unangetastet, der die Marke schon enthält', () => {
    const deal = mapOffer({ ...realOffer, product: { name: 'Monster Energy Ultra 500ml' } })
    expect(deal.title).toBe('Monster Energy Ultra 500ml')
  })
})
