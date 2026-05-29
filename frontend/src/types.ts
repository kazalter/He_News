export type Game = {
  id: string
  name: string
  slug: string
  iconUrl?: string | null
  officialUrl?: string | null
  createdAt: string
  updatedAt: string
  _count?: {
    sources?: number
    articles?: number
    redeemCodes?: number
  }
}

export type Source = {
  id: string
  gameId: string
  name: string
  type: string
  url: string
  enabled: boolean
  crawlIntervalMinutes: number
  lastCrawledAt?: string | null
  createdAt: string
  updatedAt: string
  game?: Game
  _count?: {
    articles?: number
    crawlLogs?: number
  }
}

export type Article = {
  id: string
  gameId: string
  sourceId: string
  title: string
  summary?: string | null
  content?: string | null
  url: string
  coverUrl?: string | null
  publishedAt?: string | null
  category: string
  isRead: boolean
  isFavorite: boolean
  createdAt: string
  updatedAt: string
  game?: Game
  source?: Source
  redeemCodes?: RedeemCode[]
}

export type ArticleListResponse = {
  items: Article[]
  total: number
  page: number
  limit: number
}

export type RedeemCode = {
  id: string
  gameId: string
  articleId?: string | null
  sourceId?: string | null
  code: string
  description?: string | null
  reward?: string | null
  expiredAt?: string | null
  status: string
  createdAt: string
  updatedAt: string
  game?: Game
  source?: Source | null
  article?: Article | null
}

export type CrawlLog = {
  id: string
  sourceId: string
  status: string
  message?: string | null
  startedAt: string
  finishedAt?: string | null
  source?: Source
}

export type VersionPlanBanner = {
  id: string
  planId: string
  phase: number
  poolIndex: number
  poolName?: string | null
  characterName?: string | null
  characterRarity?: number | null
  characterPath?: string | null
  characterElement?: string | null
  isNewCharacter: boolean
  weaponName?: string | null
  weaponRarity?: number | null
  isNewWeapon: boolean
  startAt?: string | null
  endAt?: string | null
  rawTime?: string | null
  rawRoleInfo?: string | null
  rawConeInfo?: string | null
}

export type VersionPlanEvent = {
  id: string
  planId: string
  category: 'event' | 'other' | 'story' | string
  name: string
  label?: string | null
  info?: string | null
  startAt?: string | null
  endAt?: string | null
  imageUrl?: string | null
}

export type VersionPlan = {
  id: string
  gameId: string
  version: string
  subtitle?: string | null
  releaseAt?: string | null
  coverUrl?: string | null
  officialUrl?: string | null
  provider: string
  providerUrl?: string | null
  lastSyncedAt?: string | null
  createdAt: string
  updatedAt: string
  game?: Game
  banners: VersionPlanBanner[]
  events: VersionPlanEvent[]
}
