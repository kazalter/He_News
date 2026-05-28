<script setup lang="ts">
defineProps<{
  label: string
}>()
</script>

<template>
  <div class="daysep">{{ label }}</div>
</template>
