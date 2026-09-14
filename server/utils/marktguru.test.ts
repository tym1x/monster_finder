import { describe, expect, it } from 'vitest'
import { findKeysDeep, isMonsterOffer, mapOffer } from './marktguru'

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
  it('erkennt Monster Energy anhand des Titels', () => {
    expect(isMonsterOffer({ title: 'Monster Energy Ultra 500ml' })).toBe(true)
  })

  it('erkennt Monster Energy anhand der Marke', () => {
    expect(isMonsterOffer({ name: 'Energy Drink', brand: 'Monster' })).toBe(true)
  })

  it('lehnt unrelated Treffer ab', () => {
    expect(isMonsterOffer({ title: 'Red Bull Energy Drink' })).toBe(false)
  })
})

describe('mapOffer', () => {
  it('mappt ein Rohangebot auf das DB-Format', () => {
    const deal = mapOffer({
      id: 42,
      title: 'Monster Energy Ultra 500ml',
      retailer: { name: 'Netto' },
      price: { value: 0.99, formattedValue: '0,99 €' },
      validFrom: '2026-09-14',
      validTo: '2026-09-20',
      webUrl: 'https://example.com/angebot/42'
    })

    expect(deal).toEqual({
      id: '42',
      title: 'Monster Energy Ultra 500ml',
      retailer: 'Netto',
      price: 0.99,
      priceText: '0,99 €',
      unit: null,
      validFrom: '2026-09-14',
      validUntil: '2026-09-20',
      imageUrl: null,
      sourceUrl: 'https://example.com/angebot/42'
    })
  })
})
