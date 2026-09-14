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

const bestPrice = computed(() => {
  const prices = deals.value.map((d) => d.price).filter((p): p is number => p != null)
  return prices.length ? Math.min(...prices) : null
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
  return date.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
}

function formatPrice(value: number) {
  return `${value.toFixed(2).replace('.', ',')} €`
}

// Die Bild-URL wird aus einem vermuteten CDN-Muster gebaut (siehe
// server/utils/marktguru.ts) - falls sie 404ed, auf den Platzhalter zurückfallen.
const brokenImages = reactive(new Set<string>())
function onImageError(dealId: string) {
  brokenImages.add(dealId)
}

// Bei SSR steht die Bild-URL schon im Server-HTML, der Browser lädt sie also
// schon, bevor Vue hydratisiert ist und @error überhaupt zuhören kann. Ein
// schneller Fehlschlag ist beim Mounten oft schon durch - deshalb hier
// zusätzlich direkt den Ladezustand prüfen.
function onImageMount(el: HTMLImageElement | null, dealId: string) {
  if (el?.complete && el.naturalWidth === 0) {
    onImageError(dealId)
  }
}
</script>

<template>
  <div class="page">
    <header class="hero">
      <AlpineBackdrop />
      <ClawMark variant="solid" class="hero-watermark" />

      <div class="hero-inner">
        <div class="hero-top">
          <div class="brand">
            <ClawMark class="brand-claw" />
            <div class="wordmark">
              <span class="kicker">Anabolic</span>
              <h1>Monster Finder</h1>
              <p class="tagline">Wöchentlich gescannte Prospekt-Angebote &middot; Quelle: Marktguru</p>
            </div>
          </div>

          <div class="hero-actions">
            <span class="updated">Stand {{ formatDateTime(lastRun?.finishedAt) }}</span>
            <button class="refresh-btn" :disabled="refreshing" @click="triggerRefresh">
              <span class="refresh-btn-label">{{ refreshing ? 'Scannt…' : 'Jetzt scannen' }}</span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <section class="stat-band">
      <dl class="stats">
        <div class="stat">
          <dt>Angebote</dt>
          <dd>{{ deals.length }}</dd>
        </div>
        <div class="stat">
          <dt>Bestpreis</dt>
          <dd class="stat-highlight">{{ bestPrice != null ? formatPrice(bestPrice) : '—' }}</dd>
        </div>
        <div class="stat">
          <dt>Händler</dt>
          <dd>{{ retailers.length }}</dd>
        </div>
        <p class="stat-note">Automatischer Prospekt-Scan &middot; jeden Montag</p>
      </dl>
    </section>

    <p v-if="lastRun?.status === 'error' || refreshError" class="error-banner">
      <strong>Scan fehlgeschlagen:</strong> {{ refreshError ?? lastRun?.error }}
    </p>

    <main class="content">
      <div v-if="retailers.length > 1" class="filters">
        <button
          class="pill"
          :class="{ active: selectedRetailer === 'alle' }"
          @click="selectedRetailer = 'alle'"
        >
          Alle <span class="pill-count">{{ deals.length }}</span>
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
        <ClawMark variant="solid" class="empty-claw" />
        <p class="empty-title">Keine Angebote im Revier</p>
        <p class="empty-hint">
          Der nächste automatische Scan läuft kommenden Montag &ndash; oder jetzt oben selbst starten.
        </p>
      </div>

      <ul v-else class="deal-grid">
        <li v-for="deal in filteredDeals" :key="deal.id" class="deal-card">
          <div class="deal-image-wrap">
            <ClawMark variant="solid" class="card-watermark" />
            <img
              v-if="deal.imageUrl && !brokenImages.has(deal.id)"
              :ref="(el) => onImageMount(el as HTMLImageElement | null, deal.id)"
              :src="deal.imageUrl"
              :alt="deal.title"
              class="deal-image"
              loading="lazy"
              @error="onImageError(deal.id)"
            />
            <span v-if="deal.price != null && deal.price === bestPrice" class="best-badge">Bestpreis</span>
          </div>

          <div class="deal-body">
            <span class="retailer-tag">{{ deal.retailer }}</span>
            <h2>{{ deal.title }}</h2>

            <div class="price-row">
              <span class="price">{{ deal.priceText ?? '—' }}</span>
              <s v-if="deal.oldPriceText" class="old-price">{{ deal.oldPriceText }}</s>
            </div>

            <div class="deal-meta">
              <span v-if="deal.unit">{{ deal.unit }}</span>
              <span v-if="deal.validUntil" class="validity">
                bis {{ formatDate(deal.validUntil) }}
              </span>
            </div>
          </div>
        </li>
      </ul>
    </main>
  </div>
</template>

<style>
:root {
  --ink: #0b0d10;
  --paper: #f4f5f6;
  --line: #dcdfe4;
  --muted: #6e747d;
  --ultra: #1fa2c6;
  --display: 'Haettenschweiler', 'Arial Narrow', 'Impact', 'Franklin Gothic Bold', system-ui, sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, 'Segoe UI', sans-serif;
  background: var(--paper);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
}

/* ---------- Hero ---------- */

.hero {
  position: relative;
  background: #fff;
  overflow: hidden;
}

.hero-inner {
  position: relative;
  max-width: 1140px;
  margin: 0 auto;
  padding: 34px 22px 118px;
}

/* Großer, blasser Claw im "Himmel" - zitiert das Dosen-Design */
.hero-watermark {
  position: absolute;
  right: 11%;
  top: 62px;
  width: 176px;
  height: 206px;
  color: #0b0d10;
  opacity: 0.05;
  pointer-events: none;
}

.hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}

.brand {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.brand-claw {
  width: 72px;
  height: 84px;
  flex-shrink: 0;
  filter: drop-shadow(0 3px 7px rgba(0, 0, 0, 0.22));
}

.kicker {
  display: block;
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.46em;
  text-transform: uppercase;
  color: var(--ultra);
  margin-bottom: 2px;
}

.wordmark h1 {
  margin: 0;
  font-family: var(--display);
  font-size: clamp(2.2rem, 5.6vw, 3.5rem);
  line-height: 0.9;
  /* Impact/Haettenschweiler kennen nur eine Schnittstärke, aber falls beide
     fehlen, soll der Fallback wenigstens fett und schmal laufen. */
  font-weight: 900;
  font-stretch: condensed;
  letter-spacing: 0.005em;
  text-transform: uppercase;
  transform: skewX(-7deg);
  transform-origin: left;
  color: var(--ink);
  text-shadow: 0 1px 0 #fff, 0 2px 12px rgba(255, 255, 255, 0.95);
}

.tagline {
  margin: 8px 0 0;
  font-size: 0.82rem;
  color: var(--muted);
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.updated {
  font-size: 0.76rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.refresh-btn {
  border: none;
  cursor: pointer;
  padding: 0;
  background: var(--ink);
  color: #fff;
  /* abgeschrägte Ecken statt Radius - passt zum kantigen Look */
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
}

.refresh-btn-label {
  display: block;
  padding: 12px 22px;
  font-family: var(--display);
  font-weight: 900;
  font-stretch: condensed;
  font-size: 1.02rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  transform: skewX(-7deg);
}

.refresh-btn:hover:not(:disabled) {
  background: var(--ultra);
}

.refresh-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.stat-band {
  background: var(--ink);
  color: #fff;
}

.stats {
  max-width: 1140px;
  margin: 0 auto;
  padding: 15px 22px 17px;
  display: flex;
  align-items: flex-end;
  gap: 44px;
  flex-wrap: wrap;
}

.stat dt {
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: #8b939e;
}

.stat dd {
  margin: 2px 0 0;
  font-family: var(--display);
  font-weight: 900;
  font-stretch: condensed;
  font-size: 1.95rem;
  line-height: 1;
  transform: skewX(-7deg);
  transform-origin: left;
}

.stat-highlight {
  color: var(--ultra);
}

.stat-note {
  margin: 0 0 3px auto;
  font-size: 0.68rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #767d87;
}

/* ---------- Fehler ---------- */

.error-banner {
  margin: 0;
  padding: 11px 20px;
  background: #2b1113;
  color: #ffb9b9;
  font-size: 0.86rem;
  text-align: center;
}

/* ---------- Inhalt ---------- */

.content {
  max-width: 1140px;
  margin: 0 auto;
  padding: 26px 22px 70px;
}

.filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 22px;
}

.pill {
  padding: 7px 15px;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.pill:hover:not(.active) {
  border-color: var(--ink);
}

.pill.active {
  background: var(--ink);
  border-color: var(--ink);
  color: #fff;
}

.pill-count {
  opacity: 0.55;
  margin-left: 4px;
}

.deal-grid {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(236px, 1fr));
  gap: 18px;
}

.deal-card {
  position: relative;
  background: #fff;
  border: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  transition: transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease;
}

.deal-card::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 3px;
  background: var(--ultra);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.18s ease;
}

.deal-card:not(.skeleton):hover {
  transform: translateY(-3px);
  border-color: #c4c9d0;
  box-shadow: 0 10px 26px rgba(11, 13, 16, 0.12);
}

.deal-card:not(.skeleton):hover::after {
  transform: scaleX(1);
}

.deal-image-wrap {
  position: relative;
  height: 192px;
  overflow: hidden;
  background: linear-gradient(160deg, #ffffff 0%, #f2f4f7 60%, #e4e8ed 100%);
  border-bottom: 1px solid var(--line);
}

.card-watermark {
  position: absolute;
  right: -22px;
  bottom: -26px;
  width: 118px;
  height: 138px;
  color: #0b0d10;
  opacity: 0.05;
}

.deal-image {
  position: absolute;
  inset: 0;
  margin: auto;
  display: block;
  max-width: 82%;
  max-height: 86%;
  object-fit: contain;
  filter: drop-shadow(0 6px 10px rgba(11, 13, 16, 0.16));
}

.best-badge {
  position: absolute;
  top: 10px;
  left: 0;
  background: var(--ultra);
  color: #fff;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  padding: 5px 11px 5px 10px;
  clip-path: polygon(0 0, 100% 0, calc(100% - 7px) 100%, 0 100%);
}

.deal-body {
  padding: 13px 14px 15px;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.retailer-tag {
  font-size: 0.64rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
}

.deal-body h2 {
  font-size: 0.94rem;
  font-weight: 600;
  margin: 5px 0 10px;
  line-height: 1.32;
}

.price-row {
  display: flex;
  align-items: baseline;
  gap: 9px;
  margin-top: auto;
}

.price {
  font-family: var(--display);
  font-weight: 900;
  font-stretch: condensed;
  font-size: 2rem;
  line-height: 1;
  transform: skewX(-7deg);
  transform-origin: left;
}

.old-price {
  font-size: 0.85rem;
  color: var(--muted);
}

.deal-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 9px;
  padding-top: 9px;
  border-top: 1px solid var(--line);
  font-size: 0.72rem;
  color: var(--muted);
}

/* ---------- Leerzustand ---------- */

.empty {
  text-align: center;
  padding: 64px 20px 80px;
  color: var(--muted);
}

.empty-claw {
  width: 66px;
  height: 77px;
  color: #0b0d10;
  opacity: 0.12;
}

.empty-title {
  font-family: var(--display);
  font-weight: 900;
  font-stretch: condensed;
  font-size: 1.6rem;
  text-transform: uppercase;
  color: var(--ink);
  margin: 14px 0 6px;
  transform: skewX(-7deg);
}

.empty-hint {
  margin: 0;
  font-size: 0.86rem;
}

/* ---------- Skeleton ---------- */

.skeleton-block {
  background: linear-gradient(90deg, #ededf0 25%, #f7f8f9 37%, #ededf0 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
}

.skeleton-block.image {
  height: 192px;
}

.skeleton-block.line {
  height: 13px;
  margin: 14px 14px 0;
}

.skeleton-block.line.short {
  width: 45%;
  height: 9px;
  margin-top: 16px;
}

@keyframes shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

@media (max-width: 620px) {
  .hero-top {
    flex-direction: column;
  }

  .hero-inner {
    padding-bottom: 92px;
  }

  .stats {
    gap: 26px;
  }

  .stat dd {
    font-size: 1.55rem;
  }

  .stat-note {
    display: none;
  }
}

@media (max-width: 760px) {
  /* Auf schmalen Screens liegt das Wasserzeichen sonst unter der Schrift */
  .hero-watermark {
    display: none;
  }
}
</style>
