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
  return date.toLocaleDateString('de-DE')
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('de-DE')
}
</script>

<template>
  <main class="page">
    <header class="header">
      <h1>🥤 Monster Energy Finder</h1>
      <p class="subtitle">Aktuelle Angebote aus Supermarkt-Prospekten (Quelle: Marktguru)</p>
    </header>

    <section class="status">
      <span>Letztes Update: {{ formatDateTime(lastRun?.finishedAt) }}</span>
      <span v-if="lastRun?.status === 'error'" class="error">
        Letzter Lauf fehlgeschlagen: {{ lastRun?.error }}
      </span>
      <button :disabled="refreshing" @click="triggerRefresh">
        {{ refreshing ? 'Aktualisiere...' : 'Jetzt aktualisieren' }}
      </button>
    </section>
    <p v-if="refreshError" class="error">{{ refreshError }}</p>

    <section v-if="retailers.length" class="filters">
      <label for="retailer">Händler:</label>
      <select id="retailer" v-model="selectedRetailer">
        <option value="alle">Alle</option>
        <option v-for="r in retailers" :key="r" :value="r">{{ r }}</option>
      </select>
    </section>

    <p v-if="pending">Lade Angebote...</p>
    <p v-else-if="!filteredDeals.length" class="empty">
      Aktuell keine Monster Energy Angebote gefunden.
    </p>

    <ul v-else class="deal-grid">
      <li v-for="deal in filteredDeals" :key="deal.id" class="deal-card">
        <img v-if="deal.imageUrl" :src="deal.imageUrl" :alt="deal.title" class="deal-image" />
        <div class="deal-body">
          <h2>{{ deal.title }}</h2>
          <p class="retailer">{{ deal.retailer }}</p>
          <p class="price">{{ deal.priceText ?? 'Preis unbekannt' }}</p>
          <p v-if="deal.validFrom || deal.validUntil" class="validity">
            gültig {{ formatDate(deal.validFrom) }} - {{ formatDate(deal.validUntil) }}
          </p>
          <a v-if="deal.sourceUrl" :href="deal.sourceUrl" target="_blank" rel="noopener">Zum Angebot</a>
        </div>
      </li>
    </ul>
  </main>
</template>

<style>
body {
  margin: 0;
  font-family: system-ui, sans-serif;
  background: #f5f5f5;
  color: #1a1a1a;
}

.page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px 16px;
}

.header h1 {
  margin-bottom: 4px;
}

.subtitle {
  color: #555;
  margin-top: 0;
}

.status {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin: 16px 0;
}

.status button {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: #0a8f3c;
  color: white;
  cursor: pointer;
}

.status button:disabled {
  opacity: 0.6;
  cursor: default;
}

.error {
  color: #c0392b;
}

.filters {
  margin-bottom: 16px;
}

.empty {
  color: #555;
}

.deal-grid {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.deal-card {
  background: white;
  border-radius: 10px;
  padding: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.deal-image {
  width: 100%;
  height: 140px;
  object-fit: contain;
  margin-bottom: 8px;
}

.deal-body h2 {
  font-size: 1.05rem;
  margin: 0 0 4px;
}

.retailer {
  color: #555;
  margin: 0 0 4px;
}

.price {
  font-weight: bold;
  font-size: 1.2rem;
  color: #0a8f3c;
  margin: 0 0 4px;
}

.validity {
  font-size: 0.85rem;
  color: #777;
  margin: 0 0 8px;
}
</style>
