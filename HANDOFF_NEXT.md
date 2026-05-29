# 下一轮 Claude 接力说明（HE_News，Windows）

> 上一轮（本文档此版本写于其后）按 ROI 清了一批架构债：banner 字段去黑话、游戏
> 知识点收拢进注册表、加了定时调度器、给 ZZZ parser 补了回归测试。下一轮主要剩
> P0 的两个功能小修 + 几个 bug。本文档假设你刚开一个新 Claude 会话、只能 Read
> 这份 md 起手 —— 写得**自包含**，没读过上一轮也能续。

## 1. 仓库与开发环境

- 工作目录：`C:\Users\25768\Desktop\HE_News`（已初始化 git）。
  **注意**：更早的 handoff 里写过一个 `HE_News_repo`，那是某轮迁移设想，实际并不
  存在；活跃仓库就是 `HE_News` 本身，所有命令都对它操作。
- 远端：`origin = https://github.com/kazalter/He_News.git`。
- Windows + PowerShell 5.1（不要 `cd dir && cmd` 串，Git Bash 那套 PATH 缺
  `tail`/`cat`）。需要 `&&` / 三元 / UTF-8 / 复杂管道时走 pwsh 7（已装，PATH 里
  `pwsh` 直调）。具体 shell 路由见全局 `~/.claude/CLAUDE.md`。
- Node.js 24.15 已装。**包管理器是 npm**（lockfile 是 `package-lock.json`）。
- git identity 在 Windows 这边没配。提交时**临时**带
  `git -c user.name=huangyunhe -c user.email=huangyunhe233@gmail.com commit ...`
  （不要写 global config）。
- 本地 dev：后端 `npm --prefix backend run start:dev`（3000），前端
  `npm --prefix frontend run dev -- --host 127.0.0.1`（5173）。或 `scripts/start-dev.ps1`。
- 测试：`npm --prefix backend test`（jest，单测在 `src/**/*.spec.ts`）。
  `npm --prefix backend run build`（nest build）/ `npm --prefix frontend run build`
  （vue-tsc + vite，前端 build 里 @vueuse 的 PURE-annotation 警告是噪音，忽略）。

## 2. git log（main 领先 origin/main 11 个提交，**全部本地、没 push**）

```
713b987 给 ZZZ 新闻 parser 加回归测试，措辞一变就报错          ← 本轮 #8
98f04c3 加定时调度器，让 crawlIntervalMinutes 真正生效         ← 本轮 #1
2f61483 游戏知识点收拢到注册表，加新游戏不再改一堆地方          ← 本轮 #5（含 #3）
4613592 版本计划 banner 字段去掉「光锥」黑话，统一改成中性的 weapon*  ← 本轮 #7
e648b2f docs: 写下一轮接力说明（HANDOFF_NEXT）
34e9ae3 绝区零 A 级代理人不再被误标为「新角色」
f0df93b 版本计划 banner 标签按游戏切换：星穹铁道叫光锥，绝区零叫音擎
c34d94b 绝区零（ZZZ）首发/复刻判定，不再全部都是新角色
01ad469 绝区零（ZZZ）资讯接入 + 修复 content_v2 域名硬编码
764c40c 绝区零（ZZZ）改走新闻 API，取得完整卡池/角色/音擎/时间
72481a1 绝区零（ZZZ）版本前瞻初步接入
（再往下是 docs 和初始提交）
```

要不要 push 由用户决定。

## 3. 当前数据状态

下面是**上一轮审计快照**（本轮没重新跑 Prisma 审计，但加了调度器后数据可能已经
被自动抓取刷新过——见下方「调度器」提醒）。Schema 这轮唯一变化是 banner 的
`lightCone* → weapon*` 改名（数据原地保留，没丢）。

```
崩坏：星穹铁道 (honkai-star-rail)
  Sources (1): [mihoyo-content-v2] channels=256,257,258
  VersionPlans: 1 → 4.3「沉于生者的忘川」 banners=4 events=11
  （这份 4.3 是 Linux 上 seed 的「标本」，没有 version-special source，见 backlog #2）

绝区零 (zenless-zone-zero)
  Sources (2):
    [mihoyo-zzz-news-version] 绝区零·版本卡池（新闻 API）  iChanId=278
    [mihoyo-content-v2]       绝区零·官网资讯             channels=278,279,280
  VersionPlans: 1 → 2.8「新·艾利都日落时」 banners=4 events=7
```

> **dev.db 在 .gitignore 里**，clone 不带数据。要本地数据：`npx prisma migrate dev`
> 建空库，或从有数据的目录拷 dev.db（schema 一致才行）。

## 4. 关键架构概念（10 秒过一遍）

```
Source ─crawl→ Article(s)       ：mihoyo-content-v2、rss、html…
Source ─crawl→ VersionPlan      ：mihoyo-version-special、mihoyo-zzz-news-version
```

后端 NestJS + Prisma + SQLite。前端 Vue3 + Pinia + Element Plus + Vite。

`backend/src/crawler/`：
- `crawler.service.ts`：分派入口。按 `source.type` 选 fetcher/parser；upsert
  Article / VersionPlan / Banner / Event。content_v2 的 appId→域名/默认频道现在
  走 `mihoyo-games.ts` 注册表（未知 appId 直接 throw，不再静默兜底成星铁）。
- `mihoyo-games.ts` ⭐**新（本轮 #5）**：米哈游 content_v2 逐游戏配置
  （appId / newsBaseUrl / defaultChannels）。加米哈游游戏 = 加一条。
- `crawler.scheduler.ts` ⭐**新（本轮 #1）**：`@nestjs/schedule`，每分钟扫一遍
  enabled 的 source，把 `now - lastCrawledAt >= crawlIntervalMinutes` 的串行抓一次。
  `ScheduleModule.forRoot()` 注册在 `app.module.ts`。
- `parsers/mihoyo-version-special/`：HSR + ZZZ 首页 mi18n（puzzle 落地页）。
  `shared.ts` 里 `ParsedVersionBanner` 类型字段是 `weaponName/weaponRarity/isNewWeapon`。
- `parsers/zzz-news-version/`：ZZZ 新闻 API parser（**真正在用的 ZZZ 卡池来源**）。
  靠正则吃中文公告。`index.spec.ts` ⭐**新（本轮 #8）**用 mock axios + 代表性样本
  钉死了它的解析行为，导出了 `__testables`（仅供单测）。

前端 `frontend/src/utils/gameMeta.ts` ⭐**本轮 #5 重构成单一注册表**：每个游戏一条
`gameMetas` 记录，含 key/中文名/颜色/`weapon`（武器叫法）/`keywords`（识别关键词），
`resolveGameKey` / `weaponLabel` / `gameKeys` 全从它派生。**加一个游戏 = 加一条**
（颜色不用再动 tokens.css，那里的 `--game-*` 死变量已删）。非米哈游游戏（如鸣潮）
还要新 source type + fetcher + parser。

## 5. 待办 Backlog（已审计；本轮完成项打了 ✅）

### P0 · 功能性问题

- ✅ **#1 定时调度器** —— 已加（`98f04c3`）。
- **#2 HSR 缺 version-special source** —— HSR 只有一条 content_v2 资讯 source，没有
  任何 version-special，4.3 数据是「标本」不会刷新。
  修：给 HSR 加 `mihoyo-version-special` source（当前版本前瞻专题 URL），或为 HSR
  写 news-API 版（appId `1963de8dc19e461c`，已在 mihoyo-games.ts 登记）。
- ✅ **#3 channel 默认是 HSR 频道** —— 已随 #5 修掉（缺 channels 时按 source 自己
  的 appId 从注册表取默认频道；未知 appId 直接 throw）。
- **#4 兑换码提取规则太严，几乎从不出码** —— HSR/ZZZ 有 redeem_code 文章但
  `RedeemCode` 表 0 条。`classification.service.ts` 的 `hasRedeemCodeContext` 要求码
  前后 160 字符内出现「兑换码|礼包码」等关键词，米哈游排版常常隔太远。
  修：窗口放到 400–500 字符；或 category 已是 redeem_code 时直接放宽。

### P1 · 架构债

- ✅ **#5 游戏知识点散落** —— 已收拢进前后端注册表（`2f61483`）。
- **#6 Source type 白名单要爆炸** —— 现有 9 个，ZZZ 单独占了
  `mihoyo-zzz-news-version`。修：把所有 mihoyo 旁支合并到 `mihoyo-version-special`，
  dispatch 内部按 URL 自动选 parser，对外只暴露一个 type。涉及
  `sources/dto/create-source.dto.ts` 白名单 + `frontend/src/views/SourcesView.vue` 下拉。
- ✅ **#7 Schema 字段名是 HSR 黑话** —— 已 rename 成 `weapon*`（`4613592`）。
- ✅ **#8 ZZZ parser 整个吃中文措辞** —— 已补回归测试（`713b987`）。

### P2 · Bug / 小毛病

- **#9 `findRelevantArticles` 有个永远为 true 的判断** —— `zzz-news-version/index.ts`
  里 intelOverview 检测写成 `A.includes(x) === A.includes(x)`（恒真），intent 是
  「标题含 X.Y 版本字样」。当前没事是因为第一页只有 2.8，版本切换时会拾到旧版本的、
  subtitle/cover 串味。修：单边 `it.sTitle.includes(version) && it.sTitle.includes('版本')`。
- **#10 e2e 测试是 nest cli 默认模板** —— `backend/test/app.e2e-spec.ts` 期望
  `GET /` 返回 `"Hello World!"`，但没这条路由，`npm run test:e2e` 跑必挂（`npm test`
  不受影响，rootDir 是 src 不含它）。修：删掉或改成测真实端点（如 `GET /api/games`）。
- **#11 `mihoyo-version-special` 现在没人用** —— 两个游戏都不指向它，dispatch 还在
  但无源。`hkrpg.ts` 留着 HSR 接 version-special（#2）时会用上，别误删；可删的是
  `nap.ts`（已被 zzz-news-version 取代）。
- **#12 ZZZ phase 1 A 级代理人丢了** —— parser 只翻 2 页，过版本中段时旧期数据被推
  下 page 1 就找不到。修：按 sTitle 精确搜索时按需翻更多页，或接受不可达。
- **#13 分类器对版本卡池文章分得乱** —— 「2.8版本限时频段（下期）」被分成 event
  （「限时」先匹中），语义应是 preview。修：分类器加 `'限时频段' → preview`，放在
  `'活动'`/`'限时'` 之前。

### P3 · 想做也行

- ZZZ S 级代理人 rarity 写死 5、A 级 4。ZZZ 没星级（用 S/A/B 等级），要纯净的话改
  `characterGrade` 前端按游戏渲染成「5★」或「S 级」。
- README/PROJECT_PLAN 没更新两个新 source type、weapon* rename、注册表、调度器。

## 6. Pitfalls / 容易踩的坑

1. **不要在 Bash 工具里 `cd dir && cmd`**（Git Bash PATH 缺 GNU utils）。后台跑 npm
   用 `npm --prefix <path> run ...`。注意 Bash 工具的 cwd 会在命令间保持。
2. ⭐ **现在起 dev server = 会自动抓取**。加了调度器后，`start:dev` 起来约一分钟内
   就会对「到点」的 source 跑真实抓取（命中线上米哈游 + 写库）。本轮没端到端跑过
   一次真实 tick（只验证了 cron 已注册、DI 干净），第一次真跑就在下次 start:dev。
3. **dev.db 在 .gitignore**，clone 不带数据（见 §3）。
4. **改 Prisma schema 做字段 rename**：`prisma migrate dev` 的自动 diff 会判成
   drop+add **丢数据**（且非交互环境直接报错）。要保数据就**手写迁移**用
   `ALTER TABLE ... RENAME COLUMN`，再 `prisma migrate deploy` + `prisma generate`。
   本轮 #7 就是这么做的，参考 `migrations/20260529120000_rename_lightcone_to_weapon/`。
   动 db 前先 `cp dev.db dev.db.bak`（dev.db.bak 不在 .gitignore，commit 时别带上）。
5. **改 parser 后**：先 `npm --prefix backend run build` 过 TS，再
   `npm --prefix backend test` 跑单测；要验真实抓取可起临时 Nest application context
   调 CrawlerService（写完即删的脚本）。
6. **Windows git autocrlf 警告**（"LF will be replaced by CRLF"）正常，忽略。
7. **commit message 用中文**，遵循现有风格（短标题 + 空行 + 段落 + 末尾
   `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`）。

## 7. 推荐下一轮的开局

剩下的都是中小活，按 ROI：

1. **#2（HSR version-special source）** —— 让 HSR 数据能刷新，价值最高。1 个 commit。
2. **#4（放宽兑换码窗口）** —— 让兑换码真的能出。顺手能验（看 RedeemCode 表）。1 个 commit。
3. **#9（恒真判断）+ #13（分类器 preview）** —— 两个小 bug 一起修，碰的都是 ZZZ
   情报流。#9 改完正好用 #8 的测试框架补一条 case。1 个 commit。
4. **#10（删/改坏 e2e）** —— 顺手清理。
5. **#6（合并 source type）** —— 想再降「加游戏成本」时做；动 DTO + 前端下拉 + dispatch。
6. 真要加新游戏（鸣潮/原神）放最后：米哈游游戏现在 = gameMeta.ts 加一条 +
   mihoyo-games.ts 加一条 + 写 parser；非米哈游（鸣潮 Kuro）还要新 source type + fetcher。

接到这份说明先 `git log --oneline -12` 看本地是不是这 11 个领先提交；如果不是
（用户已经做了别的或 push/rebase 过）请先和用户对齐。然后挑一件，照常打开 todo 干活。
