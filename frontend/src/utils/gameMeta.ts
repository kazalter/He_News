import type { Game } from '../types'

export type GameKey =
  | 'genshin'
  | 'hsr'
  | 'zzz'
  | 'wuwa'
  | 'ark'
  | 'r1999'
  | 'bluearchive'
  | 'other'

export type GameMeta = {
  key: GameKey
  name: string
  shortName: string
  color: string
  /** 角色配套武器的叫法：星穹铁道→光锥，绝区零→音擎，其余→武器。 */
  weapon: string
  /** resolveGameKey 用来从 slug/name 推断 key 的关键词（已小写）。 */
  keywords: string[]
}

/**
 * 单一游戏注册表：加一个新游戏 = 在这里加一条（再写后端 parser）。
 * 颜色、中文名、武器叫法、识别关键词都集中在这一处，不再散落到
 * resolveGameKey / WEAPON_TERMS / tokens.css 等多个地方。
 * 'other' 是兜底项，没有关键词，永远排在匹配循环最后。
 */
export const gameMetas: Record<GameKey, GameMeta> = {
  genshin: {
    key: 'genshin',
    name: '原神',
    shortName: '原神',
    color: '#B59969',
    weapon: '武器',
    keywords: ['genshin', '原神'],
  },
  hsr: {
    key: 'hsr',
    name: '崩坏：星穹铁道',
    shortName: '星穹铁道',
    color: '#9389C2',
    weapon: '光锥',
    keywords: ['hsr', 'starrail', '星穹', '崩坏'],
  },
  zzz: {
    key: 'zzz',
    name: '绝区零',
    shortName: '绝区零',
    color: '#C7A547',
    weapon: '音擎',
    keywords: ['zzz', 'zenless', '绝区'],
  },
  wuwa: {
    key: 'wuwa',
    name: '鸣潮',
    shortName: '鸣潮',
    color: '#5FA29A',
    weapon: '武器',
    keywords: ['wuwa', 'wuthering', '鸣潮'],
  },
  ark: {
    key: 'ark',
    name: '明日方舟',
    shortName: '明日方舟',
    color: '#C77D4D',
    weapon: '武器',
    keywords: ['ark', 'arknights', '方舟'],
  },
  r1999: {
    key: 'r1999',
    name: '重返未来:1999',
    shortName: '1999',
    color: '#AF6770',
    weapon: '武器',
    keywords: ['1999', 'reverse'],
  },
  bluearchive: {
    key: 'bluearchive',
    name: '蔚蓝档案',
    shortName: '蔚蓝档案',
    color: '#7689B0',
    weapon: '武器',
    keywords: ['blue', 'archive', '蔚蓝', '档案'],
  },
  other: {
    key: 'other',
    name: '其他',
    shortName: '其他',
    color: '#85858E',
    weapon: '武器',
    keywords: [],
  },
}

export const gameKeys = Object.values(gameMetas)
  .map((meta) => meta.key)
  .filter((key): key is Exclude<GameKey, 'other'> => key !== 'other')

export function resolveGameKey(game?: Pick<Game, 'slug' | 'name'> | null): GameKey {
  const text = `${game?.slug ?? ''} ${game?.name ?? ''}`.toLowerCase()

  for (const meta of Object.values(gameMetas)) {
    if (meta.key === 'other') continue
    if (meta.keywords.some((keyword) => text.includes(keyword))) return meta.key
  }

  return 'other'
}

export function getGameMeta(game?: Pick<Game, 'slug' | 'name'> | null): GameMeta {
  return gameMetas[resolveGameKey(game)]
}

export function gameColor(game?: Pick<Game, 'slug' | 'name'> | null) {
  return getGameMeta(game).color
}

export function gameShortName(game?: Pick<Game, 'slug' | 'name'> | null) {
  const meta = getGameMeta(game)
  return meta.key === 'other' ? game?.name ?? meta.shortName : meta.shortName
}

export function matchesGameFilter(game: Pick<Game, 'slug' | 'name'> | undefined | null, selectedGame: string) {
  return selectedGame === 'all' || resolveGameKey(game) === selectedGame
}

export function weaponLabel(game?: Pick<Game, 'slug' | 'name'> | null) {
  return getGameMeta(game).weapon
}
