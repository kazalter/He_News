# 下一轮 Claude 接力说明（HE_News，Windows）

> 这一轮把绝区零接进版本计划 + 资讯流，并做了一次架构审计。下一轮的目标是按
> 审计 backlog 修架构债，让加新游戏不再痛苦。本文档假设你刚开一个新的 Claude
> 会话、只能 Read 这份 md 起手 —— 写得**自包含**，没读过上一轮也能续。

## 1. 仓库与开发环境

- 工作目录：`C:\Users\25768\Desktop\HE_News_repo`（已初始化 git，clone 自
  `github.com/kazalter/He_News`）。
- 老的 `C:\Users\25768\Desktop\HE_News` 是上一轮迁移前的旧目录壳，内容已清空，
  但 Windows 文件句柄锁着删不掉 —— 不用管，重启后用户自删。**所有命令都对
  HE_News_repo 操作，不要碰 HE_News**。
- Windows + PowerShell 5.1（不要 cd && 串）。具体 shell 路由策略见全局
  `~/.claude/CLAUDE.md`（pwsh 7 已装，需要 `&&` / 三元 / UTF-8 时走 pwsh）。
- Node.js 24.15 已装。**包管理器是 npm**（项目里 lockfile 是
  `package-lock.json`，不是 pnpm；handoff_zzz.md 里写 pnpm 是 Linux 那边的
  习惯，别照搬）。
- git identity 在 Windows 这边没配。提交时**临时**用 `git -c user.name=huangyunhe
  -c user.email=huangyunhe233@gmail.com commit ...`（不要写 global config）。
- 本地 dev：后端 `npm --prefix backend run start:dev`（3000），前端
  `npm --prefix frontend run dev -- --host 127.0.0.1`（5173）。或者一键
  `scripts/start-dev.ps1` / `start-dev.bat`。

## 2. 这一轮做完的事（git log）

```
34e9ae3 绝区零 A 级代理人不再被误标为「新角色」
f0df93b 版本计划 banner 标签按游戏切换：星穹铁道叫光锥，绝区零叫音擎
c34d94b 绝区零（ZZZ）首发/复刻判定，不再全部都是新角色
01ad469 绝区零（ZZZ）资讯接入 + 修复 content_v2 域名硬编码
764c40c 绝区零（ZZZ）改走新闻 API，取得完整卡池/角色/音擎/时间
72481a1 绝区零（ZZZ）版本前瞻初步接入
2497663 docs: 添加绝区零（ZZZ）交接说明      ← 这份是 Linux 上一轮的，已过期
9c93e2b 初始提交：游戏资讯聚合 HE_News
```

工作树干净（`git status` 无变更）。`main` 与 `origin/main` 是否同步：**上一轮所有
ZZZ 提交都是本地的，没 push**。要不要 push 由用户决定。

## 3. 当前数据状态（用户在浏览器看到的）

通过 `node` 直连 Prisma 审计（脚本是临时的，跑完即删）：

```
Games: 2     Sources: 3     Articles: 72
Plans: 2     Banners: 8     Events: 18     Codes: 0

崩坏：星穹铁道 (honkai-star-rail)
  Sources (1):
    [mihoyo-content-v2] 星穹铁道官网资讯
      channels=256,257,258
  Articles: 30  (announcement 1 / event 7 / other 7 / preview 6 / redeem_code 5 / update 4)
  VersionPlans: 1  → 4.3「沉于生者的忘川」 banners=4 events=11

绝区零 (zenless-zone-zero)
  Sources (2):
    [mihoyo-zzz-news-version] 绝区零·版本卡池（新闻 API）   iChanId=278
    [mihoyo-content-v2]       绝区零·官网资讯              channels=278,279,280
  Articles: 42  (announcement 1 / event 20 / other 9 / preview 2 / update 10)
  VersionPlans: 1  → 2.8「新·艾利都日落时」 banners=4 events=7
```

## 4. 关键架构概念（10 秒过一遍）

```
Source ─crawl→ Article(s)       ：mihoyo-content-v2、rss、html…
Source ─crawl→ VersionPlan      ：mihoyo-version-special、mihoyo-zzz-news-version
```

后端 NestJS + Prisma + SQLite。前端 Vue3 + Pinia + Element Plus + Vite。

`backend/src/crawler/`：
- `crawler.service.ts`：分派入口。按 `source.type` 选 fetcher / parser；upsert
  Article / VersionPlan / Banner / Event。
- `parsers/mihoyo-version-special/`：HSR + ZZZ 首页 mi18n（puzzle 落地页）。dispatch 在
  `index.ts`，按 URL host/path 路由到 `hkrpg.ts` 或 `nap.ts`。
- `parsers/zzz-news-version/`：ZZZ 新闻 API parser。**真正在用的 ZZZ 卡池数据来源**。
  靠正则解析中文公告文本，详见文件顶部注释。

前端 `frontend/src/utils/gameMeta.ts`：游戏 key/中文名/颜色/武器叫法的注册中心。
现有 7 个 key：`genshin / hsr / zzz / wuwa / ark / r1999 / bluearchive`。

## 5. 待办 Backlog（按优先级，已审计过）

> 这是这一轮最后一步审计的结论。下一轮可以直接照着挑做。
> ROI 排序：`#5 架构抽象 > #1 调度器 > #8 测试`。

### P0 · 功能性问题（影响日常使用）

**#1. 没有 scheduler，`crawlIntervalMinutes` 是装饰**
- 字段存在但代码库零调度器（没装 `@nestjs/schedule`）。所有更新只在手动 POST
  `/api/sources/:id/crawl` 时发生。
- 修：`npm i @nestjs/schedule`，在 `crawler/` 下新建 `CrawlerScheduler`，每分钟扫
  `enabled=true && now - lastCrawledAt >= crawlIntervalMinutes * 60s` 的 source，
  串行调 `CrawlerService.crawlSource(id)`。注意 Windows nest start:dev 子进程
  退出问题（`main.ts` 已经有 `enableShutdownHooks` + SIGINT/SIGTERM 处理）。

**#2. HSR 缺 version-special source**
- HSR 只有一条 mihoyo-content-v2 资讯 source，**没有任何 version-special**。
- 现在 HSR 的 4.3 数据是 Linux 上 seed 的"标本"，`lastSyncedAt=2026-05-27`，
  从此再不刷新。
- 修：给 HSR 加 `mihoyo-version-special` source（URL 是当前版本前瞻专题，比如
  `https://act.mihoyo.com/puzzle/hkrpg/eXXXXXX/index.html`）。或者更通用——为
  HSR 也写 news-API 版（appId 是 `1963de8dc19e461c`）。

**#3. `getMihoyoChannelIds` 默认是 HSR 频道**
- [`crawler.service.ts:480`](backend/src/crawler/crawler.service.ts) 没 `channels=` 参数时
  fallback `[256, 257, 258]`。新游戏接入忘写 channels 会查到 HSR 数据。
- 修：缺 channels 直接 throw；或按 appId 派生默认。

**#4. 兑换码提取规则太严，几乎从不出码**
- HSR 5 篇文章被分类为 `redeem_code`，但 `RedeemCode` 表 **0 条**。ZZZ 同。
- `classification.service.ts` 的 `hasRedeemCodeContext` 要求码前后 160 字符内出现
  "兑换码|礼包码|..." 关键词，米哈游公告排版常常码和说明隔太远。
- 修：把窗口放到 400-500 字符；或者当文章 category 已经是 redeem_code 时直接放宽。

### P1 · 架构债（加新游戏前应该解）

**#5. ⭐ 游戏知识点散落 7 处** — 加一个鸣潮要改：

| 文件 | 改什么 |
|---|---|
| `backend/src/crawler/crawler.service.ts:~493` | `getMihoyoNewsBaseUrl` appId → 域名 |
| `frontend/src/utils/gameMeta.ts:3-22` | `gameKeys` + `gameMetas` |
| `frontend/src/utils/gameMeta.ts:25-35` | `resolveGameKey` 关键词分支 |
| `frontend/src/utils/gameMeta.ts:61-66` | `WEAPON_TERMS`（光锥/音擎/武器） |
| `frontend/src/styles/tokens.css:24-30` | `--game-<key>` 颜色 |
| `backend/src/sources/dto/create-source.dto.ts:22-32` | source type 白名单 |
| `frontend/src/views/SourcesView.vue:25-27` | source type 下拉 |

**+ 写一个新 parser**（每个游戏数据源结构都不一样）。

- 修法（推荐）：搞一个 `games-registry`（前后端各一份或共享 npm 包），entry 形如：
  ```typescript
  { key: 'zzz', name: '绝区零', color: '#c7a547', weapon: '音擎',
    keywords: ['zzz','zenless','绝区'],
    mihoyo: { appId: '706fd13a87294881', newsBaseUrl: 'https://zzz.mihoyo.com',
              channels: { news: 278, announce: 279, event: 280 } } }
  ```
  以后加游戏 = 加一行 + 写 parser。

**#6. Source type 白名单要爆炸**
- 现 9 个；ZZZ 单独占了 `mihoyo-zzz-news-version`。原神/鸣潮再来还要新增。
- 修：把所有 mihoyo 旁支合并到 `mihoyo-version-special`，dispatch 内部按 URL
  自动选 parser（首页 mi18n / news API / puzzle 页 等）。对外只暴露一个 type。

**#7. Schema 字段名是 HSR 黑话**
- `VersionPlanBanner.lightConeName/Rarity/isNewLightCone` 字面就是"光锥"。ZZZ
  写音擎进去能用但语义别扭。
- 修：`prisma migrate` 迁成 `weaponName / weaponRarity / isNewWeapon`，全局 rename。
  当前提交少，越早做越轻。

**#8. ZZZ news-version parser 整个吃中文措辞**
- 全靠正则 `X.Y版本内容一览（上/下期）` + `S级代理人「X」「Y」即将登场`。1.0–2.8
  这个模板没变，但米哈游某次换栏目名就会 silently 全空。
- 修：
  1. 把 [`backend/test/fixtures/zzz-v2.8-mi18n-zh-cn.json`](backend/test/fixtures/) 旁
     补 4 篇文章 JSON（contentShangqi/Xiaqi/gachaShangqi/Xiaqi 各 1 份），
  2. 写 jest 单测覆盖 `parseDebutAgentNames` / `parseAgents` / `parseEngines` /
     `parseTimeRange` 等。崩了能立刻知道。

### P2 · Bug / 小毛病

**#9. `findRelevantArticles` 有个永远为 true 的判断**
- [`zzz-news-version/index.ts:468-473`](backend/src/crawler/parsers/zzz-news-version/index.ts)：
  ```typescript
  it.sTitle.includes(`${version} 版本`) ===
    it.sTitle.includes(`${version} 版本`)   // ← A === A 恒真
  ```
  intent 是"标题包含 X.Y 版本字样"，结果是恒真。当前没事是因为第一页只有 2.8 的
  情报总览，但版本切换时会拾到旧版本的，subtitle/cover 串味。
- 修：单边 `it.sTitle.includes(`${version}`) && it.sTitle.includes('版本')`。

**#10. e2e 测试是 nest cli 默认模板**
- `backend/test/app.e2e-spec.ts` 期望 `GET /` 返回 `"Hello World!"`，但 app 没这条
  路由。`npm run test:e2e` 跑必挂。从未跑过所以没人发现。
- 修：删掉，或改成测真实端点（如 `GET /api/games` 返回 200）。

**#11. `mihoyo-version-special` 现在没人用**
- 两个游戏都不指向它。dispatch 还在但实际无源。
- 修：要么删（同时把 `parsers/mihoyo-version-special/` 整个删，nap.ts 已被
  zzz-news-version 取代），要么留作文档示例。注意 `hkrpg.ts` 还能用，HSR 接
  version-special 时会用上 —— 别误删。

**#12. ZZZ phase 1 A 级代理人丢了**
- 2.8 的「2.8版本限时频段（上期）」文章已经被推下 page 1。parser 只翻 2 页，找不到。
  现在 UI 只看到 phase 2 的 A 级（潘引壶、狛野真斗），phase 1 的看不到。
- 修：用 sTitle 精确搜索时按需翻更多页；或接受"过版本中段时旧期数据不可达"。

**#13. 分类器对版本卡池文章分得乱**
- "2.8版本限时频段（下期）" → `event`（关键词"限时"先匹中），但语义是 `preview`。
- 修：分类器加一条 `'限时频段' → preview`，或 `'版本' && '频段' → preview`，
  注意顺序放在 `'活动'`/`'限时'` 之前。

### P3 · 想做也行

- ZZZ S 级代理人 rarity 写死 5，A 级 4。ZZZ 没有星级（用 S/A/B 等级），但
  5★ 显示已成习惯。要纯净的话改成 `characterGrade: 'S' | 'A' | 'B'`，前端
  按游戏 key 渲染成"5★"或"S 级"。
- ZZZ 频道 `VERSION_INFO=783` 抓到但没用上，实测只有 1 篇 2024 年存货，丢了无妨。
- README/PROJECT_PLAN 没更新，新加的两个 source type、frontend
  weaponLabel/ZZZ 接入都没写进 docs。

## 6. Pitfalls / 容易踩的坑

1. **不要在 Bash 工具里 `cd dir && cmd`**，那是 Git Bash 但 PATH 缺 `tail`/`cat`
   等 GNU utils。后台跑 npm 用 `npm --prefix <path> run ...`，或直接调 PowerShell
   工具。
2. **不要假设 dev server 在跑**。这一轮起手测的时候用户说"跑起来了"但端口 3000
   实际是空的（他在老目录里起的）。重要操作前 `curl localhost:3000/api/games`
   先验证。
3. **dev.db 在 .gitignore 里**，clone 仓库不会带数据。需要本地数据时要么用
   `npx prisma migrate dev` 初始化空库，要么从有数据的旧目录拷 dev.db 过来
   （Schema 一致才行）。
4. **修 parser 后**：先 `npm --prefix backend run build` 验证 TS 通过，再用
   "起一个临时 Nest application context 调 CrawlerService" 的脚本 reseed
   （上一轮用过这套，写完即删；模板见上一轮 commit history 里的零散脚本）。
5. **Windows git autocrlf 警告**："LF will be replaced by CRLF" 是正常的，
   忽略即可。不是 bug。
6. **commit message 用中文**，遵循现有风格（短标题 + 空行 + 段落 + 末尾
   `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`）。

## 7. 推荐下一轮的开局

按 ROI：

1. 先做 **#5（games-registry）** + **#7（schema rename → weapon\*）**——
   这两个一起做，因为 schema rename 时正好顺手清前端类型，省一次大改。预计
   1–2 个 commit。
2. 然后做 **#1（cron scheduler）** —— 让数据自己更新。1 个 commit。
3. 再补 **#8（parser fixture + jest 测试）** —— 给 ZZZ parser 加保险。1 个 commit。
4. P0 的 #2 #3 #4 是顺手能修的小活儿，穿插着做。
5. 真要加新游戏（鸣潮/原神）放最后，前面三件做完之后会轻松得多。

接到这份说明先 `git log --oneline -10` 看本地是不是这 6 个 commit；如果不是
（用户已经做了别的）请先和用户对齐。然后挑一件开始，照常路打开 todo + 干活。
