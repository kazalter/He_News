<script setup lang="ts">
import type { Component } from 'vue'
import { onMounted } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { Calendar, Collection, Connection, HomeFilled, Moon, Setting, Sunny, Ticket, TrendCharts } from '@element-plus/icons-vue'
import DashboardSide from './components/dashboard/DashboardSide.vue'
import IconBtn from './components/ui/IconBtn.vue'
import { useTheme } from './composables/useTheme'
import { useNewsStore } from './stores/news'

type NavItem = {
  path: string
  label: string
  tip: string
  icon: Component
}

const route = useRoute()
const store = useNewsStore()
const { theme, toggleTheme } = useTheme()

const navItems: NavItem[] = [
  { path: '/', label: '信息流', tip: '信息流', icon: HomeFilled },
  { path: '/versions', label: '版本', tip: '版本计划', icon: TrendCharts },
  { path: '/codes', label: '兑换码', tip: '兑换码', icon: Ticket },
  { path: '/games', label: '游戏', tip: '我的游戏', icon: Collection },
  { path: '/calendar', label: '日历', tip: '活动日历', icon: Calendar },
  { path: '/sources', label: '来源', tip: '数据源', icon: Connection },
]

function isActive(path: string) {
  return path === '/' ? route.path === '/' : route.path.startsWith(path)
}

onMounted(() => {
  void Promise.allSettled([store.loadGames(), store.loadSources(), store.loadLogs(), store.loadArticles(), store.loadCodes()])
})
</script>

<template>
  <div class="bg" aria-hidden="true">
    <div class="bg__glow" />
    <div class="bg__noise" />
    <div class="bg__hairline" />
  </div>

  <div class="shell">
    <aside class="rail">
      <RouterLink class="rail__brand" to="/" title="HE News">
        <svg viewBox="0 0 24 24" class="rail__logo" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M4 4 L9 4 L18 20 L13 20 L11.6 17 L8 17 L9.4 14 L10 14 L8 9.5 Z" fill="currentColor" stroke="none" />
          <circle cx="18" cy="6" r="1.6" fill="currentColor" />
        </svg>
      </RouterLink>

      <nav class="rail__nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          class="rail__item"
          :class="{ 'is-active': isActive(item.path) }"
          :to="item.path"
          :data-tip="item.tip"
        >
          <component :is="item.icon" />
        </RouterLink>
      </nav>

      <div class="rail__bottom">
        <RouterLink class="rail__item" :class="{ 'is-active': isActive('/settings') }" to="/settings" data-tip="设置">
          <Setting />
        </RouterLink>
        <div class="rail__avatar" title="HE News">HE</div>
      </div>
    </aside>

    <nav class="mobile-nav">
      <RouterLink class="rail__brand" to="/" title="HE News">
        <svg viewBox="0 0 24 24" class="rail__logo" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M4 4 L9 4 L18 20 L13 20 L11.6 17 L8 17 L9.4 14 L10 14 L8 9.5 Z" fill="currentColor" stroke="none" />
          <circle cx="18" cy="6" r="1.6" fill="currentColor" />
        </svg>
      </RouterLink>
      <div class="mobile-nav__links">
        <RouterLink
          v-for="item in navItems"
          :key="`mobile-${item.path}`"
          class="mobile-nav__link"
          :class="{ 'is-active': isActive(item.path) }"
          :to="item.path"
        >
          {{ item.label }}
        </RouterLink>
      </div>
      <IconBtn title="切换主题" @click="toggleTheme">
        <Sunny v-if="theme === 'dark'" />
        <Moon v-else />
      </IconBtn>
    </nav>

    <main class="main">
      <RouterView />
    </main>

    <DashboardSide />
  </div>
</template>
