<script setup lang="ts">
import { computed, reactive } from 'vue'
import { Check, CopyDocument } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import LinkBtn from '../ui/LinkBtn.vue'
import type { CodeTableRow } from './types'

const props = withDefaults(
  defineProps<{
    rows: CodeTableRow[]
    title?: string
    selectedGame?: string
    showHeaderActions?: boolean
  }>(),
  {
    title: '可用兑换码',
    selectedGame: 'all',
    showHeaderActions: true,
  },
)

const copied = reactive<Record<string, boolean>>({})
const urgentOnly = reactive({ value: false })

const visibleRows = computed(() => {
  if (!urgentOnly.value) {
    return props.rows
  }

  return props.rows.filter((row) => row.status === 'urgent')
})

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = code
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  }

  copied[code] = true
  ElMessage.success('已复制')
  window.setTimeout(() => {
    copied[code] = false
  }, 1500)
}

async function copyAll() {
  await copyCode(visibleRows.value.map((row) => row.code).join('\n'))
}

function statusText(status: CodeTableRow['status']) {
  if (status === 'urgent') return '即将过期'
  if (status === 'expired') return '已过期'
  if (status === 'used') return '已兑换'
  return '可用'
}

function isDimmed(gameKey: string) {
  return props.selectedGame !== 'all' && props.selectedGame !== gameKey
}
</script>

<template>
  <section class="section">
    <header class="section__head">
      <h3 class="section__title">
        {{ title }}
        <span class="section__count">{{ visibleRows.length }}</span>
      </h3>
      <div v-if="showHeaderActions" class="section__right">
        <LinkBtn :active="urgentOnly.value" @click="urgentOnly.value = !urgentOnly.value">仅看即将过期</LinkBtn>
        <LinkBtn @click="copyAll">
          复制全部
          <CopyDocument />
        </LinkBtn>
      </div>
    </header>

    <div class="codes">
      <div class="codes__head">
        <div />
        <div>游戏 · 奖励</div>
        <div>兑换码</div>
        <div>截止</div>
        <div>状态</div>
        <div />
      </div>

      <div v-if="visibleRows.length">
        <div
          v-for="row in visibleRows"
          :key="row.id"
          class="coderow"
          :class="{ 'is-dimmed': isDimmed(row.gameKey) }"
          :data-game="row.gameKey"
          :style="{ '--c': row.gameColor }"
        >
          <span />
          <div class="coderow__title">
            <span class="coderow__game"><span class="dot" />{{ row.gameName }}</span>
            <span class="coderow__rewards">
              <span v-for="reward in row.rewards" :key="reward">{{ reward }}</span>
            </span>
          </div>
          <code class="coderow__code">{{ row.code }}</code>
          <span class="coderow__expires">{{ row.expires }}</span>
          <span class="coderow__status" :class="{ urgent: row.status === 'urgent', expired: row.status !== 'available' && row.status !== 'urgent' }">
            <span class="dot" />
            {{ statusText(row.status) }}
          </span>
          <button class="coderow__copy" :class="{ copied: copied[row.code] }" type="button" title="复制" @click="copyCode(row.code)">
            <Check v-if="copied[row.code]" />
            <CopyDocument v-else />
          </button>
        </div>
      </div>

      <div v-else class="empty-state">暂无兑换码</div>
    </div>
  </section>
</template>
