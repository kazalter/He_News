import { defineStore } from 'pinia'

export type ThemeMode = 'dark' | 'light'
export type DensityMode = 'compact' | 'comfy' | 'roomy'

const THEME_KEY = 'henews-theme'

function readInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  const saved = window.localStorage.getItem(THEME_KEY)
  return saved === 'light' ? 'light' : 'dark'
}

function applyThemeClass(theme: ThemeMode) {
  if (typeof document === 'undefined') {
    return
  }

  document.body.classList.remove('theme-dark', 'theme-light')
  document.body.classList.add(`theme-${theme}`)
  document.documentElement.style.colorScheme = theme
}

export const useUiStore = defineStore('ui', {
  state: () => ({
    theme: readInitialTheme() as ThemeMode,
    density: 'compact' as DensityMode,
    selectedGame: 'all',
    feedTab: 'all',
    search: '',
  }),
  actions: {
    applyTheme(theme?: ThemeMode) {
      const nextTheme = theme ?? this.theme
      this.theme = nextTheme
      applyThemeClass(nextTheme)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(THEME_KEY, nextTheme)
      }
    },
    toggleTheme() {
      this.applyTheme(this.theme === 'light' ? 'dark' : 'light')
    },
    setSelectedGame(gameKey: string) {
      this.selectedGame = gameKey
    },
    setSearch(value: string) {
      this.search = value
    },
    setFeedTab(value: string) {
      this.feedTab = value
    },
  },
})
