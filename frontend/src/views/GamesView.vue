<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Plus, Refresh } from '@element-plus/icons-vue'
import IconBtn from '../components/ui/IconBtn.vue'
import LinkBtn from '../components/ui/LinkBtn.vue'
import { useNewsStore } from '../stores/news'
import { gameColor, gameShortName } from '../utils/gameMeta'

const store = useNewsStore()
const dialogVisible = ref(false)
const form = reactive({
  name: '',
  slug: '',
  iconUrl: '',
  officialUrl: '',
})

const displayGames = computed(() => store.games)

const totals = computed(() => ({
  games: displayGames.value.length,
  articles: displayGames.value.reduce((sum, game) => sum + (game._count?.articles ?? 0), 0),
  sources: displayGames.value.reduce((sum, game) => sum + (game._count?.sources ?? 0), 0),
  codes: displayGames.value.reduce((sum, game) => sum + (game._count?.redeemCodes ?? 0), 0),
}))

onMounted(async () => {
  await run(store.loadGames(), true)
})

function resetForm() {
  form.name = ''
  form.slug = ''
  form.iconUrl = ''
  form.officialUrl = ''
}

async function submit() {
  await run(
    store.createGame({
      name: form.name,
      slug: form.slug || undefined,
      iconUrl: form.iconUrl || undefined,
      officialUrl: form.officialUrl || undefined,
    }),
  )
  dialogVisible.value = false
  resetForm()
}

async function remove(id: string) {
  await ElMessageBox.confirm('删除后会同时删除该游戏的来源、资讯和兑换码。', '确认删除', {
    type: 'warning',
  })
  await run(store.deleteGame(id))
}

async function run(task: Promise<unknown>, silent = false) {
  store.loading = true
  try {
    await task
  } catch (error) {
    if (!silent) {
      ElMessage.error(error instanceof Error ? error.message : '请求失败，无法加载游戏')
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
        <h1 class="page-title">我的游戏</h1>
        <p class="page-subtitle">维护关注列表、版本信息和官网入口。</p>
      </div>
      <div class="page-actions">
        <LinkBtn @click="run(store.loadGames())">
          刷新
          <Refresh />
        </LinkBtn>
        <LinkBtn @click="dialogVisible = true">
          添加
          <Plus />
        </LinkBtn>
      </div>
    </header>

    <section class="metric-grid">
      <div class="metric">
        <span>Games</span>
        <strong>{{ totals.games }}</strong>
      </div>
      <div class="metric">
        <span>Articles</span>
        <strong>{{ totals.articles }}</strong>
      </div>
      <div class="metric">
        <span>Sources</span>
        <strong>{{ totals.sources }}</strong>
      </div>
      <div class="metric">
        <span>Codes</span>
        <strong>{{ totals.codes }}</strong>
      </div>
    </section>

    <section class="surface-panel">
      <div v-if="displayGames.length" class="manage-list">
        <article v-for="game in displayGames" :key="game.id" class="manage-row">
          <div class="manage-row__main">
            <div class="manage-row__title" :style="{ '--c': gameColor(game) }">
              <span class="dot" />
              {{ game.name }}
              <span class="coderow__expires">{{ game.slug }}</span>
            </div>
            <div class="manage-row__sub">{{ game.officialUrl || '未配置官网入口' }}</div>
          </div>
          <span class="gametag" :style="{ '--c': gameColor(game) }">
            <span class="gametag__dot" />
            {{ gameShortName(game) }}
          </span>
          <span class="coderow__expires">{{ game._count?.articles ?? 0 }} 资讯</span>
          <span class="coderow__expires">{{ game._count?.sources ?? 0 }} 来源</span>
          <IconBtn title="删除" @click="remove(game.id)">
            <Delete />
          </IconBtn>
        </article>
      </div>
      <div v-else class="empty-state">还没有游戏。点击右上角“添加”开始配置。</div>
    </section>

    <el-dialog v-model="dialogVisible" title="添加游戏" width="560px">
      <div class="form-grid">
        <el-input v-model="form.name" placeholder="游戏名称" />
        <el-input v-model="form.slug" placeholder="标识，可留空" />
        <el-input v-model="form.iconUrl" class="full-width" placeholder="图标 URL，可留空" />
        <el-input v-model="form.officialUrl" class="full-width" placeholder="官网 URL，可留空" />
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!form.name" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </main>
</template>
