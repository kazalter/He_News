import { defineStore } from 'pinia'
import { ElMessage } from 'element-plus'
import { http } from '../api/http'
import type {
  Article,
  ArticleListResponse,
  CrawlLog,
  Game,
  RedeemCode,
  Source,
  VersionPlan,
} from '../types'

type ArticleFilters = {
  gameId?: string
  category?: string
  search?: string
  isFavorite?: string
  limit?: number
  page?: number
}

export const useNewsStore = defineStore('news', {
  state: () => ({
    games: [] as Game[],
    sources: [] as Source[],
    articles: [] as Article[],
    articleTotal: 0,
    codes: [] as RedeemCode[],
    logs: [] as CrawlLog[],
    versionPlans: [] as VersionPlan[],
    loading: false,
    articleFilters: {
      page: 1,
      limit: 20,
    } as ArticleFilters & { page: number; limit: number },
  }),
  getters: {
    unreadCount: (state) => state.articles.filter((article) => !article.isRead).length,
    favoriteCount: (state) => state.articles.filter((article) => article.isFavorite).length,
    unusedCodes: (state) => state.codes.filter((code) => code.status === 'unused'),
  },
  actions: {
    async bootstrap() {
      await Promise.all([this.loadGames(), this.loadSources(), this.loadArticles(), this.loadCodes(), this.loadLogs()])
    },
    async loadGames() {
      const { data } = await http.get<Game[]>('/games')
      this.games = data
    },
    async createGame(payload: Pick<Game, 'name'> & Partial<Pick<Game, 'slug' | 'iconUrl' | 'officialUrl'>>) {
      await http.post('/games', payload)
      ElMessage.success('游戏已添加')
      await this.loadGames()
    },
    async deleteGame(id: string) {
      await http.delete(`/games/${id}`)
      ElMessage.success('游戏已删除')
      await this.bootstrap()
    },
    async loadSources(gameId?: string) {
      const { data } = await http.get<Source[]>('/sources', { params: { gameId } })
      this.sources = data
    },
    async createSource(payload: {
      gameId: string
      name: string
      type: string
      url: string
      enabled?: boolean
      crawlIntervalMinutes?: number
    }) {
      await http.post('/sources', payload)
      ElMessage.success('来源已添加')
      await this.loadSources()
    },
    async updateSource(id: string, payload: Partial<Source>) {
      await http.patch(`/sources/${id}`, payload)
      ElMessage.success('来源已更新')
      await this.loadSources()
    },
    async deleteSource(id: string) {
      await http.delete(`/sources/${id}`)
      ElMessage.success('来源已删除')
      await this.bootstrap()
    },
    async crawlSource(id: string) {
      const { data } = await http.post(`/sources/${id}/crawl`)
      if (typeof data?.bannerCount === 'number') {
        ElMessage.success(`版本计划已同步：${data.version} · ${data.bannerCount} 卡池 / ${data.eventCount} 活动`)
        await Promise.all([this.loadVersionPlans(), this.loadSources(), this.loadLogs()])
      } else {
        ElMessage.success(`抓取完成：新增 ${data.createdArticles} 条`)
        await Promise.all([this.loadArticles(), this.loadCodes(), this.loadSources(), this.loadLogs()])
      }
    },
    async loadArticles(filters?: ArticleFilters) {
      this.articleFilters = { ...this.articleFilters, ...filters, page: filters ? 1 : this.articleFilters.page }
      const { data } = await http.get<ArticleListResponse>('/articles', {
        params: this.articleFilters,
      })
      this.articles = data.items
      this.articleTotal = data.total
    },
    async setArticleRead(article: Article, value: boolean) {
      const { data } = await http.patch<Article>(`/articles/${article.id}/read`, { value })
      Object.assign(article, data)
    },
    async setArticleFavorite(article: Article, value: boolean) {
      const { data } = await http.patch<Article>(`/articles/${article.id}/favorite`, { value })
      Object.assign(article, data)
    },
    async loadCodes(params?: { gameId?: string; status?: string }) {
      const { data } = await http.get<RedeemCode[]>('/codes', { params })
      this.codes = data
    },
    async updateCodeStatus(id: string, status: string) {
      await http.patch(`/codes/${id}/status`, { status })
      await this.loadCodes()
    },
    async loadLogs(params?: { sourceId?: string; status?: string }) {
      const { data } = await http.get<CrawlLog[]>('/crawl-logs', { params })
      this.logs = data
    },
    async loadVersionPlans(params?: { gameId?: string }) {
      const { data } = await http.get<VersionPlan[]>('/version-plans', { params })
      this.versionPlans = data
    },
  },
})
