/**
 * 数据库 seed：把所有游戏模块的 Game + 来源补齐（幂等，可重跑）。
 *
 * 为什么需要它：dev.db 在 .gitignore 里，换电脑 / 新环境 clone 下来是空库——
 * parser 代码都在，但"配过哪些游戏、每个游戏从哪抓"这份清单（Game / Source 记录）
 * 不跟着 git 走。这个脚本把那份清单做成代码，一条命令重建：
 *   `npm --prefix backend run seed`（或新环境一键 `npm --prefix backend run setup`）。
 *
 * 加新游戏 / 新来源 = 往下面 GAMES 里加一条。Source 的 URL 里编码了关键参数
 * （米哈游 appId / 频道、绝区零新闻版 iChanId、库洛官网静态 JSON 基址），照搬即可。
 *
 * 幂等：游戏按 slug upsert；来源按 (gameId, type) 找已有的就更新、没有才建——
 * 重复跑不会堆叠。前提是同一游戏同一 type 只有一条源（当前都满足）。
 */
import { PrismaClient } from '@prisma/client';
import { KUROGAMES_GAMES } from '../src/crawler/kurogames';

const prisma = new PrismaClient();

type SourceSeed = {
  name: string;
  type: string;
  url: string;
  crawlIntervalMinutes: number;
};

type GameSeed = {
  slug: string;
  name: string;
  officialUrl?: string;
  iconUrl?: string;
  sources: SourceSeed[];
};

const MIHOYO_CONTENT_API =
  'https://act-api-takumi-static.mihoyo.com/content_v2_user/app';

const wuwa = KUROGAMES_GAMES.find((game) => game.key === 'wuwa');
if (!wuwa) {
  throw new Error('KUROGAMES_GAMES 里缺少 wuwa 配置');
}

const GAMES: GameSeed[] = [
  {
    slug: 'honkai-star-rail',
    name: '崩坏：星穹铁道',
    officialUrl: 'https://sr.mihoyo.com/',
    sources: [
      {
        name: '星穹铁道官网资讯',
        type: 'mihoyo-content-v2',
        url: `${MIHOYO_CONTENT_API}/1963de8dc19e461c/getContentList?channels=256,257,258&iPageSize=10&sLangKey=zh-cn`,
        crawlIntervalMinutes: 60,
      },
      {
        name: 'Game8 星铁兑换码',
        type: 'game8-codes',
        url: 'https://game8.co/games/Honkai-Star-Rail/archives/410296',
        crawlIntervalMinutes: 720,
      },
    ],
  },
  {
    slug: 'zenless-zone-zero',
    name: '绝区零',
    officialUrl: 'https://zzz.mihoyo.com/',
    sources: [
      {
        name: '绝区零·官网资讯',
        type: 'mihoyo-content-v2',
        url: `${MIHOYO_CONTENT_API}/706fd13a87294881/getContentList?channels=278,279,280&iPageSize=15&sLangKey=zh-cn`,
        crawlIntervalMinutes: 60,
      },
      {
        name: '绝区零·版本卡池（新闻 API）',
        type: 'mihoyo-zzz-news-version',
        url: `${MIHOYO_CONTENT_API}/706fd13a87294881/getContentList?iChanId=278&sLangKey=zh-cn`,
        crawlIntervalMinutes: 360,
      },
      {
        name: 'Game8 绝区零兑换码',
        type: 'game8-codes',
        url: 'https://game8.co/games/Zenless-Zone-Zero/archives/435683',
        crawlIntervalMinutes: 720,
      },
    ],
  },
  {
    slug: 'wuthering-waves',
    name: '鸣潮',
    officialUrl: `${wuwa.siteBase}/main/news`,
    iconUrl: `${wuwa.siteBase}/static4.0/favicon.ico`,
    sources: [
      {
        name: '鸣潮 · 官网资讯',
        type: 'kurogames-news',
        url: wuwa.jsonBase,
        crawlIntervalMinutes: 180,
      },
      {
        name: '鸣潮 · 版本前瞻',
        type: 'kurogames-version',
        url: wuwa.jsonBase,
        crawlIntervalMinutes: 720,
      },
      {
        name: 'GameKee 鸣潮兑换码',
        type: 'gamekee-codes',
        url: 'https://www.gamekee.com/mc/622905.html',
        crawlIntervalMinutes: 720,
      },
    ],
  },
];

async function upsertSource(gameId: string, seed: SourceSeed) {
  const existing = await prisma.source.findFirst({
    where: { gameId, type: seed.type },
  });

  if (existing) {
    await prisma.source.update({
      where: { id: existing.id },
      data: {
        name: seed.name,
        url: seed.url,
        crawlIntervalMinutes: seed.crawlIntervalMinutes,
      },
    });
    return 'updated' as const;
  }

  await prisma.source.create({
    data: { gameId, ...seed, enabled: true },
  });
  return 'created' as const;
}

async function seedGame(seed: GameSeed) {
  const game = await prisma.game.upsert({
    where: { slug: seed.slug },
    update: { name: seed.name, officialUrl: seed.officialUrl ?? null },
    create: {
      name: seed.name,
      slug: seed.slug,
      officialUrl: seed.officialUrl ?? null,
      iconUrl: seed.iconUrl ?? null,
    },
  });

  console.log(`\n## ${seed.name} (${seed.slug})`);
  for (const source of seed.sources) {
    const action = await upsertSource(game.id, source);
    console.log(`  [${action}] ${source.type} → ${source.name}`);
  }
}

async function main() {
  for (const game of GAMES) {
    await seedGame(game);
  }
  const total = GAMES.reduce((sum, g) => sum + g.sources.length, 0);
  console.log(`\n✓ 共 ${GAMES.length} 个游戏 / ${total} 条来源已就绪`);
}

main()
  .catch((error) => {
    console.error('seed 失败：', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
