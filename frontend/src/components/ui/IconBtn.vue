<script setup lang="ts">
defineProps<{
  title: string
  active?: boolean
  dot?: boolean
  type?: 'button' | 'submit'
}>()
</script>

<template>
  <button class="iconbtn" :class="{ 'is-active': active }" :type="type ?? 'button'" :title="title" :aria-label="title">
    <slot />
    <span v-if="dot" class="iconbtn__dot" aria-hidden="true" />
  </button>
</template>
