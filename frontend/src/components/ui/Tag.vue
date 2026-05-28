<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'default' | 'accent' | 'live' | 'success' | 'warn'
    pulse?: boolean
  }>(),
  {
    tone: 'default',
    pulse: false,
  },
)
</script>

<template>
  <span class="tag" :class="tone !== 'default' ? `tag--${tone}` : undefined">
    <span v-if="pulse" class="tag__pulse" aria-hidden="true" />
    <slot />
  </span>
</template>
