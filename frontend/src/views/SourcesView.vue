<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Plus, Refresh, VideoPlay } from '@element-plus/icons-vue'
import { useNewsStore } from '../stores/news'
import type { Source } from '../types'

const store = useNewsStore()
const dialogVisible = ref(false)
const form = reactive({
  gameId: '',
  name: '',
  type: 'rss',
  url: '',
  crawlIntervalMinutes: 60,
})

const typeOptions = [
  { label: 'RSS', value: 'rss' },
  { label: 'HTML', value: 'html' },
  { label: 'Steam', value: 'steam' },
  { label: 'Bilibili', value: 'bilibili' },
  { label: 'Weibo', value: 'weibo' },
  { label: 'Manual', value: 'manual' },
  { label: 'mihoyo · 资讯列表', value: 'mihoyo-content-v2' },
  { label: 'mihoyo · 版本前瞻专题', value: 'mihoyo-version-special' },
  { label: 'mihoyo · 绝区零版本（新闻 API）', value: 'mihoyo-zzz-news-version' },
]

onMounted(async () => {
  await run(Promise.all([store.loadGames(), store.loadSources()]))
})

function resetForm() {
  form.gameId = ''
  form.name = ''
  form.type = 'rss'
  form.url = ''
  form.crawlIntervalMinutes = 60
}

async function submit() {
  await run(
    store.createSource({
      gameId: form.gameId,
      name: form.name,
      type: form.type,
      url: form.url,
      crawlIntervalMinutes: form.crawlIntervalMinutes,
    }),
  )
  dialogVisible.value = false
  resetForm()
}

async function toggleEnabled(source: Source, enabled: boolean) {
  await run(store.updateSource(source.id, { enabled }))
}

async function crawl(id: string) {
  await run(store.crawlSource(id))
}

async function remove(id: string) {
  await ElMessageBox.confirm('删除后会保留既有游戏，但该来源的资讯会一并删除。', '确认删除', {
    type: 'warning',
  })
  await run(store.deleteSource(id))
}

async function run(task: Promise<unknown>) {
  store.loading = true
  try {
    await task
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '请求失败')
  } finally {
    store.loading = false
  }
}
</script>

<template>
  <main class="page">
    <header class="page-header">
      <div>
        <h1 class="page-title">来源</h1>
        <p class="page-subtitle">配置官网、RSS 和官方账号入口</p>
      </div>
      <div class="toolbar">
        <el-button :icon="Refresh" @click="run(store.loadSources())">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="dialogVisible = true">添加</el-button>
      </div>
    </header>

    <section class="table-panel">
      <el-table :data="store.sources" v-loading="store.loading" empty-text="暂无来源">
        <el-table-column prop="name" label="来源" min-width="180" />
        <el-table-column label="游戏" width="140">
          <template #default="{ row }">{{ row.game?.name ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="110" />
        <el-table-column prop="url" label="URL" min-width="280" show-overflow-tooltip />
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-switch :model-value="row.enabled" @change="(value: boolean) => toggleEnabled(row, value)" />
          </template>
        </el-table-column>
        <el-table-column label="资讯" width="90">
          <template #default="{ row }">{{ row._count?.articles ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" align="right">
          <template #default="{ row }">
            <el-button circle :icon="VideoPlay" @click="crawl(row.id)" />
            <el-button circle type="danger" :icon="Delete" @click="remove(row.id)" />
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="dialogVisible" title="添加来源" width="620px">
      <div class="form-grid">
        <el-select v-model="form.gameId" placeholder="游戏">
          <el-option v-for="game in store.games" :key="game.id" :label="game.name" :value="game.id" />
        </el-select>
        <el-select v-model="form.type" placeholder="类型">
          <el-option v-for="item in typeOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-input v-model="form.name" placeholder="来源名称" />
        <el-input-number v-model="form.crawlIntervalMinutes" :min="5" :max="10080" controls-position="right" />
        <el-input v-model="form.url" class="full-width" placeholder="来源 URL" />
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!form.gameId || !form.name || !form.url" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </main>
</template>
