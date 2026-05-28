export type CodeTableRow = {
  id: string
  code: string
  gameName: string
  gameKey: string
  gameColor: string
  rewards: string[]
  expires: string
  status: 'available' | 'urgent' | 'expired' | 'used'
}

export type FeedListItem =
  | {
      kind: 'separator'
      id: string
      label: string
    }
  | {
      kind: 'row'
      id: string
      time: string
      gameName: string
      gameKey: string
      gameColor: string
      title: string
      tag: string
      href: string
    }
