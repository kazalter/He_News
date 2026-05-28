<script setup lang="ts">
withDefaults(
  defineProps<{
    active?: boolean
    type?: 'button' | 'submit'
  }>(),
  {
    active: false,
    type: 'button',
  },
)
</script>

<template>
  <button class="linkbtn" :class="{ 'is-active': active }" :type="type">
    <slot />
  </button>
</template>
