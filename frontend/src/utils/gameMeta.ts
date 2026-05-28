import type { Game } from '../types'

export const gameKeys = ['genshin', 'hsr', 'zzz', 'wuwa', 'ark', 'r1999', 'bluearchive'] as const
export type GameKey = (typeof gameKeys)[number] | 'other'

export type GameMeta = {
  key: GameKey
  name: string
  shortName: string
  color: string
}

export const gameMetas: Record<GameKey, GameMeta> = {
  genshin: { key: 'genshin', name: '原神', shortName: '原神', color: '#B59969' },
  hsr: { key: 'hsr', name: '崩坏：星穹铁道', shortName: '星穹铁道', color: '#9389C2' },
  zzz: { key: 'zzz', name: '绝区零', shortName: '绝区零', color: '#C7A547' },
  wuwa: { key: 'wuwa', name: '鸣潮', shortName: '鸣潮', color: '#5FA29A' },
  ark: { key: 'ark', name: '明日方舟', shortName: '明日方舟', color: '#C77D4D' },
  r1999: { key: 'r1999', name: '重返未来:1999', shortName: '1999', color: '#AF6770' },
  bluearchive: { key: 'bluearchive', name: '蔚蓝档案', shortName: '蔚蓝档案', color: '#7689B0' },
  other: { key: 'other', name: '其他', shortName: '其他', color: '#85858E' },
}

export function resolveGameKey(game?: Pick<Game, 'slug' | 'name'> | null): GameKey {
  const text = `${game?.slug ?? ''} ${game?.name ?? ''}`.toLowerCase()

  if (text.includes('genshin') || text.includes('原神')) return 'genshin'
  if (text.includes('hsr') || text.includes('starrail') || text.includes('星穹') || text.includes('崩坏')) return 'hsr'
  if (text.includes('zzz') || text.includes('zenless') || text.includes('绝区')) return 'zzz'
  if (text.includes('wuwa') || text.includes('wuthering') || text.includes('鸣潮')) return 'wuwa'
  if (text.includes('ark') || text.includes('arknights') || text.includes('方舟')) return 'ark'
  if (text.includes('1999') || text.includes('reverse')) return 'r1999'
  if (text.includes('blue') || text.includes('archive') || text.includes('蔚蓝') || text.includes('档案')) return 'bluearchive'

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
