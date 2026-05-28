<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import CodesTable from '../components/dashboard/CodesTable.vue'
import LinkBtn from '../components/ui/LinkBtn.vue'
import { useNewsStore } from '../stores/news'
import { useUiStore } from '../stores/ui'
import { gameColor, gameShortName, resolveGameKey } from '../utils/gameMeta'
import type { CodeTableRow } from '../components/dashboard/types'
import type { RedeemCode } from '../types'

const store = useNewsStore()
const ui = useUiStore()
const selectedStatus = ref('all')

const statusTabs = [
  { label: '全部', value: 'all' },
  { label: '可用', value: 'available' },
  { label: '即将过期', value: 'urgent' },
  { label: '已兑换', value: 'used' },
  { label: '已过期', value: 'expired' },
]

const displayGames = computed(() => store.games)
const displayCodes = computed(() => store.codes)

const gameChips = computed(() =>
  displayGames.value.map((game) => ({
    key: resolveGameKey(game),
    name: gameShortName(game),
    color: gameColor(game),
  })),
)

const allRows = computed<CodeTableRow[]>(() =>
  displayCodes.value.map((code) => {
    const game = code.game ?? displayGames.value.find((item) => item.id === code.gameId)
    return {
      id: code.id,
      code: code.code,
      gameName: gameShortName(game),
      gameKey: resolveGameKey(game),
      gameColor: gameColor(game),
      rewards: parseRewards(code),
      expires: code.expiredAt ? dayjs(code.expiredAt).format('MM.DD') : '-',
      status: resolveCodeStatus(code),
    }
  }),
)

const rows = computed(() => {
  if (selectedStatus.value === 'all') {
    return allRows.value
  }

  return allRows.value.filter((row) => row.status === selectedStatus.value)
})

const counts = computed(() => ({
  available: allRows.value.filter((row) => row.status === 'available').length,
  urgent: allRows.value.filter((row) => row.status === 'urgent').length,
  used: allRows.value.filter((row) => row.status === 'used').length,
  expired: allRows.value.filter((row) => row.status === 'expired').length,
}))

onMounted(async () => {
  await run(Promise.all([store.loadGames(), store.loadCodes()]), true)
})

function selectGame(key: string) {
  ui.setSelectedGame(key)
}

function parseRewards(code: RedeemCode) {
  const text = code.description || code.article?.title || '官方兑换奖励'
  return text
    .split(/[·、，,]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3)
}

function resolveCodeStatus(code: RedeemCode) {
  if (code.status === 'expired') return 'expired'
  if (code.status === 'used') return 'used'
  if (code.expiredAt && dayjs(code.expiredAt).diff(dayjs(), 'day') <= 3) return 'urgent'
  return 'available'
}

async function refresh() {
  await run(Promise.all([store.loadGames(), store.loadCodes()]))
}

async function run(task: Promise<unknown>, silent = false) {
  store.loading = true
  try {
    await task
  } catch (error) {
    if (!silent) {
      ElMessage.error(error instanceof Error ? error.message : '请求失败，无法加载兑换码')
    }
  } finally {
    store.loading = false
  }
}
</script>

<template>
  <main class="app-page">
    <header class="page-header">
      <div>
        <h1 class="page-title">兑换码</h1>
        <p class="page-subtitle">集中查看、复制和回溯各游戏官方兑换码。</p>
      </div>
      <div class="page-actions">
        <LinkBtn @click="refresh">
          刷新
          <Refresh />
        </LinkBtn>
      </div>
    </header>

    <section class="metric-grid">
      <div class="metric">
        <span>Available</span>
        <strong>{{ counts.available }}</strong>
      </div>
      <div class="metric">
        <span>Urgent</span>
        <strong>{{ counts.urgent }}</strong>
      </div>
      <div class="metric">
        <span>Redeemed</span>
        <strong>{{ counts.used }}</strong>
      </div>
      <div class="metric">
        <span>Expired</span>
        <strong>{{ counts.expired }}</strong>
      </div>
    </section>

    <nav class="filterbar" aria-label="游戏筛选">
      <button class="chip" :class="{ 'is-active': ui.selectedGame === 'all' }" type="button" @click="selectGame('all')">
        <span class="chip__dot" />
        全部
        <em>{{ allRows.length }}</em>
      </button>
      <div class="filterbar__divider" />
      <button
        v-for="game in gameChips"
        :key="game.key"
        class="chip"
        :class="{ 'is-active': ui.selectedGame === game.key }"
        type="button"
        @click="selectGame(game.key)"
      >
        <span class="chip__dot" :style="{ '--c': game.color }" />
        {{ game.name }}
      </button>
    </nav>

    <div class="tabs">
      <LinkBtn v-for="tab in statusTabs" :key="tab.value" class="tab" :active="selectedStatus === tab.value" @click="selectedStatus = tab.value">
        {{ tab.label }}
      </LinkBtn>
    </div>

    <CodesTable title="兑换码列表" :rows="rows" :selected-game="ui.selectedGame" />
  </main>
</template>
