<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Star } from '@element-plus/icons-vue'
import GameTag from '../components/ui/GameTag.vue'
import LinkBtn from '../components/ui/LinkBtn.vue'
import QuietTag from '../components/ui/Tag.vue'
import { useNewsStore } from '../stores/news'
import { gameColor, gameShortName, weaponLabel } from '../utils/gameMeta'

const store = useNewsStore()
const selectedVersion = ref<string | null>(null)

const plans = computed(() => store.versionPlans)
const activePlan = computed(() => {
  if (!plans.value.length) {
    return undefined
  }
  if (!selectedVersion.value) {
    return plans.value[0]
  }
  return plans.value.find((plan) => `${plan.gameId}:${plan.version}` === selectedVersion.value) ?? plans.value[0]
})

const phases = computed(() => {
  if (!activePlan.value) {
    return []
  }
  const groups = new Map<number, typeof activePlan.value.banners>()
  for (const banner of activePlan.value.banners) {
    const group = groups.get(banner.phase) ?? []
    group.push(banner)
    groups.set(banner.phase, group)
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([phase, banners]) => ({ phase, banners }))
})

const eventGroups = computed(() => {
  if (!activePlan.value) {
    return { event: [], story: [], other: [], character: [] }
  }
  const buckets = { event: [], story: [], other: [], character: [] } as Record<
    'event' | 'story' | 'other' | 'character',
    typeof activePlan.value.events
  >
  for (const event of activePlan.value.events) {
    const key = (event.category as 'event' | 'story' | 'other' | 'character') in buckets
      ? (event.category as 'event' | 'story' | 'other' | 'character')
      : 'other'
    buckets[key].push(event)
  }
  return buckets
})

watch(plans, (next) => {
  if (!selectedVersion.value && next.length) {
    selectedVersion.value = `${next[0].gameId}:${next[0].version}`
  }
}, { immediate: true })

onMounted(async () => {
  await run(Promise.all([store.loadGames(), store.loadVersionPlans()]), true)
})

async function refresh() {
  await run(store.loadVersionPlans())
}

async function run(task: Promise<unknown>, silent = false) {
  store.loading = true
  try {
    await task
  } catch (error) {
    if (!silent) {
      ElMessage.error(error instanceof Error ? error.message : '请求失败，无法加载版本计划')
    }
  } finally {
    store.loading = false
  }
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}/${m}/${d} ${hh}:${mm}`
}

function formatBannerTime(startAt?: string | null, endAt?: string | null, raw?: string | null) {
  const start = formatDateTime(startAt)
  const end = formatDateTime(endAt)
  if (start && end) {
    return `${start} - ${end}`
  }
  if (end) {
    return `版本开服 - ${end}`
  }
  return raw ?? '时间待定'
}
</script>

<template>
  <main class="app-page">
    <header class="page-header">
      <div>
        <h1 class="page-title">版本计划</h1>
        <p class="page-subtitle">
          从官方专题 / 资讯 API 同步：版本号 / 上线时间 / 卡池 / 新角色 / 新武器（光锥·音擎）/ 活动。
          在「来源管理」里挂 <code>mihoyo · 版本前瞻专题</code> 或 <code>绝区零版本（新闻 API）</code>，抓取即可。
        </p>
      </div>
      <div class="page-actions">
        <LinkBtn @click="refresh">
          刷新
          <Refresh />
        </LinkBtn>
      </div>
    </header>

    <template v-if="activePlan">
      <section v-if="plans.length > 1" class="version-tabs">
        <button
          v-for="plan in plans"
          :key="`${plan.gameId}:${plan.version}`"
          type="button"
          class="version-tab"
          :class="{ 'is-active': `${plan.gameId}:${plan.version}` === `${activePlan.gameId}:${activePlan.version}` }"
          @click="selectedVersion = `${plan.gameId}:${plan.version}`"
        >
          <em>{{ gameShortName(plan.game) }}</em>
          <span>{{ plan.version }}</span>
          <small v-if="plan.subtitle">「{{ plan.subtitle }}」</small>
        </button>
      </section>

      <section class="surface-panel version-hero">
        <div class="version-hero__copy">
          <div class="version-hero__tags">
            <GameTag :name="gameShortName(activePlan.game)" :color="gameColor(activePlan.game)" />
            <QuietTag tone="accent">{{ activePlan.version }} 版本</QuietTag>
          </div>
          <h2 v-if="activePlan.subtitle">「{{ activePlan.subtitle }}」</h2>
          <h2 v-else>{{ activePlan.version }} 版本计划</h2>
          <dl class="version-hero__meta">
            <div>
              <dt>上线时间</dt>
              <dd>{{ formatDateTime(activePlan.releaseAt) ?? '待官方公告' }}</dd>
            </div>
            <div v-if="activePlan.banners.length">
              <dt>卡池</dt>
              <dd>{{ activePlan.banners.length }}</dd>
            </div>
            <div v-else>
              <dt>新角色</dt>
              <dd>{{ eventGroups.character.length }}</dd>
            </div>
            <div>
              <dt>活动</dt>
              <dd>{{ activePlan.events.length }}</dd>
            </div>
            <div>
              <dt>同步时间</dt>
              <dd>{{ formatDateTime(activePlan.lastSyncedAt) ?? '—' }}</dd>
            </div>
          </dl>
          <div class="version-hero__links">
            <a v-if="activePlan.officialUrl" :href="activePlan.officialUrl" target="_blank" rel="noopener noreferrer">
              专题落地页
            </a>
            <a v-if="activePlan.providerUrl" :href="activePlan.providerUrl" target="_blank" rel="noopener noreferrer">
              原始数据 JSON
            </a>
          </div>
        </div>
        <div v-if="activePlan.coverUrl" class="version-hero__cover">
          <img :src="activePlan.coverUrl" :alt="activePlan.subtitle ?? activePlan.version" loading="lazy">
        </div>
      </section>

      <section v-if="eventGroups.character.length" class="surface-panel">
        <div class="panel-title">新角色</div>
        <div class="character-grid">
          <article
            v-for="character in eventGroups.character"
            :key="character.id"
            class="character-card"
            :style="{ '--c': gameColor(activePlan.game) }"
          >
            <div class="character-card__head">
              <span class="character-card__name">{{ character.name }}</span>
              <em class="badge-new">
                <Star /> 新角色
              </em>
            </div>
            <div v-if="character.label" class="character-card__faction">{{ character.label }}</div>
          </article>
        </div>
      </section>

      <section v-for="phase in phases" :key="phase.phase" class="surface-panel">
        <div class="panel-title">
          第 {{ phase.phase }} 期卡池
        </div>
        <div class="banner-grid">
          <article
            v-for="banner in phase.banners"
            :key="banner.id"
            class="banner-card"
            :style="{ '--c': gameColor(activePlan.game) }"
          >
            <div class="banner-card__head">
              <span class="banner-card__phase">{{ banner.poolName ?? `第 ${banner.phase} 期` }}</span>
              <span class="banner-card__time">{{ formatBannerTime(banner.startAt, banner.endAt, banner.rawTime) }}</span>
            </div>
            <div class="banner-card__row">
              <div class="banner-card__label">
                <span>角色</span>
                <em v-if="banner.isNewCharacter" class="badge-new">
                  <Star /> 新角色
                </em>
              </div>
              <strong v-if="banner.characterName">
                {{ banner.characterName }}
                <small v-if="banner.characterRarity">{{ banner.characterRarity }}★</small>
              </strong>
              <strong v-else class="banner-card__empty">—</strong>
              <div v-if="banner.characterPath || banner.characterElement" class="banner-card__tags">
                <span v-if="banner.characterPath">{{ banner.characterPath }}</span>
                <span v-if="banner.characterElement">{{ banner.characterElement }}</span>
              </div>
            </div>
            <div class="banner-card__row">
              <div class="banner-card__label">
                <span>{{ weaponLabel(activePlan.game) }}</span>
                <em v-if="banner.isNewLightCone" class="badge-new">
                  <Star /> 新{{ weaponLabel(activePlan.game) }}
                </em>
              </div>
              <strong v-if="banner.lightConeName">
                {{ banner.lightConeName }}
                <small v-if="banner.lightConeRarity">{{ banner.lightConeRarity }}★</small>
              </strong>
              <strong v-else class="banner-card__empty">—</strong>
            </div>
          </article>
        </div>
      </section>

      <section v-if="eventGroups.event.length" class="surface-panel">
        <div class="panel-title">活动 & 玩法</div>
        <div class="event-grid">
          <article v-for="event in eventGroups.event" :key="event.id" class="event-card">
            <strong>{{ event.name }}</strong>
            <p v-if="event.info">{{ event.info }}</p>
          </article>
        </div>
      </section>

      <section v-if="eventGroups.other.length" class="surface-panel">
        <div class="panel-title">其他更新</div>
        <div class="manage-list">
          <div v-for="event in eventGroups.other" :key="event.id" class="manage-row">
            <div class="manage-row__main">
              <div class="manage-row__title">{{ event.name }}</div>
              <div v-if="event.info" class="manage-row__sub">{{ event.info }}</div>
            </div>
            <span v-if="event.label" class="tag">{{ event.label }}</span>
          </div>
        </div>
      </section>

      <section v-if="eventGroups.story.length" class="surface-panel">
        <div class="panel-title">剧情</div>
        <div class="manage-list">
          <div v-for="event in eventGroups.story" :key="event.id" class="manage-row">
            <div class="manage-row__main">
              <div class="manage-row__title">{{ event.name }}</div>
              <div v-if="event.info" class="manage-row__sub">{{ event.info }}</div>
            </div>
            <span v-if="event.label" class="tag">{{ event.label }}</span>
          </div>
        </div>
      </section>
    </template>

    <section v-else class="surface-panel">
      <div class="empty-state">
        还没有版本计划。去「来源管理」用 <code>mihoyo · 版本前瞻专题</code> 类型添加官方专题落地页（如
        <code>https://act.mihoyo.com/puzzle/hkrpg/eXXXXXX/index.html</code>），抓取一次即可。
      </div>
    </section>
  </main>
</template>

<style scoped>
code {
  padding: 1px 6px;
  color: var(--ink-1);
  background: var(--surface-hi);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
}

.version-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.version-tab {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  padding: 8px 14px;
  color: var(--ink-2);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}

.version-tab em {
  color: var(--ink-3);
  font-style: normal;
  font-size: 11px;
}

.version-tab span {
  font-family: var(--font-mono);
  font-size: 14px;
}

.version-tab small {
  color: var(--ink-3);
  font-size: 11px;
}

.version-tab:hover {
  color: var(--ink-1);
  background: var(--surface-hi);
}

.version-tab.is-active {
  color: var(--ink-1);
  background: var(--surface-active);
  border-color: var(--border-strong);
}

.version-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(240px, 1fr);
  gap: 24px;
  align-items: stretch;
}

.version-hero__copy {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.version-hero__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.version-hero h2 {
  margin: 4px 0 0;
  color: var(--ink-1);
  font-size: 26px;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.2;
}

.version-hero__meta {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  margin: 6px 0 0;
  overflow: hidden;
  background: var(--surface-hi);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.version-hero__meta > div {
  padding: 12px 14px;
  border-left: 1px solid var(--border);
}

.version-hero__meta > div:first-child {
  border-left: 0;
}

.version-hero__meta dt {
  margin: 0;
  color: var(--ink-3);
  font-family: var(--font-mono);
  font-size: 10.5px;
}

.version-hero__meta dd {
  margin: 6px 0 0;
  color: var(--ink-1);
  font-size: 14px;
  font-weight: 500;
}

.version-hero__links {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  font-size: 12px;
}

.version-hero__links a {
  color: var(--ink-2);
  border-bottom: 1px dashed var(--border-em);
  transition: color 0.15s ease, border-color 0.15s ease;
}

.version-hero__links a:hover {
  color: var(--ink-1);
  border-color: var(--ink-2);
}

.version-hero__cover {
  overflow: hidden;
  background: var(--surface-hi);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.version-hero__cover img {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 180px;
  object-fit: cover;
}

.panel-title {
  margin-bottom: 14px;
  color: var(--ink-1);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0;
}

.banner-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.banner-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
  background: var(--surface-hi);
  border: 1px solid var(--border);
  border-left: 2px solid var(--c, var(--accent));
  border-radius: var(--radius-sm);
}

.banner-card__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.banner-card__phase {
  color: var(--ink-1);
  font-size: 12px;
  font-weight: 600;
}

.banner-card__time {
  color: var(--ink-3);
  font-family: var(--font-mono);
  font-size: 11px;
}

.banner-card__row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.banner-card__label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--ink-3);
  font-family: var(--font-mono);
  font-size: 10.5px;
}

.badge-new {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px;
  color: var(--gold);
  background: rgba(201, 168, 116, 0.12);
  border: 1px solid rgba(201, 168, 116, 0.3);
  border-radius: var(--radius-pill);
  font-family: var(--font-sans);
  font-size: 10px;
  font-style: normal;
  font-weight: 600;
}

.badge-new svg {
  width: 10px;
  height: 10px;
}

.banner-card__row strong {
  color: var(--ink-1);
  font-size: 16px;
  font-weight: 600;
}

.banner-card__row strong small {
  margin-left: 6px;
  color: var(--gold);
  font-family: var(--font-mono);
  font-size: 11px;
}

.banner-card__empty {
  color: var(--ink-3);
  font-weight: 400;
}

.banner-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
}

.banner-card__tags span {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  color: var(--ink-2);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  font-size: 11px;
}

.character-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.character-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  background: var(--surface-hi);
  border: 1px solid var(--border);
  border-left: 2px solid var(--c, var(--accent));
  border-radius: var(--radius-sm);
}

.character-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.character-card__name {
  color: var(--ink-1);
  font-size: 16px;
  font-weight: 600;
}

.character-card__faction {
  color: var(--ink-3);
  font-family: var(--font-mono);
  font-size: 11px;
}

.event-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.event-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  background: var(--surface-hi);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.event-card strong {
  color: var(--ink-1);
  font-size: 14px;
  font-weight: 600;
}

.event-card p {
  margin: 0;
  color: var(--ink-2);
  font-size: 12px;
  line-height: 1.6;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
}

@media (max-width: 900px) {
  .version-hero {
    grid-template-columns: 1fr;
  }

  .version-hero__meta {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
