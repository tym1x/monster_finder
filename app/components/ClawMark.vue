<script setup lang="ts">
// Nachgezeichnetes Monster-Claw-Zeichen (drei gerissene Krallenstriche).
// `variant` steuert die Optik: 'metal' = Silberverlauf mit schwarzer Kontur
// (wie auf der weißen Ultra-Dose), 'solid' = einfarbig für Wasserzeichen.
withDefaults(defineProps<{ variant?: 'metal' | 'solid' }>(), { variant: 'metal' })

const gradientId = useId()
</script>

<template>
  <svg viewBox="0 0 300 350" class="claw" :class="variant" aria-hidden="true">
    <defs>
      <linearGradient :id="gradientId" x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0" stop-color="#ffffff" />
        <stop offset="0.5" stop-color="#eceef1" />
        <stop offset="1" stop-color="#b3b9c2" />
      </linearGradient>
      <path
        :id="`${gradientId}-side`"
        d="M26,12 L88,12 L91,44 L86,56 L95,100 L90,112 L99,156 L95,168 L104,210 L100,222 L107,262 L104,276
           L108,300 L98,322 L88,296 L84,266 L88,256 L76,244 L72,214 L76,204 L64,182 L59,176 L55,146 L58,136
           L45,105 L43,97 L39,62 L42,52 L30,26 Z"
      />
    </defs>
    <g :fill="variant === 'metal' ? `url(#${gradientId})` : 'currentColor'">
      <use :href="`#${gradientId}-side`" />
      <path
        d="M119,6 L181,6 L184,40 L178,52 L178,100 L182,112 L174,158 L178,170 L174,190 L172,238 L176,250
           L167,268 L165,300 L162,312 L150,336 L138,312 L135,300 L133,268 L124,250 L128,238 L126,190
           L122,170 L126,158 L118,112 L122,100 L122,52 L116,40 Z"
      />
      <use :href="`#${gradientId}-side`" transform="translate(300,0) scale(-1,1)" />
    </g>
  </svg>
</template>

<style scoped>
.claw.metal g {
  stroke: #0a0a0a;
  stroke-width: 8;
  stroke-linejoin: miter;
}
</style>
