<script setup lang="ts">
const apiBase = import.meta.env.VITE_API_BASE_URL ?? '/api'
</script>

<template>
  <main class="page">
    <header class="page-header">
      <div>
        <h1 class="page-title">设置</h1>
        <p class="page-subtitle">当前开发配置</p>
      </div>
    </header>

    <section class="metric-grid">
      <div class="metric">
        <span>API</span>
        <strong style="font-size: 18px">{{ apiBase }}</strong>
      </div>
      <div class="metric">
        <span>数据库</span>
        <strong style="font-size: 18px">SQLite</strong>
      </div>
      <div class="metric">
        <span>前端</span>
        <strong style="font-size: 18px">Vue 3</strong>
      </div>
      <div class="metric">
        <span>后端</span>
        <strong style="font-size: 18px">NestJS</strong>
      </div>
    </section>

    <section class="panel">
      <div class="panel-title">后续任务</div>
      <el-timeline>
        <el-timeline-item timestamp="MVP">定时抓取、失败重试、更多官方平台适配</el-timeline-item>
        <el-timeline-item timestamp="体验">深色模式、通知提醒、活动过期提示</el-timeline-item>
        <el-timeline-item timestamp="部署">Docker Compose、PostgreSQL、反向代理配置</el-timeline-item>
      </el-timeline>
    </section>
  </main>
</template>
