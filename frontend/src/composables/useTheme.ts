import { computed } from 'vue'
import { useUiStore } from '../stores/ui'

export function useTheme() {
  const ui = useUiStore()
  ui.applyTheme(ui.theme)

  return {
    theme: computed(() => ui.theme),
    toggleTheme: () => ui.toggleTheme(),
    setTheme: (theme: 'dark' | 'light') => ui.applyTheme(theme),
  }
}
