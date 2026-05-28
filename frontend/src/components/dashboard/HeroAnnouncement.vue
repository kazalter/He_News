<script setup lang="ts">
import { ArrowRight, Clock, Connection } from '@element-plus/icons-vue'
import GameTag from '../ui/GameTag.vue'
import QuietTag from '../ui/Tag.vue'

defineProps<{
  title?: string
  summary?: string
  gameName?: string
  gameKey?: string
  gameColor?: string
  category?: string
  sourceName?: string
  publishedAt?: string
  href?: string
  stats: {
    articles: number
    codes: number
    sources: number
  }
}>()
</script>

<template>
  <section class="hero" aria-label="重点动态" :data-game="gameKey" :style="{ '--c': gameColor ?? 'var(--ink-3)' }">
    <div class="hero__left">
      <template v-if="title">
        <div class="hero__top">
          <div class="hero__tags">
            <GameTag v-if="gameName" :name="gameName" :color="gameColor" />
            <QuietTag v-if="category">{{ category }}</QuietTag>
          </div>
          <h2 class="hero__title">{{ title }}</h2>
        </div>
        <div class="hero__bottom">
          <div class="hero__meta">
            <span v-if="publishedAt" class="meta">
              <Clock />
              {{ publishedAt }}
            </span>
            <span v-if="sourceName" class="meta">
              <Connection />
              {{ sourceName }}
            </span>
          </div>
          <a v-if="href" class="hero__cta" :href="href" target="_blank" rel="noopener noreferrer">
            查看详情
            <ArrowRight />
          </a>
        </div>
      </template>

      <template v-else>
        <div class="hero__top">
          <div class="hero__tags">
            <QuietTag tone="accent">等待同步</QuietTag>
          </div>
          <h2 class="hero__title">还没有同步到官方动态</h2>
        </div>
        <div class="hero__bottom">
          <div class="hero__meta">
            <span class="meta">
              <Connection />
              添加游戏和数据源后，点击来源页的抓取按钮开始填充内容
            </span>
          </div>
          <RouterLink class="hero__cta" to="/sources">
            去配置
            <ArrowRight />
          </RouterLink>
        </div>
      </template>
    </div>

    <div class="hero__right">
      <svg class="hero__art" viewBox="0 0 340 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="hero-hairline" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="rgba(255,255,255,.06)" />
            <stop offset="1" stop-color="rgba(255,255,255,0)" />
          </linearGradient>
          <radialGradient id="hero-dot" cx=".5" cy=".5" r=".5">
            <stop offset="0" :stop-color="gameColor ?? '#7B83FF'" stop-opacity=".18" />
            <stop offset="1" :stop-color="gameColor ?? '#7B83FF'" stop-opacity="0" />
          </radialGradient>
        </defs>
        <circle cx="320" cy="40" r="80" fill="url(#hero-dot)" />
        <g>
          <line x1="40" y1="0" x2="40" y2="240" stroke="url(#hero-hairline)" />
          <line x1="120" y1="0" x2="120" y2="240" stroke="url(#hero-hairline)" />
          <line x1="220" y1="0" x2="220" y2="240" stroke="url(#hero-hairline)" />
          <line x1="300" y1="0" x2="300" y2="240" stroke="url(#hero-hairline)" />
        </g>
        <g fill="#fff" opacity=".25">
          <circle cx="80" cy="180" r="1" />
          <circle cx="260" cy="60" r=".8" />
          <circle cx="180" cy="200" r=".6" />
          <circle cx="50" cy="60" r=".7" />
        </g>
      </svg>
      <div style="position: relative">
        <span class="cd__label">当前内容 · 数据概览</span>
        <div class="cd__time">
          <div class="cd__seg"><b>{{ stats.articles }}</b><span>NEWS</span></div>
          <div class="cd__seg"><b>{{ stats.codes }}</b><span>CODE</span></div>
          <div class="cd__seg"><b>{{ stats.sources }}</b><span>SRC</span></div>
        </div>
      </div>
      <div class="cd__when">
        <span>数据来自后端 API</span>
        <span class="dim">/api/articles · /api/codes</span>
      </div>
    </div>
  </section>
</template>
