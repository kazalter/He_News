<script setup lang="ts">
import { ArrowRight } from '@element-plus/icons-vue'
import DaySeparator from './DaySeparator.vue'
import GameTag from '../ui/GameTag.vue'
import type { FeedListItem } from './types'

const props = withDefaults(
  defineProps<{
    items: FeedListItem[]
    selectedGame?: string
  }>(),
  {
    selectedGame: 'all',
  },
)

function isDimmed(gameKey: string) {
  return props.selectedGame !== 'all' && props.selectedGame !== gameKey
}
</script>

<template>
  <div class="feedlist">
    <template v-for="item in items" :key="item.id">
      <DaySeparator v-if="item.kind === 'separator'" :label="item.label" />
      <a
        v-else
        class="feedrow"
        :class="{ 'is-dimmed': isDimmed(item.gameKey) }"
        :href="item.href"
        :data-game="item.gameKey"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span class="feedrow__time">{{ item.time }}</span>
        <GameTag :name="item.gameName" :color="item.gameColor" />
        <span class="feedrow__title">{{ item.title }}</span>
        <span class="feedrow__tag">{{ item.tag }}</span>
        <ArrowRight class="feedrow__arrow" />
      </a>
    </template>
  </div>
</template>
