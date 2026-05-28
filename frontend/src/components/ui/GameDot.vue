<script setup lang="ts">
withDefaults(
  defineProps<{
    color?: string
    size?: number
  }>(),
  {
    color: 'var(--ink-3)',
    size: 5,
  },
)
</script>

<template>
  <span
    class="gametag__dot"
    :style="{ '--c': color, width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
  />
</template>
