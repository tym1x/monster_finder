<script setup lang="ts">
interface Deal {
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
const retailerPalette = ['#1c3d52', '#374a1f', '#5c3a1e', '#3d2f52', '#1f4a44', '#4a2233']
function retailerColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return retailerPalette[hash % retailerPalette.length]
}

// Die Bild-URL wird aus einem vermuteten CDN-Muster gebaut (siehe
// server/utils/marktguru.ts) - falls sie 404ed, auf den Platzhalter zurückfallen.
const brokenImages = reactive(new Set<string>())
function onImageError(dealId: string) {
  brokenImages.add(dealId)
}

// Bei SSR steht die Bild-URL schon im Server-HTML, der Browser lädt sie also
// schon, bevor Vue hydratisiert ist und @error überhaupt zuhören kann. Ein
// schneller Fehlschlag (wie hier, weil die CDN-Domain nicht erreichbar ist)
// ist beim Mounten oft schon durch - deshalb hier zusätzlich direkt prüfen.
function onImageMount(el: HTMLImageElement | null, dealId: string) {
  if (el?.complete && el.naturalWidth === 0) {
    onImageError(dealId)
  }
}
</script>

<template>
  <div class="page">
    <header class="header">
      <svg class="header-engraving" viewBox="0 0 1200 160" preserveAspectRatio="none" aria-hidden="true">
        <use href="#engraving-motif" />
      </svg>
      <svg class="header-peaks" viewBox="0 0 1200 90" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M0,90 L110,28 L200,60 L300,10 L400,55 L520,20 L620,58 L740,15 L860,52 L960,25 L1080,58 L1200,20 L1200,90 Z"
        />
      </svg>

      <div class="header-inner">
        <div class="brand">
          <svg class="brand-mark" viewBox="0 0 100 100" aria-hidden="true">
            <path
              d="M18 8 L30 46 L24 62 L34 100 M46 8 L50 50 L44 64 L52 100 M74 8 L64 46 L70 62 L62 100"
              fill="none" stroke="currentColor" stroke-width="11" stroke-linecap="square" stroke-linejoin="miter"
            />
          </svg>
          <div class="brand-text">
            <h1><span class="brand-anabolic">ANABOLIC</span> MONSTER FINDER</h1>
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
            <img
              v-if="deal.imageUrl && !brokenImages.has(deal.id)"
              :ref="(el) => onImageMount(el as HTMLImageElement | null, deal.id)"
              :src="deal.imageUrl"
              :alt="deal.title"
              class="deal-image"
              loading="lazy"
              @error="onImageError(deal.id)"
            />
            <div v-else class="deal-image-placeholder">M</div>
          </div>
          <div class="deal-body">
            <span class="retailer-tag">{{ deal.retailer }}</span>
            <h2>{{ deal.title }}</h2>
            <div class="price-row">
              <span class="price">{{ deal.priceText ?? 'Preis unbekannt' }}</span>
              <s v-if="deal.oldPriceText" class="old-price">{{ deal.oldPriceText }}</s>
              <span v-if="deal.validFrom || deal.validUntil" class="validity">
                {{ formatDate(deal.validFrom) }}&ndash;{{ formatDate(deal.validUntil) }}
              </span>
            </div>
            <span v-if="deal.unit" class="unit">{{ deal.unit }}</span>
          </div>
        </li>
      </ul>
    </main>

    <!-- Wiederverwendbares Gravur-Ornament fürs Header-Hintergrundmuster -->
    <svg width="0" height="0" style="position: absolute">
      <defs>
        <g id="engraving-motif" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <!-- Horizontale Hauptranke, schlängelt sich über die Header-Breite -->
          <path
            d="M-20,100 C 40,70 70,130 130,95 C 180,65 200,120 260,90 C 310,62 330,115 390,85
               C 440,58 460,110 520,80 C 560,58 580,95 630,75 C 670,58 690,100 740,78
               C 780,60 800,95 850,75 C 890,60 910,90 960,72 C 1000,58 1020,88 1080,70
               C 1120,56 1140,80 1220,65"
          />
          <!-- Abzweigende Ranken mit Blatt-Enden, wechselnd nach oben/unten -->
          <path d="M130,95 C 140,70 165,68 175,45" />
          <ellipse cx="178" cy="40" rx="12" ry="5" transform="rotate(60 178 40)" fill="currentColor" stroke="none" opacity="0.8" />
          <path d="M260,90 C 270,120 295,125 305,148" />
          <ellipse cx="308" cy="152" rx="11" ry="4.5" transform="rotate(-55 308 152)" fill="currentColor" stroke="none" opacity="0.8" />
          <path d="M520,80 C 530,50 555,48 565,25" />
          <ellipse cx="568" cy="20" rx="12" ry="5" transform="rotate(58 568 20)" fill="currentColor" stroke="none" opacity="0.8" />
          <path d="M740,78 C 750,108 775,112 785,135" />
          <ellipse cx="788" cy="139" rx="11" ry="4.5" transform="rotate(-55 788 139)" fill="currentColor" stroke="none" opacity="0.8" />
          <path d="M960,72 C 970,45 995,42 1005,20" />
          <ellipse cx="1008" cy="15" rx="11" ry="4.5" transform="rotate(58 1008 15)" fill="currentColor" stroke="none" opacity="0.8" />
          <circle cx="1220" cy="65" r="5" fill="currentColor" stroke="none" opacity="0.7" />
        </g>
      </defs>
    </svg>
  </div>
</template>

<style>
:root {
  --ink: #0c0c0c;
  --paper: #f2f1ec;
  --steel: #3f6f82;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: 'Arial Narrow', 'Segoe UI', system-ui, sans-serif;
  background: var(--paper);
  color: var(--ink);
}

.header {
  position: relative;
  background: #fff;
  border-bottom: 3px solid var(--ink);
  overflow: hidden;
}

.header-engraving {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  color: #000;
  opacity: 0.16;
  pointer-events: none;
}

.header-peaks {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 34px;
  width: 100%;
  color: transparent;
}

.header-peaks path {
  fill: #000;
  opacity: 0.06;
}

.header-inner {
  position: relative;
  max-width: 1100px;
  margin: 0 auto;
  padding: 20px 20px 26px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-mark {
  width: 42px;
  height: 46px;
  color: var(--ink);
  flex-shrink: 0;
}

.brand-text h1 {
  margin: 0;
  color: var(--ink);
  font-size: 1.3rem;
  font-weight: 900;
  letter-spacing: -0.01em;
  text-transform: uppercase;
  font-style: italic;
  transform: skewX(-4deg);
}

.brand-anabolic {
  color: var(--steel);
  margin-right: 0.35em;
}

.brand-text p {
  margin: 4px 0 0;
  color: #6b6a63;
  font-size: 0.8rem;
  font-style: normal;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  position: relative;
}

.updated {
  color: #6b6a63;
  font-size: 0.82rem;
}

.refresh-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 2px;
  background: var(--ink);
  color: #fff;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-style: italic;
  cursor: pointer;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--steel);
}

.refresh-btn:disabled {
  opacity: 0.5;
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
  color: #fff;
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
  border-radius: 4px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.deal-card:not(.skeleton):hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
}

.deal-image-wrap {
  height: 130px;
  position: relative;
  margin-bottom: 10px;
  overflow: hidden;
}

.deal-image {
  position: absolute;
  inset: 0;
  margin: auto;
  display: block;
  max-height: 100%;
  max-width: 100%;
  object-fit: contain;
}

.deal-image-placeholder {
  position: absolute;
  inset: 0;
  margin: auto;
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

.old-price {
  font-size: 0.85rem;
  color: #9a998e;
}

.validity {
  font-size: 0.75rem;
  color: #8a8a80;
  white-space: nowrap;
  margin-left: auto;
}

.unit {
  margin-top: auto;
  padding-top: 8px;
  font-size: 0.75rem;
  color: #9a998e;
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

@media (max-width: 480px) {
  .brand-text h1 {
    font-size: 1.05rem;
  }
}
</style>
