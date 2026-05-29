# CLAUDE.md — HE_News 项目指南

游戏官方资讯聚合（私人本地工具）。后端 NestJS + Prisma + SQLite，前端 Vue3 + Pinia +
Element Plus + Vite。这份文件给 Claude 起手用——读完就能续活，不用重新摸架构。
（人类向的用法/启动/API 看 `README.md`；shell 路由策略看全局 `~/.claude/CLAUDE.md`。）

## 开发环境与命令

- 工作目录 `C:\Users\25768\Desktop\HE_News`（git 已初始化，远端 `origin` 在 GitHub）。
- Windows + PowerShell。需要 `&&` / 三元 / UTF-8 / 复杂管道时用 pwsh 7（已装，`pwsh` 直调）。
  **别在 Bash 工具里 `cd dir && cmd`**（Git Bash PATH 缺 GNU utils）；跑 npm 用 `--prefix`。
- 包管理器是 **npm**（lockfile `package-lock.json`）。Node 24。
- 常用命令：
  - 后端 dev：`npm --prefix backend run start:dev`（:3000，API 前缀 `/api`）
  - 前端 dev：`npm --prefix frontend run dev -- --host 127.0.0.1`（:5173）
  - 后端构建/测试：`npm --prefix backend run build` / `npm --prefix backend test`（jest，单测在 `src/**/*.spec.ts`）
  - 前端构建：`npm --prefix frontend run build`（vue-tsc + vite；@vueuse 的 PURE 注释告警是噪音，忽略）
  - seed：`npm --prefix backend run seed`（幂等，见下）
- git identity 没配 global。提交时临时带
  `git -c user.name=huangyunhe -c user.email=huangyunhe233@gmail.com commit ...`。
  commit message 用**中文**（短标题 + 空行 + 段落 + 末尾 `Co-Authored-By:`）。**要不要提交由用户决定**。

## 架构：三条抓取管线

`crawler.service.ts` 是分派入口，按 `source.type` 选 fetcher/parser。`crawler.scheduler.ts`
（`@nestjs/schedule`）每分钟扫一遍 enabled 源，到点（`now - lastCrawledAt >= 间隔`）就串行抓一次。

```
Source ─crawl→ Article(s)     文章管线：rss / html / steam / bilibili / weibo /
                              mihoyo-content-v2 / kurogames-news
                              （文章正文里顺带提兑换码）
Source ─crawl→ VersionPlan    版本前瞻：mihoyo-version-special / mihoyo-zzz-news-version /
                              kurogames-version  （+ banners + events）
Source ─crawl→ RedeemCode(s)  码源（直接出码、不产文章）：game8-codes / bilibili-comments
```

`manual` 是占位类型，不抓取。

### source.type 一览

| type | 管线 | 说明 |
|---|---|---|
| `rss` / `html` / `steam` / `bilibili` / `weibo` | 文章 | 通用 RSS / Cheerio 抓取 |
| `mihoyo-content-v2` | 文章 | 米哈游官网资讯 API，appId→域名/频道走 `mihoyo-games.ts` 注册表 |
| `kurogames-news` | 文章 | 鸣潮官网静态 JSON（`kurogames.ts` 注册表），拉 ArticleMenu + 逐篇正文 |
| `mihoyo-version-special` | 版本 | 星铁等版本前瞻专题 H5（mi18n 落地页） |
| `mihoyo-zzz-news-version` | 版本 | 绝区零卡池，靠正则吃新闻 API 公告 |
| `kurogames-version` | 版本 | 鸣潮「X.Y版本内容说明」长文里正则抽卡池/角色/武器 |
| `game8-codes` | 码源 | game8.co 兑换码聚合页 |
| `bilibili-comments` | 码源 | B站评论区提码 |

### 关键目录

- `crawler/mihoyo-games.ts` — 米哈游 content_v2 逐游戏配置（appId / newsBaseUrl / 默认频道）。
- `crawler/kurogames.ts` — 库洛系（鸣潮）官网静态 JSON 配置（jsonBase / siteBase）+ URL 构造器。
- `crawler/parsers/` — 各 parser；`*-version` 返回 `ParsedVersionPlan`（类型在 `mihoyo-version-special/shared.ts`），`redeem-code/` 返回 `ParsedRedeemCode[]`。
- 兑换码落库走 `persistRedeemCodes`：`@@unique([gameId, code])` 去重 upsert；过期码只降级已有的、不新建。
- 前端 `frontend/src/utils/gameMeta.ts` — **单一游戏注册表**（key/中文名/颜色/武器叫法/识别关键词）。

### 加一个新游戏

1. 前端 `gameMeta.ts` 加一条（颜色/关键词；名字含关键词就能自动识别上色）。
2. 数据：在 `prisma/seed.ts` 里加 Game + 源（或前端 UI 手动加）。
3. 后端 parser：
   - 米哈游游戏 → `mihoyo-games.ts` 加一条，复用现成 parser。
   - 库洛游戏（鸣潮）→ `kurogames.ts` 加一条，复用 `kurogames-news` / `kurogames-version`。
   - 其它 → 写新 source type + fetcher + parser。
4. 码源（game8/bilibili）是 **URL 驱动、与游戏无关**的，直接配源即可，不用写代码。

## seed / 新环境恢复

游戏 + 来源是运行时数据，存在 dev.db 里、**不进 git**。`prisma/seed.ts` 把这份清单做成代码，
幂等补齐**全部三个游戏**（崩铁 / 绝区零 / 鸣潮）的 Game + 各自来源（含 mihoyo content_v2 URL、
zzz 新闻版 iChanId、库洛 jsonBase、game8 码源）。源按 `(gameId, type)` 找已有就更新、没有才建，
重复跑不堆叠（前提：同游戏同 type 只一条源）。**加新游戏 / 来源 = 往 `GAMES` 数组加一条**。

- 日常补数据：`npm --prefix backend run seed`
- 新环境一键：`copy backend/.env.example backend/.env` 后 `npm --prefix backend run setup`
  （= `prisma generate` + `migrate deploy` 建库 + seed；`.env` 也不在 git 里）。

当前 seed 配置：崩铁（content_v2）、绝区零（content_v2 + zzz 新闻版卡池）、鸣潮（kurogames 资讯 + 版本前瞻），三者另各有 game8 码源。数据会被调度器自动刷新。

## Pitfalls

1. **dev server 会自动抓取**：`start:dev` 起来约一分钟内就对到点的源跑真实抓取（命中线上 + 写库）。
2. **dev.db 和 .env 都在 .gitignore**，clone 不带数据。新环境照「seed / 新环境恢复」一节，`copy .env.example .env` 后 `npm run setup` 一键重建。
3. **Prisma 字段 rename 会丢数据**：`migrate dev` 的自动 diff 判成 drop+add。要保数据就手写迁移用 `ALTER TABLE ... RENAME COLUMN`，参考 `migrations/20260529120000_rename_lightcone_to_weapon/`。动 db 前先备份 dev.db（备份文件别 commit）。
4. **`*-version` / `*-news` parser 靠正则吃官方公告的固定中文措辞**，措辞一变会 silently 返回空。改完先 build 过 TS、再跑单测。新 parser 都配了 fixture spec（**内联在 spec 里**，不读外部文件），照此补 case。
5. Windows git autocrlf 的 "LF will be replaced by CRLF" 告警正常，忽略。
