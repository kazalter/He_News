<script setup lang="ts">
import { Search } from '@element-plus/icons-vue'

withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
  }>(),
  {
    placeholder: '搜索版本、角色、兑换码...',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: []
}>()
</script>

<template>
  <label class="search">
    <Search />
    <input
      :value="modelValue"
      :placeholder="placeholder"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @keyup.enter="emit('submit')"
    />
    <kbd>⌘K</kbd>
  </label>
</template>
