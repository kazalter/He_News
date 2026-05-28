<script setup lang="ts">
import { computed, onMounted } from 'vue'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import LinkBtn from '../components/ui/LinkBtn.vue'
import { useNewsStore } from '../stores/news'
import { gameColor, gameShortName } from '../utils/gameMeta'

const store = useNewsStore()

const events = computed(() => {
  const codeEvents = store.codes
    .filter((code) => code.expiredAt)
    .map((code) => ({
      id: `code-${code.id}`,
      date: dayjs(code.expiredAt).format('MM.DD'),
      time: dayjs(code.expiredAt).format('HH:mm'),
      color: gameColor(code.game),
      game: gameShortName(code.game),
      title: `${code.code} 兑换码截止`,
    }))

  const previewEvents = store.articles
    .filter((article) => ['preview', 'event', 'maintenance'].includes(article.category))
    .map((article) => ({
      id: `article-${article.id}`,
      date: dayjs(article.publishedAt ?? article.createdAt).format('MM.DD'),
      time: dayjs(article.publishedAt ?? article.createdAt).format('HH:mm'),
      color: gameColor(article.game),
      game: gameShortName(article.game),
      title: article.title,
    }))

  return [...codeEvents, ...previewEvents].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
})

onMounted(async () => {
  await run(Promise.all([store.loadArticles(), store.loadCodes()]), true)
})

async function refresh() {
  await run(Promise.all([store.loadArticles(), store.loadCodes()]))
}

async function run(task: Promise<unknown>, silent = false) {
  store.loading = true
  try {
    await task
  } catch (error) {
    if (!silent) {
      ElMessage.error(error instanceof Error ? error.message : '请求失败，无法加载日历')
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
        <h1 class="page-title">活动日历</h1>
        <p class="page-subtitle">根据真实资讯分类和兑换码截止时间自动生成。</p>
      </div>
      <LinkBtn @click="refresh">
        刷新
        <Refresh />
      </LinkBtn>
    </header>

    <section class="surface-panel">
      <div v-if="events.length" class="manage-list">
        <article v-for="event in events" :key="event.id" class="manage-row">
          <div class="manage-row__main">
            <div class="manage-row__title" :style="{ '--c': event.color }">
              <span class="dot" />
              {{ event.title }}
            </div>
            <div class="manage-row__sub">{{ event.game }}</div>
          </div>
          <span class="coderow__expires">{{ event.date }}</span>
          <span class="coderow__expires">{{ event.time }}</span>
          <span class="tag">同步</span>
          <span class="feedrow__arrow">→</span>
        </article>
      </div>
      <div v-else class="empty-state">还没有可生成日历的资讯或兑换码截止时间。</div>
    </section>
  </main>
</template>
