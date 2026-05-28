<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    targetAt: string
    label?: string
    when?: string
  }>(),
  {
    label: '下一场前瞻 · 倒计时',
    when: '05.30 周六 19:00',
  },
)

const now = ref(Date.now())
let timer: number | undefined

const segments = computed(() => {
  const target = new Date(props.targetAt).getTime()
  let diff = Math.max(0, target - now.value)
  const days = Math.floor(diff / 86_400_000)
  diff -= days * 86_400_000
  const hours = Math.floor(diff / 3_600_000)
  diff -= hours * 3_600_000
  const minutes = Math.floor(diff / 60_000)
  diff -= minutes * 60_000
  const seconds = Math.floor(diff / 1_000)

  return [
    { unit: 'D', value: days },
    { unit: 'H', value: hours },
    { unit: 'M', value: minutes },
    { unit: 'S', value: seconds },
  ]
})

function pad(value: number) {
  return String(value).padStart(2, '0')
}

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (timer !== undefined) {
    window.clearInterval(timer)
  }
})
</script>

<template>
  <div style="position: relative">
    <span class="cd__label">{{ label }}</span>
    <div class="cd__time">
      <div v-for="segment in segments" :key="segment.unit" class="cd__seg">
        <b>{{ pad(segment.value) }}</b>
        <span>{{ segment.unit }}</span>
      </div>
    </div>
  </div>
  <div class="cd__when">
    <span>设置提醒</span>
    <span class="dim">{{ when }}</span>
  </div>
</template>
