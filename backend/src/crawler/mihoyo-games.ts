/**
 * 米哈游 content_v2_user 资讯 API 的逐游戏配置注册表。
 *
 * 同一套 API（app/<appId>/getContentList）服务所有米哈游游戏，但每个游戏的
 * appId、官网域名（文章链接/Referer）、默认频道号都不同。以前这些散落在
 * crawler.service 的两个私有方法里、且缺省值硬编码成星穹铁道，新游戏接入很容易
 * 拿到错数据。集中到这里：加一个米哈游游戏 = 加一条。
 */
export type MihoyoGameConfig = {
  key: string;
  name: string;
  /** content_v2_user/app/<appId>/ 里的 appId。 */
  appId: string;
  /** 官网新闻域名，文章链接与 Referer 都基于它。 */
  newsBaseUrl: string;
  /** source URL 不带 channels 参数时的默认频道（资讯/公告/活动）。 */
  defaultChannels: number[];
};

export const MIHOYO_GAMES: MihoyoGameConfig[] = [
  {
    key: 'hsr',
    name: '崩坏：星穹铁道',
    appId: '1963de8dc19e461c',
    newsBaseUrl: 'https://sr.mihoyo.com',
    defaultChannels: [256, 257, 258],
  },
  {
    key: 'zzz',
    name: '绝区零',
    appId: '706fd13a87294881',
    newsBaseUrl: 'https://zzz.mihoyo.com',
    defaultChannels: [278, 279, 280],
  },
];

export function extractMihoyoAppId(endpoint: URL): string | undefined {
  return endpoint.pathname.match(/\/content_v2_user\/app\/([0-9a-f]+)\//i)?.[1];
}

export function findMihoyoGameByAppId(
  appId?: string,
): MihoyoGameConfig | undefined {
  if (!appId) return undefined;
  return MIHOYO_GAMES.find((game) => game.appId === appId);
}
