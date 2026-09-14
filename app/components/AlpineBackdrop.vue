<script setup lang="ts">
// Hintergrund des Headers im Stil der weißen Monster-Ultra-Dose:
// barocke Gravur-Ornamente (Akanthusranken) plus eine Alpen-Silhouette.
// Alles Vektor, damit es in jeder Auflösung scharf bleibt und keine
// externen Assets nötig sind.
const id = useId()
</script>

<template>
  <div class="backdrop" aria-hidden="true">
    <svg class="engraving" viewBox="0 0 1600 440" preserveAspectRatio="xMidYMid slice">
      <defs>
        <g :id="`${id}-curl`" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
          <path d="M0,0 C 20,-6 44,6 50,26 C 56,48 40,68 20,68 C 3,68 -8,54 -3,41 C 2,29 17,26 24,35 C 30,43 24,53 16,51" />
        </g>
        <g :id="`${id}-leaf`" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round">
          <path d="M0,0 C 12,-16 30,-25 52,-30 C 38,-16 33,-6 35,8 C 24,5 17,12 10,21 C 8,10 5,4 0,0 Z" />
          <path d="M4,2 C 16,-6 28,-14 44,-24" stroke-width="1.4" />
        </g>
        <g :id="`${id}-flourish`" fill="none" stroke="currentColor">
          <path d="M100,412 C 58,352 132,302 92,242 C 54,186 132,150 96,96 C 70,56 112,30 102,-4" stroke-width="3.4" />
          <path d="M108,410 C 70,352 140,304 100,244 C 64,188 140,152 104,98 C 80,58 120,32 110,-4" stroke-width="1.2" opacity="0.7" />
          <use :href="`#${id}-curl`" transform="translate(92,242) rotate(20) scale(0.9)" />
          <use :href="`#${id}-curl`" transform="translate(96,96) rotate(-150) scale(0.75)" />
          <use :href="`#${id}-curl`" transform="translate(100,378) rotate(-8) scale(0.55)" />
          <use :href="`#${id}-leaf`" transform="translate(96,300) rotate(-18) scale(1.15)" />
          <use :href="`#${id}-leaf`" transform="translate(104,196) rotate(150) scale(1)" />
          <use :href="`#${id}-leaf`" transform="translate(92,142) rotate(-30) scale(0.85)" />
          <use :href="`#${id}-leaf`" transform="translate(104,60) rotate(160) scale(0.9)" />
          <use :href="`#${id}-leaf`" transform="translate(98,352) rotate(200) scale(0.7)" />
        </g>
      </defs>

      <use :href="`#${id}-flourish`" transform="translate(-30,10) scale(1.05)" />
      <use :href="`#${id}-flourish`" transform="translate(250,0) scale(-0.72,0.72) translate(-200,0)" opacity="0.55" />
      <use :href="`#${id}-flourish`" transform="translate(1330,-10) scale(-1.05,1.05) translate(-200,0)" />
      <use :href="`#${id}-flourish`" transform="translate(1220,20) scale(0.7)" opacity="0.55" />
      <use :href="`#${id}-flourish`" transform="translate(560,60) scale(0.5)" opacity="0.35" />
      <use :href="`#${id}-flourish`" transform="translate(900,40) scale(-0.55,0.55) translate(-200,0)" opacity="0.35" />
    </svg>

    <svg class="peaks" viewBox="0 0 1600 400" preserveAspectRatio="none">
      <defs>
        <linearGradient :id="`${id}-far`" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#c9d4dd" />
          <stop offset="1" stop-color="#e7ecf1" />
        </linearGradient>
        <linearGradient :id="`${id}-mid`" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#aab8c6" />
          <stop offset="1" stop-color="#d7dee6" />
        </linearGradient>
        <linearGradient :id="`${id}-near`" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#8b9aab" />
          <stop offset="1" stop-color="#c2cbd6" />
        </linearGradient>
        <radialGradient :id="`${id}-sun`" cx="0.74" cy="0.02" r="0.45">
          <stop offset="0" stop-color="#9fdcf0" stop-opacity="0.7" />
          <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
        <g :id="`${id}-fir`" fill="#7d8b9c">
          <path d="M0,0 L-7,0 L-3.5,-8 L-6,-8 L-2.5,-16 L-4.5,-16 L0,-26 L4.5,-16 L2.5,-16 L6,-8 L3.5,-8 L7,0 Z" />
        </g>
      </defs>

      <rect width="1600" height="400" :fill="`url(#${id}-sun)`" />
      <path
        :fill="`url(#${id}-far)`"
        d="M0,400 L0,250 L90,170 L150,210 L250,110 L330,175 L430,95 L520,180 L610,120 L700,195 L800,130
           L900,200 L1000,120 L1100,190 L1210,110 L1320,185 L1430,130 L1530,195 L1600,150 L1600,400 Z"
      />
      <path
        :fill="`url(#${id}-mid)`"
        d="M0,400 L0,300 L120,230 L210,275 L320,190 L420,265 L540,205 L650,270 L770,215 L880,280 L1000,210
           L1120,275 L1250,205 L1370,270 L1490,225 L1600,285 L1600,400 Z"
      />
      <path
        :fill="`url(#${id}-near)`"
        d="M0,400 L0,345 L140,300 L260,340 L390,290 L520,340 L660,300 L790,350 L930,300 L1070,345 L1200,300
           L1340,345 L1470,305 L1600,345 L1600,400 Z"
      />
      <g opacity="0.7">
        <use :href="`#${id}-fir`" transform="translate(120,318) scale(1.1)" />
        <use :href="`#${id}-fir`" transform="translate(152,326)" />
        <use :href="`#${id}-fir`" transform="translate(300,315) scale(1.2)" />
        <use :href="`#${id}-fir`" transform="translate(330,322) scale(0.9)" />
        <use :href="`#${id}-fir`" transform="translate(600,314) scale(1.15)" />
        <use :href="`#${id}-fir`" transform="translate(632,320)" />
        <use :href="`#${id}-fir`" transform="translate(1010,318) scale(1.1)" />
        <use :href="`#${id}-fir`" transform="translate(1042,326) scale(0.9)" />
        <use :href="`#${id}-fir`" transform="translate(1330,320) scale(1.2)" />
        <use :href="`#${id}-fir`" transform="translate(1362,328)" />
      </g>
      <path
        fill="#ffffff"
        d="M0,400 L0,372 C 220,340 380,392 620,366 C 860,340 1010,394 1240,368 C 1400,350 1500,382 1600,366 L1600,400 Z"
      />
    </svg>

    <!-- Optionales echtes Foto: liegt public/hero.jpg vor, legt es sich über
         die gezeichnete Kulisse; fehlt die Datei, lädt nichts und die
         Vektor-Berge bleiben sichtbar. Liegt bewusst NACH den Bergen im
         Markup, sonst würden die Pfade das Foto verdecken. -->
    <div class="photo" />
  </div>
</template>

<style scoped>
.backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.engraving {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  color: #2a3138;
  opacity: 0.13;
}

.photo {
  position: absolute;
  inset: 0;
  background-image: url('/hero.jpg');
  background-size: cover;
  background-position: center 45%;
  /* Nach oben hin ausblenden, damit Logo und Schrift lesbar bleiben */
  mask-image: linear-gradient(to bottom, transparent 0%, transparent 24%, rgba(0, 0, 0, 0.92) 62%, #000 100%);
}

.peaks {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  width: 100%;
  height: 58%;
}
</style>
