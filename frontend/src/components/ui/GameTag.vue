<script setup lang="ts">
import GameDot from './GameDot.vue'

withDefaults(
  defineProps<{
    name: string
    color?: string
  }>(),
  {
    color: 'var(--ink-2)',
  },
)
</script>

<template>
  <span class="gametag" :style="{ '--c': color }">
    <GameDot :color="color" />
    {{ name }}
  </span>
</template>
