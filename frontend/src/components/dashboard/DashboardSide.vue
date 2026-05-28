<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import { RouterLink } from 'vue-router'
import { useNewsStore } from '../../stores/news'
import { useUiStore } from '../../stores/ui'
import {
  gameColor,
  gameShortName,
  matchesGameFilter,
  resolveGameKey,
} from '../../utils/gameMeta'

const store = useNewsStore()
const ui = useUiStore()

const games = computed(() => store.games)
const sources = computed(() => store.sources)

const onlineSources = computed(() => sources.value.filter((source) => source.enabled).length)

const trends = computed(() => {
  const since = dayjs().subtract(24, 'hour')
  const counts = new Map<string, number>()

  for (const article of store.articles) {
    const date = dayjs(article.publishedAt ?? article.createdAt)
    if (date.isBefore(since)) {
      continue
    }

    const label = article.category && article.category !== 'other' ? article.category : gameShortName(article.game)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag: `#${tag}`, count }))
})

function badgeCount(slug: string) {
  const game = games.value.find((item) => item.slug === slug)
  return game?._count?.articles ?? 0
}

function sourceState(enabled: boolean, lastCrawledAt?: string | null) {
  if (!enabled) return ''
  if (!lastCrawledAt) return 'warn'
  return dayjs().diff(dayjs(lastCrawledAt), 'minute') > 15 ? 'warn' : 'ok'
}

function sourceWhen(lastCrawledAt?: string | null) {
  if (!lastCrawledAt) return '未连接'
  const minutes = Math.max(1, dayjs().diff(dayjs(lastCrawledAt), 'minute'))
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h`
}

function isDimmed(slug: string) {
  const game = games.value.find((item) => item.slug === slug)
  return !matchesGameFilter(game, ui.selectedGame)
}
</script>

<template>
  <aside class="side">
    <section class="panel" id="games">
      <header class="panel__head">
        <h4 class="panel__title">我的游戏 <span class="muted">{{ games.length }}</span></h4>
        <RouterLink class="panel__more" to="/games">管理</RouterLink>
      </header>
      <ul v-if="games.length" class="games">
        <li
          v-for="game in games.slice(0, 6)"
          :key="game.id"
          class="gameitem"
          :class="{ 'is-dimmed': isDimmed(game.slug) }"
          :style="{ '--c': gameColor(game) }"
          :data-game="resolveGameKey(game)"
        >
          <div>
            <div class="gameitem__name">
              {{ gameShortName(game) }}
              <span class="ver">{{ game.slug }}</span>
            </div>
            <div class="gameitem__sub">{{ game._count?.sources ?? 0 }} 来源 · {{ game._count?.redeemCodes ?? 0 }} 兑换码</div>
          </div>
          <span class="gameitem__badge" :class="{ 'gameitem__badge--hot': resolveGameKey(game) === 'hsr' }">
            {{ badgeCount(game.slug) }}
          </span>
        </li>
      </ul>
      <div v-else class="empty-state">还没有添加游戏。</div>
    </section>

    <section class="panel">
      <header class="panel__head">
        <h4 class="panel__title">热度趋势 <span class="muted">24h</span></h4>
        <button class="panel__more" type="button">查看</button>
      </header>
      <ol v-if="trends.length" class="trend">
        <li v-for="(trend, index) in trends" :key="trend.tag" class="trenditem">
          <span class="trenditem__rank">{{ String(index + 1).padStart(2, '0') }}</span>
          <span class="trenditem__tag">{{ trend.tag }}</span>
          <span class="trenditem__num">{{ trend.count }}</span>
          <span class="trenditem__delta up">+{{ trend.count }}</span>
        </li>
      </ol>
      <div v-else class="empty-state">24 小时内暂无动态。</div>
    </section>

    <section class="panel">
      <header class="panel__head">
        <h4 class="panel__title">数据源 <span class="muted">{{ onlineSources }} / {{ sources.length }} 在线</span></h4>
        <RouterLink class="panel__more" to="/sources">+</RouterLink>
      </header>
      <ul v-if="sources.length" class="srclist">
        <li
          v-for="source in sources.slice(0, 6)"
          :key="source.id"
          class="srcitem"
          :class="sourceState(source.enabled, source.lastCrawledAt)"
        >
          <span class="dot" />
          {{ source.name }}
          <span class="when">{{ sourceWhen(source.lastCrawledAt) }}</span>
        </li>
      </ul>
      <div v-else class="empty-state">还没有配置数据源。</div>
    </section>
  </aside>
</template>
