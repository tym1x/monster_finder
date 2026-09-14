<script setup lang="ts">
interface Deal {
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
  lastSeenAt: string
}

interface LastRun {
  startedAt: string
  finishedAt: string | null
  status: string
  dealsFound: number
  error: string | null
}

const { data, refresh, pending } = await useFetch<{ deals: Deal[]; lastRun: LastRun | null }>(
  '/api/deals'
)

const deals = computed(() => data.value?.deals ?? [])
const lastRun = computed(() => data.value?.lastRun ?? null)

const retailers = computed(() => {
  const names = new Set(deals.value.map((d) => d.retailer))
  return Array.from(names).sort()
})
const selectedRetailer = ref('alle')

const filteredDeals = computed(() => {
  if (selectedRetailer.value === 'alle') return deals.value
  return deals.value.filter((d) => d.retailer === selectedRetailer.value)
})

const refreshing = ref(false)
const refreshError = ref<string | null>(null)

async function triggerRefresh() {
  refreshing.value = true
  refreshError.value = null
  try {
    await $fetch('/api/deals/refresh', { method: 'POST' })
    await refresh()
  } catch (err: any) {
    refreshError.value = err?.data?.statusMessage || err?.message || 'Unbekannter Fehler'
  } finally {
    refreshing.value = false
  }
}

function formatDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'noch nie'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
}

// Feste, ruhige Farbpalette für die Retailer-Akzentleiste an den Karten -
// gehasht auf den Namen, damit derselbe Händler immer dieselbe Farbe bekommt.
const retailerPalette = ['#2f6f4f', '#3f5d7d', '#8a5a2b', '#6b4c8a', '#2f7a7a', '#7a2f4f']
function retailerColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return retailerPalette[hash % retailerPalette.length]
}
</script>

<template>
  <div class="page">
    <header class="header">
      <div class="header-inner">
        <div class="brand">
          <span class="brand-mark">M</span>
          <div class="brand-text">
            <h1>MONSTER FINDER</h1>
            <p>Angebote aus Supermarkt-Prospekten &middot; Quelle: Marktguru</p>
          </div>
        </div>
        <div class="header-actions">
          <span class="updated">Update: {{ formatDateTime(lastRun?.finishedAt) }}</span>
          <button class="refresh-btn" :disabled="refreshing" @click="triggerRefresh">
            {{ refreshing ? 'Läuft…' : 'Jetzt aktualisieren' }}
          </button>
        </div>
      </div>
    </header>

    <p v-if="lastRun?.status === 'error' || refreshError" class="error-banner">
      <strong>Scrape fehlgeschlagen:</strong> {{ refreshError ?? lastRun?.error }}
    </p>

    <main class="content">
      <div v-if="retailers.length > 1" class="filters">
        <button
          class="pill"
          :class="{ active: selectedRetailer === 'alle' }"
          @click="selectedRetailer = 'alle'"
        >
          Alle ({{ deals.length }})
        </button>
        <button
          v-for="r in retailers"
          :key="r"
          class="pill"
          :class="{ active: selectedRetailer === r }"
          @click="selectedRetailer = r"
        >
          {{ r }}
        </button>
      </div>

      <ul v-if="pending" class="deal-grid" aria-hidden="true">
        <li v-for="i in 6" :key="i" class="deal-card skeleton">
          <div class="skeleton-block image" />
          <div class="skeleton-block line short" />
          <div class="skeleton-block line" />
        </li>
      </ul>

      <div v-else-if="!filteredDeals.length" class="empty">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M4 8h16l-1.5 11.5a1 1 0 0 1-1 .5H6.5a1 1 0 0 1-1-.5L4 8Z" />
          <path d="M8 8V6a4 4 0 0 1 8 0v2" />
        </svg>
        <p>Aktuell keine Monster Energy Angebote gefunden.</p>
        <p class="empty-hint">Der nächste automatische Check läuft nächste Woche &ndash; oder klick oben auf "Jetzt aktualisieren".</p>
      </div>

      <ul v-else class="deal-grid">
        <li
          v-for="deal in filteredDeals"
          :key="deal.id"
          class="deal-card"
          :style="{ '--accent': retailerColor(deal.retailer) }"
        >
          <div class="deal-image-wrap">
            <img v-if="deal.imageUrl" :src="deal.imageUrl" :alt="deal.title" class="deal-image" loading="lazy" />
            <div v-else class="deal-image-placeholder">M</div>
          </div>
          <div class="deal-body">
            <span class="retailer-tag">{{ deal.retailer }}</span>
            <h2>{{ deal.title }}</h2>
            <div class="price-row">
              <span class="price">{{ deal.priceText ?? 'Preis unbekannt' }}</span>
              <span v-if="deal.validFrom || deal.validUntil" class="validity">
                {{ formatDate(deal.validFrom) }}&ndash;{{ formatDate(deal.validUntil) }}
              </span>
            </div>
            <a v-if="deal.sourceUrl" :href="deal.sourceUrl" target="_blank" rel="noopener" class="deal-link">
              Zum Angebot →
            </a>
          </div>
        </li>
      </ul>
    </main>
  </div>
</template>

<style>
:root {
  --lime: #c4e023;
  --ink: #0d0d0d;
  --paper: #f3f2ee;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: var(--paper);
  color: var(--ink);
}

.header {
  background: var(--ink);
  border-bottom: 4px solid var(--lime);
}

.header-inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 18px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  background: var(--lime);
  color: var(--ink);
  font-weight: 900;
  font-size: 1.3rem;
  border-radius: 4px;
  flex-shrink: 0;
}

.brand-text h1 {
  margin: 0;
  color: #fff;
  font-size: 1.15rem;
  letter-spacing: 0.06em;
}

.brand-text p {
  margin: 2px 0 0;
  color: #9a9a92;
  font-size: 0.8rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.updated {
  color: #b7b7ae;
  font-size: 0.82rem;
}

.refresh-btn {
  padding: 9px 18px;
  border: none;
  border-radius: 4px;
  background: var(--lime);
  color: var(--ink);
  font-weight: 700;
  cursor: pointer;
}

.refresh-btn:hover:not(:disabled) {
  filter: brightness(0.92);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.error-banner {
  margin: 0;
  padding: 10px 20px;
  background: #3a1414;
  color: #ffb4b4;
  font-size: 0.88rem;
  text-align: center;
}

.content {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 20px 60px;
}

.filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.pill {
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid #cfcec4;
  background: #fff;
  color: var(--ink);
  font-size: 0.85rem;
  cursor: pointer;
}

.pill.active {
  background: var(--ink);
  border-color: var(--ink);
  color: var(--lime);
}

.deal-grid {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 16px;
}

.deal-card {
  background: #fff;
  border: 1px solid #e3e2d9;
  border-left: 4px solid var(--accent, var(--ink));
  border-radius: 6px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.deal-card:not(.skeleton):hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}

.deal-image-wrap {
  height: 130px;
  display: grid;
  place-items: center;
  margin-bottom: 10px;
}

.deal-image {
  max-height: 100%;
  max-width: 100%;
  object-fit: contain;
}

.deal-image-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--paper);
  color: #b3b2a8;
  font-weight: 900;
  display: grid;
  place-items: center;
  font-size: 1.3rem;
}

.retailer-tag {
  align-self: flex-start;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--accent, var(--ink));
  margin-bottom: 4px;
}

.deal-body h2 {
  font-size: 1rem;
  margin: 0 0 10px;
  line-height: 1.3;
}

.price-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.price {
  font-weight: 800;
  font-size: 1.3rem;
}

.validity {
  font-size: 0.75rem;
  color: #8a8a80;
  white-space: nowrap;
}

.deal-link {
  margin-top: auto;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink);
  text-decoration: none;
  border-bottom: 2px solid var(--lime);
  align-self: flex-start;
  padding-bottom: 1px;
}

.empty {
  text-align: center;
  color: #6b6a60;
  padding: 60px 20px;
}

.empty svg {
  color: #cfcec4;
  margin-bottom: 12px;
}

.empty-hint {
  font-size: 0.85rem;
  color: #9a998e;
}

.skeleton {
  border-left-color: #e3e2d9;
}

.skeleton-block {
  background: linear-gradient(90deg, #ececE4 25%, #f5f4ee 37%, #ececE4 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
  border-radius: 4px;
}

.skeleton-block.image {
  height: 130px;
  margin-bottom: 10px;
}

.skeleton-block.line {
  height: 14px;
  margin-bottom: 8px;
}

.skeleton-block.line.short {
  width: 60%;
  height: 10px;
}

@keyframes shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
</style>
