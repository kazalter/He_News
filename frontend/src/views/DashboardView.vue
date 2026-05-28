<script setup lang="ts">
import { computed, onMounted } from 'vue'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { Bell, Moon, Refresh, Sunny } from '@element-plus/icons-vue'
import CodesTable from '../components/dashboard/CodesTable.vue'
import FeedList from '../components/dashboard/FeedList.vue'
import HeroAnnouncement from '../components/dashboard/HeroAnnouncement.vue'
import IconBtn from '../components/ui/IconBtn.vue'
import LinkBtn from '../components/ui/LinkBtn.vue'
import SearchBox from '../components/ui/SearchBox.vue'
import QuietTag from '../components/ui/Tag.vue'
import GameTag from '../components/ui/GameTag.vue'
import type { CodeTableRow, FeedListItem } from '../components/dashboard/types'
import { useTheme } from '../composables/useTheme'
import { useNewsStore } from '../stores/news'
import { useUiStore } from '../stores/ui'
import {
  gameColor,
  gameShortName,
  resolveGameKey,
} from '../utils/gameMeta'
import type { RedeemCode } from '../types'

const store = useNewsStore()
const ui = useUiStore()
const { theme, toggleTheme } = useTheme()

const categoryLabels: Record<string, string> = {
  redeem_code: '兑换码',
  preview: '前瞻',
  update: '版本更新',
  maintenance: '维护',
  event: '活动',
  announcement: '资讯',
  guide: '攻略',
  other: '其他',
}

const feedTabs = [
  { label: '全部', value: 'all' },
  { label: '版本更新', value: 'update' },
  { label: '活动 / 卡池', value: 'event' },
  { label: '维护补偿', value: 'maintenance' },
]

const weekday = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const displayGames = computed(() => store.games)
const displayArticles = computed(() => store.articles)
const displayCodes = computed(() => store.codes)

const greeting = computed(() => {
  const hour = dayjs().hour()
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

const eyebrow = computed(() => {
  const now = dayjs()
  return `DASHBOARD · ${weekday[now.day()]} ${now.format('MM.DD')}`
})

const focusCount = computed(() => {
  return Math.max(store.unreadCount, 0)
})

const articleCountByGame = computed(() => {
  const map = new Map<string, number>()
  for (const article of displayArticles.value) {
    const key = resolveGameKey(article.game)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
})

const gameChips = computed(() => {
  const seen = new Set<string>()
  return displayGames.value
    .map((game) => {
      const key = resolveGameKey(game)
      return {
        key,
        name: gameShortName(game),
        color: gameColor(game),
        count: articleCountByGame.value.get(key) ?? game._count?.articles ?? 0,
      }
    })
    .filter((chip) => {
      if (chip.key === 'other' || seen.has(chip.key)) {
        return false
      }
      seen.add(chip.key)
      return true
    })
})

const totalArticles = computed(() => store.articleTotal || displayArticles.value.length)

const heroArticle = computed(() => displayArticles.value.find((article) => !article.isRead) ?? displayArticles.value[0])

const heroStats = computed(() => ({
  articles: totalArticles.value,
  codes: displayCodes.value.length,
  sources: store.sources.length,
}))

const codeRows = computed<CodeTableRow[]>(() =>
  displayCodes.value.map((code) => {
    const game = code.game ?? displayGames.value.find((item) => item.id === code.gameId)
    return {
      id: code.id,
      code: code.code,
      gameName: gameShortName(game),
      gameKey: resolveGameKey(game),
      gameColor: gameColor(game),
      rewards: parseRewards(code),
      expires: formatCodeExpiry(code.expiredAt),
      status: resolveCodeStatus(code),
    }
  }),
)

const featured = computed(() => {
  const articles = displayArticles.value.slice(0, 2)
  return articles.map((article) => {
    const game = article.game
    return {
      id: article.id,
      title: article.title,
      summary: article.summary || '官方动态已同步，建议进入原文查看完整内容。',
      url: article.url,
      gameName: gameShortName(game),
      gameKey: resolveGameKey(game),
      gameColor: gameColor(game),
      category: categoryLabels[article.category] ?? article.category,
      foot: `${article.source?.name ?? '官方'} · ${relativeTime(article.publishedAt ?? article.createdAt)}`,
    }
  })
})

const lastSyncLabel = computed(() => {
  const times = [
    ...store.sources.map((source) => source.lastCrawledAt),
    ...store.logs.map((log) => log.finishedAt ?? log.startedAt),
  ].filter((value): value is string => Boolean(value))

  if (!times.length) {
    return '尚未同步'
  }

  const latest = times.sort((a, b) => dayjs(b).valueOf() - dayjs(a).valueOf())[0]
  return relativeTime(latest)
})

const feedItems = computed<FeedListItem[]>(() => {
  const search = ui.search.trim().toLowerCase()
  const filtered = displayArticles.value.filter((article) => {
    const haystack = `${article.title} ${article.summary ?? ''} ${article.game?.name ?? ''}`.toLowerCase()
    const searchMatched = !search || haystack.includes(search)
    const tabMatched = ui.feedTab === 'all' || article.category === ui.feedTab
    return searchMatched && tabMatched
  })

  const rows: FeedListItem[] = []
  let lastDay = ''

  for (const article of filtered) {
    const date = dayjs(article.publishedAt ?? article.createdAt)
    const dayKey = date.format('YYYY-MM-DD')
    const today = dayjs().format('YYYY-MM-DD')
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
    const separator = dayKey === today ? '' : dayKey === yesterday ? `YESTERDAY · ${date.format('MM.DD')}` : date.format('MMM DD · MM.DD').toUpperCase()

    if (separator && separator !== lastDay) {
      rows.push({ kind: 'separator', id: `sep-${dayKey}`, label: separator })
      lastDay = separator
    }

    const game = article.game
    rows.push({
      kind: 'row',
      id: article.id,
      time: date.format('HH:mm'),
      gameName: gameShortName(game),
      gameKey: resolveGameKey(game),
      gameColor: gameColor(game),
      title: article.title,
      tag: categoryLabels[article.category] ?? article.category,
      href: article.url,
    })
  }

  return rows
})

onMounted(async () => {
  await run(store.bootstrap(), true)
})

function selectGame(key: string) {
  ui.setSelectedGame(key)
}

function isDimmed(gameKey: string) {
  return ui.selectedGame !== 'all' && ui.selectedGame !== gameKey
}

function parseRewards(code: RedeemCode) {
  const text = code.description || code.article?.title || '官方兑换奖励'
  return text
    .split(/[·、，,]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3)
}

function formatCodeExpiry(value?: string | null) {
  return value ? dayjs(value).format('MM.DD') : '-'
}

function resolveCodeStatus(code: RedeemCode) {
  if (code.status === 'expired') return 'expired'
  if (code.status === 'used') return 'used'
  if (code.expiredAt && dayjs(code.expiredAt).diff(dayjs(), 'day') <= 3) return 'urgent'
  return 'available'
}

function relativeTime(value?: string | null) {
  if (!value) return '刚刚'
  const minutes = Math.max(1, dayjs().diff(dayjs(value), 'minute'))
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

async function refreshAll() {
  await run(store.bootstrap())
}

async function run(task: Promise<unknown>, silent = false) {
  store.loading = true
  try {
    await task
  } catch (error) {
    if (!silent) {
      ElMessage.error(error instanceof Error ? error.message : '请求失败，无法加载内容')
    }
  } finally {
    store.loading = false
  }
}
</script>

<template>
  <div class="app-page dashboard-page">
    <header class="topbar">
      <div class="topbar__title">
        <span class="topbar__eyebrow">{{ eyebrow }}</span>
        <span class="topbar__heading">
          {{ greeting }}，<em>管理员</em>。
          <b>{{ focusCount }}</b>
          条新动态需要关注。
        </span>
      </div>
      <div class="topbar__right">
        <SearchBox v-model="ui.search" />
        <IconBtn title="切换主题" @click="toggleTheme">
          <Moon v-if="theme === 'dark'" class="themeicon themeicon--dark" />
          <Sunny v-else class="themeicon themeicon--light" />
        </IconBtn>
        <IconBtn title="通知" dot>
          <Bell />
        </IconBtn>
        <IconBtn title="刷新" :active="store.loading" @click="refreshAll">
          <Refresh />
        </IconBtn>
      </div>
    </header>

    <nav class="filterbar" aria-label="游戏筛选">
      <button class="chip" :class="{ 'is-active': ui.selectedGame === 'all' }" type="button" data-game="all" @click="selectGame('all')">
        <span class="chip__dot" />
        全部
        <em>{{ totalArticles }}</em>
      </button>
      <div class="filterbar__divider" />
      <button
        v-for="game in gameChips"
        :key="game.key"
        class="chip"
        :class="{ 'is-active': ui.selectedGame === game.key }"
        type="button"
        :data-game="game.key"
        @click="selectGame(game.key)"
      >
        <span class="chip__dot" :style="{ '--c': game.color }" />
        {{ game.name }}
        <em>{{ game.count }}</em>
      </button>
    </nav>

    <HeroAnnouncement
      :class="{ 'is-dimmed': heroArticle ? isDimmed(resolveGameKey(heroArticle.game)) : false }"
      :title="heroArticle?.title"
      :summary="heroArticle?.summary ?? undefined"
      :game-name="heroArticle ? gameShortName(heroArticle.game) : undefined"
      :game-key="heroArticle ? resolveGameKey(heroArticle.game) : undefined"
      :game-color="heroArticle ? gameColor(heroArticle.game) : undefined"
      :category="heroArticle ? categoryLabels[heroArticle.category] ?? heroArticle.category : undefined"
      :source-name="heroArticle?.source?.name"
      :published-at="heroArticle ? dayjs(heroArticle.publishedAt ?? heroArticle.createdAt).format('MM.DD HH:mm') : undefined"
      :href="heroArticle?.url"
      :stats="heroStats"
    />

    <CodesTable :rows="codeRows" :selected-game="ui.selectedGame" />

    <section class="section">
      <header class="section__head">
        <h3 class="section__title">
          今日重点
          <span class="section__count">{{ featured.length }}</span>
        </h3>
        <div class="section__right">
          <span class="linkbtn" style="cursor: default">{{ dayjs().format('MM.DD dddd') }}</span>
        </div>
      </header>

      <div class="featured">
        <article
          v-for="item in featured"
          :key="item.id"
          class="featured__cell"
          :class="{ 'is-dimmed': isDimmed(item.gameKey) }"
          :style="{ '--c': item.gameColor }"
          :data-game="item.gameKey"
        >
          <div class="featured__tags">
            <GameTag :name="item.gameName" :color="item.gameColor" />
            <QuietTag :tone="item.category === '活动' ? 'accent' : 'default'">{{ item.category }}</QuietTag>
          </div>
          <h4 class="featured__title">{{ item.title }}</h4>
          <p class="featured__desc">{{ item.summary }}</p>
          <div class="featured__foot">
            <span>{{ item.foot }}</span>
            <a :href="item.url" target="_blank" rel="noopener noreferrer">阅读 →</a>
          </div>
        </article>
        <div v-if="!featured.length" class="empty-state">还没有可展示的重点动态。</div>
      </div>
    </section>

    <section class="section">
      <header class="section__head">
        <h3 class="section__title">
          最新动态
          <span class="section__count">{{ feedItems.filter((item) => item.kind === 'row').length }}</span>
        </h3>
        <div class="section__right">
          <div class="tabs">
            <LinkBtn
              v-for="tab in feedTabs"
              :key="tab.value"
              class="tab"
              :active="ui.feedTab === tab.value"
              @click="ui.setFeedTab(tab.value)"
            >
              {{ tab.label }}
            </LinkBtn>
          </div>
        </div>
      </header>

      <FeedList v-if="feedItems.length" :items="feedItems" :selected-game="ui.selectedGame" />
      <div v-else class="empty-state">还没有资讯。请先在“游戏”和“来源”页添加数据源并执行抓取。</div>
    </section>

    <footer class="footnote">
      <span>HE News · 数据来自各游戏官方账号</span>
      <span>最后同步 <a href="#" @click.prevent="refreshAll">{{ store.loading ? '同步中' : lastSyncLabel }}</a></span>
    </footer>
  </div>
</template>

<style scoped>
.dashboard-page {
  gap: 40px;
}
</style>
