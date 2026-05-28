/**
 * 绝区零（ZZZ）"版本前瞻 / 限时频段" parser，基于 mihoyo 新闻 content_v2_user API。
 *
 * 背景：ZZZ 没有像星穹铁道那种独立的"版本前瞻专题 H5"（mi18n 里只有 2-3 个角色名 + 几条
 * 营销文案）。结构化的卡池 / 角色 / 音擎 / 时间数据藏在官方新闻文章里，每个版本固定
 * 会发四类：
 *   - "X.Y版本内容一览（上期）" / "（下期）"     → 角色 + 音擎 + 主线 + 活动
 *   - "X.Y版本限时频段（上期）" / "（下期）"     → S/A 级代理人 + S/A 级音擎 + 时间区间
 *
 * 这个 parser：
 *   1. 调 content_v2_user/getContentList，频道 ID 默认 278（ZZZ NEWS 频道），翻 1-2 页
 *   2. 用标题正则筛出当前最高版本号的四篇关键文章
 *   3. 用 getContent 拉每篇正文，正则解析里面的角色 / 音擎 / 时间
 *   4. 按"每期 2 个 S 代理人 + 2 个 S 音擎"位置配对成 4 条 banner
 *
 * Source URL 形如：
 *   https://act-api-takumi-static.mihoyo.com/content_v2_user/app/<appId>/getContentList?iChanId=278&sLangKey=zh-cn
 * 其中 appId 是 ZZZ 的 `706fd13a87294881`，频道 ID 编码在 query string。
 */
import axios from 'axios';
import {
  ParsedVersionBanner,
  ParsedVersionEvent,
  ParsedVersionPlan,
  USER_AGENT,
  parseMihoyoDateTime,
  stripWhitespace,
} from '../mihoyo-version-special/shared';

type NewsListItem = {
  iInfoId: number;
  sTitle: string;
  dtStartTime: string;
  sExt?: string;
};

type NewsDetail = NewsListItem & {
  sContent: string;
};

type ApiResponse<T> = {
  retcode: number;
  message?: string;
  data?: T;
};

const DEFAULT_APP_ID = '706fd13a87294881';
const DEFAULT_CHAN_ID = 278;
const PAGE_SIZE = 40;

type AgentInfo = { name: string; element?: string; spec?: string; rarity: 4 | 5 };
type EngineInfo = { name: string; spec?: string; rarity: 4 | 5 };
type ActivityInfo = { name: string; label?: string };

type PhaseAccumulator = {
  sAgents: AgentInfo[];
  aAgents: AgentInfo[];
  sEngines: EngineInfo[];
  aEngines: EngineInfo[];
  startAt?: Date;
  endAt?: Date;
  rawTexts: string[];
  activities: ActivityInfo[];
  mainStory?: ActivityInfo;
};

export async function parseZzzNewsVersion(
  landingUrl: string,
): Promise<ParsedVersionPlan> {
  const { appId, chanId, baseUrl } = parseEndpoint(landingUrl);

  // 先抓第 1 页；如果四篇文章里至少一篇缺失就再翻第 2 页。
  let items = await fetchList(baseUrl, appId, chanId, 1);
  let relevant = findRelevantArticles(items);
  if (
    !relevant ||
    !relevant.contentShangqi ||
    !relevant.contentXiaqi ||
    !relevant.gachaXiaqi ||
    !relevant.gachaShangqi
  ) {
    try {
      const page2 = await fetchList(baseUrl, appId, chanId, 2);
      items = items.concat(page2);
      relevant = findRelevantArticles(items) ?? relevant;
    } catch {
      // page 2 不存在不算错，按已有数据继续
    }
  }

  if (!relevant || (!relevant.contentShangqi && !relevant.contentXiaqi)) {
    throw new Error(
      '未在 ZZZ 新闻频道里找到任何「X.Y版本内容一览（上/下期）」文章',
    );
  }

  const {
    version,
    subtitle,
    contentShangqi,
    contentXiaqi,
    gachaShangqi,
    gachaXiaqi,
    intelOverview,
  } = relevant;

  const phaseData: Record<1 | 2, PhaseAccumulator> = {
    1: {
      sAgents: [],
      aAgents: [],
      sEngines: [],
      aEngines: [],
      rawTexts: [],
      activities: [],
    },
    2: {
      sAgents: [],
      aAgents: [],
      sEngines: [],
      aEngines: [],
      rawTexts: [],
      activities: [],
    },
  };

  const detailFetches: Promise<{
    phase: 1 | 2;
    kind: 'content' | 'gacha';
    detail: NewsDetail;
  }>[] = [];
  if (contentShangqi) {
    detailFetches.push(
      fetchDetail(baseUrl, appId, contentShangqi.iInfoId).then((detail) => ({
        phase: 1,
        kind: 'content',
        detail,
      })),
    );
  }
  if (contentXiaqi) {
    detailFetches.push(
      fetchDetail(baseUrl, appId, contentXiaqi.iInfoId).then((detail) => ({
        phase: 2,
        kind: 'content',
        detail,
      })),
    );
  }
  if (gachaShangqi) {
    detailFetches.push(
      fetchDetail(baseUrl, appId, gachaShangqi.iInfoId).then((detail) => ({
        phase: 1,
        kind: 'gacha',
        detail,
      })),
    );
  }
  if (gachaXiaqi) {
    detailFetches.push(
      fetchDetail(baseUrl, appId, gachaXiaqi.iInfoId).then((detail) => ({
        phase: 2,
        kind: 'gacha',
        detail,
      })),
    );
  }
  // 单独抓「情报总览」文章，从里面取本版本首发的 S 级代理人名单。
  // 当前版本一直会有这篇，但万一缺失就保守地把所有 S 级当首发（旧行为）。
  const intelOverviewDetailPromise: Promise<NewsDetail | undefined> =
    intelOverview
      ? fetchDetail(baseUrl, appId, intelOverview.iInfoId).catch(() => undefined)
      : Promise.resolve(undefined);

  const [results, intelOverviewDetail] = await Promise.all([
    Promise.all(detailFetches),
    intelOverviewDetailPromise,
  ]);

  const debutAgentNames = intelOverviewDetail
    ? parseDebutAgentNames(htmlToText(intelOverviewDetail.sContent ?? ''))
    : [];

  for (const { phase, kind, detail } of results) {
    const text = htmlToText(detail.sContent ?? '');
    const bucket = phaseData[phase];
    bucket.rawTexts.push(text);

    if (kind === 'gacha') {
      // 限时频段文章是权威：S/A 名单 + 时间区间都从这里来。
      const sAgents = parseAgents(text, 'S');
      const aAgents = parseAgents(text, 'A');
      const sEngines = parseEngines(text, 'S');
      const aEngines = parseEngines(text, 'A');
      if (sAgents.length) bucket.sAgents = sAgents;
      if (aAgents.length) bucket.aAgents = aAgents;
      if (sEngines.length) bucket.sEngines = sEngines;
      if (aEngines.length) bucket.aEngines = aEngines;
      const { startAt, endAt } = parseTimeRange(text);
      if (startAt) bucket.startAt = startAt;
      if (endAt) bucket.endAt = endAt;
    } else {
      // 内容一览：补 S 级名单（避免限时频段文章缺失时空白）+ 主线 + 活动名。
      if (bucket.sAgents.length === 0) bucket.sAgents = parseAgents(text, 'S');
      if (bucket.sEngines.length === 0) bucket.sEngines = parseEngines(text, 'S');
      const story = parseMainStory(text);
      if (story && !bucket.mainStory) bucket.mainStory = story;
      const acts = parseActivities(text);
      for (const a of acts) {
        if (!bucket.activities.some((x) => x.name === a.name)) {
          bucket.activities.push(a);
        }
      }
    }
  }

  // 时间兜底：
  //   - phase 1 startAt 拿 (上期) 内容一览的发布时间（== 版本上线日）
  //   - phase 1 endAt 拿 phase 2 startAt
  //   - phase 2 startAt 兜底用 (下期) 内容一览发布时间
  if (!phaseData[1].startAt && contentShangqi) {
    phaseData[1].startAt = parsePubTime(contentShangqi.dtStartTime);
  }
  if (!phaseData[2].startAt && contentXiaqi) {
    phaseData[2].startAt = parsePubTime(contentXiaqi.dtStartTime);
  }
  if (!phaseData[1].endAt && phaseData[2].startAt) {
    phaseData[1].endAt = phaseData[2].startAt;
  }

  // 组卡池：每个 S 代理人配同位置的 S 音擎 → 一条 banner。
  // 首发 / 复刻判定：banner 上的角色出现在 debutAgentNames（情报总览的「即将
  // 登场」名单）里才算首发。debutAgentNames 解析失败时退化成"全部当首发"。
  // 音擎走启发式：签名音擎跟首发角色绑定，复刻角色不带新音擎。
  const banners: ParsedVersionBanner[] = [];
  let poolIndex = 1;
  for (const phase of [1, 2] as const) {
    const data = phaseData[phase];
    for (let i = 0; i < data.sAgents.length; i += 1) {
      const agent = data.sAgents[i];
      const engine = data.sEngines[i];
      const isDebutCharacter =
        debutAgentNames.length === 0 ||
        debutAgentNames.some((n) => sameAgentName(n, agent.name));
      banners.push({
        phase,
        poolIndex,
        poolName: phase === 1 ? '第一期限时频段' : '第二期限时频段',
        characterName: agent.name,
        characterRarity: agent.rarity,
        characterElement: agent.element,
        // ZZZ 用"特性"（命破/强攻/防护/支援/异常）描述战斗定位，
        // 复用 characterPath 字段（语义上对应星穹铁道的"命途"）。
        characterPath: agent.spec,
        isNewCharacter: isDebutCharacter,
        lightConeName: engine?.name,
        lightConeRarity: engine?.rarity,
        isNewLightCone: isDebutCharacter && !!engine,
        startAt: data.startAt,
        endAt: data.endAt,
        rawTime:
          data.startAt && data.endAt
            ? `${formatBeijing(data.startAt)} ~ ${formatBeijing(data.endAt)}`
            : undefined,
        rawRoleInfo: summarizeAgents(data),
        rawConeInfo: summarizeEngines(data),
      });
      poolIndex += 1;
    }
  }

  // 组事件：A 级代理人 + 主线 + 活动。
  // 注意：A 级在 ZZZ 限时频段里基本都是"现有角色调频复刻"，不是新角色。早期错误地
  // 用 category='character' 让它们落到前端"新角色" section + 贴"新角色"徽章，是
  // 误导。改用 category='other' 把它们落到"其他更新" section，标签明确写
  // "A 级 · 第N期 · 调频"，不再误标为新角色。
  // category='character' 留给 homepage-mi18n 模式里 cha_name_* 这种真新角色场景。
  const events: ParsedVersionEvent[] = [];
  for (const phase of [1, 2] as const) {
    const data = phaseData[phase];
    const phaseLabel = phase === 1 ? '第一期' : '第二期';
    for (const a of data.aAgents) {
      const attrPart = a.element
        ? `${a.element}·${a.spec ?? ''}`
        : (a.spec ?? '');
      events.push({
        category: 'other',
        name: a.name,
        label: `A 级 · ${phaseLabel} · 调频`,
        info: attrPart || undefined,
      });
    }
    if (data.mainStory) {
      events.push({
        category: 'story',
        name: data.mainStory.name,
        label: data.mainStory.label ?? `主线（${phaseLabel}）`,
      });
    }
    for (const act of data.activities) {
      events.push({
        category: 'event',
        name: act.name,
        label: act.label ?? phaseLabel,
      });
    }
  }

  const coverSource = contentShangqi ?? intelOverview ?? contentXiaqi;
  const coverUrl = coverSource ? getBannerUrl(coverSource) : undefined;
  const primaryArticle = contentShangqi ?? intelOverview ?? contentXiaqi;
  const officialUrl = primaryArticle
    ? `https://zzz.mihoyo.com/news/${primaryArticle.iInfoId}`
    : landingUrl;
  const releaseAt = phaseData[1].startAt;

  const rawJson = JSON.stringify(
    {
      version,
      subtitle,
      sourceArticles: {
        contentShangqi: contentShangqi?.iInfoId,
        contentXiaqi: contentXiaqi?.iInfoId,
        gachaShangqi: gachaShangqi?.iInfoId,
        gachaXiaqi: gachaXiaqi?.iInfoId,
        intelOverview: intelOverview?.iInfoId,
      },
      phases: {
        1: serializePhase(phaseData[1]),
        2: serializePhase(phaseData[2]),
      },
    },
    null,
    2,
  );

  return {
    version,
    subtitle,
    coverUrl,
    officialUrl,
    providerUrl: landingUrl,
    releaseAt,
    rawJson,
    banners,
    events,
  };
}

// ====== HTTP ============================================================

function parseEndpoint(landingUrl: string): {
  appId: string;
  chanId: number;
  baseUrl: string;
} {
  const url = new URL(landingUrl);
  const pathMatch = url.pathname.match(
    /\/content_v2_user\/app\/([0-9a-f]+)\//i,
  );
  const appId = pathMatch?.[1] ?? DEFAULT_APP_ID;
  const chanIdRaw = url.searchParams.get('iChanId');
  const chanId = chanIdRaw ? Number(chanIdRaw) : DEFAULT_CHAN_ID;
  return {
    appId,
    chanId: Number.isFinite(chanId) ? chanId : DEFAULT_CHAN_ID,
    baseUrl: `${url.protocol}//${url.host}`,
  };
}

async function fetchList(
  baseUrl: string,
  appId: string,
  chanId: number,
  page: number,
): Promise<NewsListItem[]> {
  const url = `${baseUrl}/content_v2_user/app/${appId}/getContentList?iChanId=${chanId}&sLangKey=zh-cn&iPageSize=${PAGE_SIZE}&iPage=${page}`;
  const { data } = await axios.get<ApiResponse<{ list?: NewsListItem[] }>>(
    url,
    {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: 'https://zzz.mihoyo.com/news',
      },
      timeout: 20000,
    },
  );
  if (data.retcode !== 0) {
    throw new Error(
      `ZZZ getContentList(channel=${chanId}, page=${page}) 失败: ${data.message ?? data.retcode}`,
    );
  }
  return data.data?.list ?? [];
}

async function fetchDetail(
  baseUrl: string,
  appId: string,
  iInfoId: number,
): Promise<NewsDetail> {
  const url = `${baseUrl}/content_v2_user/app/${appId}/getContent?iInfoId=${iInfoId}&sLangKey=zh-cn`;
  const { data } = await axios.get<ApiResponse<NewsDetail>>(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Referer: 'https://zzz.mihoyo.com/news',
    },
    timeout: 20000,
  });
  if (data.retcode !== 0 || !data.data) {
    throw new Error(
      `ZZZ getContent(iInfoId=${iInfoId}) 失败: ${data.message ?? data.retcode}`,
    );
  }
  return data.data;
}

// ====== article filtering ===============================================

function findRelevantArticles(items: NewsListItem[]):
  | {
      version: string;
      subtitle?: string;
      contentShangqi?: NewsListItem;
      contentXiaqi?: NewsListItem;
      gachaShangqi?: NewsListItem;
      gachaXiaqi?: NewsListItem;
      intelOverview?: NewsListItem;
    }
  | undefined {
  type Tagged = { item: NewsListItem; version: string; phase: '上' | '下' };
  const contentArticles: Tagged[] = [];
  const gachaArticles: Tagged[] = [];
  for (const item of items) {
    const cm = item.sTitle.match(
      /(\d+\.\d+)\s*版本内容一览\s*[（(]\s*([上下])\s*期\s*[)）]/,
    );
    if (cm) {
      contentArticles.push({ item, version: cm[1], phase: cm[2] as '上' | '下' });
      continue;
    }
    const gm = item.sTitle.match(
      /(\d+\.\d+)\s*版本限时频段\s*[（(]\s*([上下])\s*期\s*[)）]/,
    );
    if (gm) {
      gachaArticles.push({ item, version: gm[1], phase: gm[2] as '上' | '下' });
    }
  }
  if (contentArticles.length === 0) {
    return undefined;
  }
  const versionsSeen = [...new Set(contentArticles.map((c) => c.version))].sort(
    (a, b) => parseFloat(b) - parseFloat(a),
  );
  const version = versionsSeen[0];

  const contentShangqi = contentArticles.find(
    (c) => c.version === version && c.phase === '上',
  )?.item;
  const contentXiaqi = contentArticles.find(
    (c) => c.version === version && c.phase === '下',
  )?.item;
  const gachaShangqi = gachaArticles.find(
    (g) => g.version === version && g.phase === '上',
  )?.item;
  const gachaXiaqi = gachaArticles.find(
    (g) => g.version === version && g.phase === '下',
  )?.item;
  // 「情报总览丨《绝区零》X.Y 版本「副标题」」用作 subtitle / cover 兜底。
  const intelOverview = items.find(
    (it) =>
      it.sTitle.includes('情报总览') &&
      it.sTitle.includes(`${version} 版本`) ===
        it.sTitle.includes(`${version} 版本`), // tolerant: just contain version + 情报总览
  );

  const subtitleSource = intelOverview ?? contentShangqi ?? contentXiaqi;
  let subtitle: string | undefined;
  if (subtitleSource) {
    // 优先「副标题」（情报总览）
    const m1 = subtitleSource.sTitle.match(/「([^」]+)」/);
    if (m1) {
      subtitle = stripWhitespace(m1[1]);
    } else {
      // 退到「<subtitle>丨X.Y版本内容一览...」
      const m2 = subtitleSource.sTitle.match(/^([^丨|]+)[丨|]/);
      if (m2) subtitle = stripWhitespace(m2[1]);
    }
  }

  return {
    version,
    subtitle,
    contentShangqi,
    contentXiaqi,
    gachaShangqi,
    gachaXiaqi,
    intelOverview,
  };
}

// ====== text parsing ====================================================

function parseAgents(text: string, level: 'S' | 'A'): AgentInfo[] {
  const rarity: 4 | 5 = level === 'S' ? 5 : 4;
  // 抓 "S级代理人[...]、[...]、[...]" 这一片段，再从里面把 [] 内的内容拆出来。
  // 段尾用 "S级音擎" / "A级代理人" / "A级音擎" / 句号 / 空行收住，避免越界。
  const sectionRe = new RegExp(
    `${level}\\s*级代理人\\s*((?:[\\[【]\\s*[^\\[\\]【】]+?\\s*[\\]】]\\s*[、，,和与以及]*\\s*)+)`,
  );
  const match = text.match(sectionRe);
  if (!match) return [];
  return parseBracketList(match[1]).map((raw) => parseAgentToken(raw, rarity));
}

function parseEngines(text: string, level: 'S' | 'A'): EngineInfo[] {
  const rarity: 4 | 5 = level === 'S' ? 5 : 4;
  const sectionRe = new RegExp(
    `${level}\\s*级音擎\\s*((?:[\\[【]\\s*[^\\[\\]【】]+?\\s*[\\]】]\\s*[、，,和与以及]*\\s*)+)`,
  );
  const match = text.match(sectionRe);
  if (!match) return [];
  return parseBracketList(match[1]).map((raw) => parseEngineToken(raw, rarity));
}

function parseBracketList(section: string): string[] {
  const out: string[] = [];
  const re = /[\[【]\s*([^\[\]【】]+?)\s*[\]】]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section)) !== null) {
    out.push(m[1]);
  }
  return out;
}

function parseAgentToken(raw: string, rarity: 4 | 5): AgentInfo {
  // "星徽·比利(物理·命破)" 或 "奥菲丝&「鬼火」(火·强攻)"
  const m = raw.match(/^(.+?)\s*[（(]\s*([^()）]+?)\s*[)）]\s*$/);
  if (!m) {
    return { name: stripWhitespace(raw), rarity };
  }
  const name = stripWhitespace(m[1]);
  const attrs = m[2]
    .split(/[·•・]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return { name, element: attrs[0], spec: attrs[1], rarity };
}

function parseEngineToken(raw: string, rarity: 4 | 5): EngineInfo {
  // "辉骑面铠(命破)" — 音擎的括号里只有特性，没有属性
  const m = raw.match(/^(.+?)\s*[（(]\s*([^()）]+?)\s*[)）]\s*$/);
  if (!m) {
    return { name: stripWhitespace(raw), rarity };
  }
  return { name: stripWhitespace(m[1]), spec: stripWhitespace(m[2]), rarity };
}

function parseTimeRange(text: string): { startAt?: Date; endAt?: Date } {
  const m = text.match(
    /(\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2})\s*[~～\-–—]\s*(\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2})/,
  );
  if (!m) return {};
  return {
    startAt: parseMihoyoDateTime(m[1]),
    endAt: parseMihoyoDateTime(m[2]),
  };
}

function parseActivities(text: string): ActivityInfo[] {
  // 「主题活动 / 限时活动 / 签到活动 / 网页活动 / 活动」「name」
  const out: ActivityInfo[] = [];
  const labeledRe =
    /(主题活动|限时活动|签到活动|网页活动|主题玩法)\s*「([^」]+)」/g;
  let m: RegExpExecArray | null;
  while ((m = labeledRe.exec(text)) !== null) {
    out.push({ name: stripWhitespace(m[2]), label: m[1] });
  }
  return out;
}

/**
 * 从「情报总览」文章正文里解析本版本首发的 S 级代理人名单。
 *   "S级代理人「普罗米娅」「星徽·比利」即将登场"        → ['普罗米娅', '星徽·比利']
 *   "S级代理人「普罗米娅」&「星徽·比利」即将登场"        → ['普罗米娅', '星徽·比利']
 *   "S级代理人「普罗米娅」、「星徽·比利」即将登场"       → ['普罗米娅', '星徽·比利']
 * 名单为空说明米哈游换措辞了或文章里只有图片没文字，调用方应保守处理。
 */
function parseDebutAgentNames(text: string): string[] {
  // 用 [^「」即将]*? 当分隔符，把 &、顿号、和、与、空格等所有可能的连接词都吞掉，
  // 同时禁止跨越 "即将" 这两个字以免误吞太多。
  const sectionRe =
    /S\s*级代理人((?:[^「」即将]*?「[^」]+」)+)[^「」即将]*?即将登场/;
  const section = text.match(sectionRe);
  if (!section) return [];
  const out: string[] = [];
  const re = /「([^」]+)」/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section[1])) !== null) {
    out.push(stripWhitespace(m[1]));
  }
  return out;
}

function sameAgentName(a: string, b: string): boolean {
  // 容忍空白与中英文 & / 不同写法的差异。
  const norm = (s: string) =>
    stripWhitespace(s).replace(/[\s&＆]+/g, '');
  return norm(a) === norm(b);
}

function parseMainStory(text: string): ActivityInfo | undefined {
  const m = text.match(/(?:主线新章|主线章节|新主线|主线剧情)「([^」]+)」/);
  if (!m) return undefined;
  return { name: stripWhitespace(m[1]), label: '主线' };
}

function htmlToText(html: string): string {
  const noTag = html.replace(/<[^>]+>/g, ' ');
  // 先解码常见 entity（特别是 &amp; → "&"，否则 "奥菲丝&「鬼火」" 会变 "奥菲丝 「鬼火」"），
  // 然后再把剩余不认识的 &xxx; 当空格吞掉。
  const decoded = noTag
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-zA-Z]+;/g, ' ');
  return decoded.replace(/\s+/g, ' ').trim();
}

// ====== helpers =========================================================

function getBannerUrl(item: NewsListItem | NewsDetail): string | undefined {
  if (!item.sExt) return undefined;
  let ext: unknown;
  try {
    ext = JSON.parse(item.sExt);
  } catch {
    return undefined;
  }
  if (ext && typeof ext === 'object') {
    const banner = (ext as Record<string, unknown>)['news-banner'];
    if (Array.isArray(banner) && banner[0] && typeof banner[0] === 'object') {
      const url = (banner[0] as Record<string, unknown>).url;
      if (typeof url === 'string') return url;
    }
  }
  return undefined;
}

function parsePubTime(value: string): Date | undefined {
  if (!value) return undefined;
  // value 形如 "2026-05-06 11:00:00"，按北京时间解释。
  const iso = `${value.replace(' ', 'T')}+08:00`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatBeijing(date: Date): string {
  // 把 Date 按 UTC+8 渲染成 "YYYY/MM/DD HH:MM"
  const shifted = new Date(date.getTime() + 8 * 3600 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  return `${y}/${m}/${d} ${hh}:${mm}`;
}

function summarizeAgents(data: PhaseAccumulator): string {
  const fmt = (a: AgentInfo) =>
    a.element ? `${a.name}(${a.element}·${a.spec ?? ''})` : a.name;
  return `S级 ${data.sAgents.map(fmt).join('、') || '—'}；A级 ${data.aAgents.map(fmt).join('、') || '—'}`;
}

function summarizeEngines(data: PhaseAccumulator): string {
  const fmt = (e: EngineInfo) => (e.spec ? `${e.name}(${e.spec})` : e.name);
  return `S级 ${data.sEngines.map(fmt).join('、') || '—'}；A级 ${data.aEngines.map(fmt).join('、') || '—'}`;
}

function serializePhase(data: PhaseAccumulator): Record<string, unknown> {
  return {
    startAt: data.startAt?.toISOString(),
    endAt: data.endAt?.toISOString(),
    sAgents: data.sAgents,
    aAgents: data.aAgents,
    sEngines: data.sEngines,
    aEngines: data.aEngines,
    mainStory: data.mainStory,
    activities: data.activities,
  };
}
