# 绝区零（ZZZ）接力说明

> 给 Windows 端 Claude Code：Linux 端上一轮在做绝区零（Zenless Zone Zero）接入时进程 OOM 崩了，本地没有任何未提交改动，所有进度都丢了。这份说明描述"现在仓库里到底有什么、还差什么、推荐怎么做"，请按这个上下文接着干。

## 1. 仓库与分支当前状态

- 分支：`main`，已与 `origin/main` 同步（git@github.com:kazalter/He_News.git）
- 只有一个初始提交 `9c93e2b 初始提交：游戏资讯聚合 HE_News`
- 工作区干净，stash 为空，reflog 也只有这一次提交
- 也就是说：**绝区零相关代码/数据都还没开始，从零接力**

## 2. 已有的 ZZZ 痕迹（仅前端占位）

绝区零目前只是前端的一个游戏 key 占位，没有后端实现、没有数据：

- `frontend/src/utils/gameMeta.ts`
  - `gameKeys` 含 `'zzz'`
  - `gameMetas.zzz = { name: '绝区零', shortName: '绝区零', color: '#C7A547' }`
  - `resolveGameKey` 已能识别 `zzz / zenless / 绝区` 关键字
- `frontend/src/styles/tokens.css`：`--game-zzz: #c7a547`
- 后端解析器 `backend/src/crawler/parsers/mihoyo-version-special.parser.ts` 第 46 行 `GAME_PREFIX` 里写了 `nap: 'nap_cn'`（绝区零米哈游内部代号 nap），但解析逻辑本身是按星穹铁道的数据结构写的，没有真正适配 ZZZ

数据库（`backend/prisma/dev.db`）：

- `Game` 表里只有一条 `honkai-star-rail / 崩坏：星穹铁道`
- `VersionPlan` 表里只有一条 `4.3` 版本计划（星穹铁道）
- **没有绝区零的 Game、Source、VersionPlan 记录**

## 3. 解析器为什么不能直接复用

`mihoyo-version-special.parser.ts` 当前的字段全部来自星穹铁道版本前瞻专题的 mi18n 结构：

- `poolList_name_*` / `poolList_time_*` / `poolList_roleInfo_*` / `poolList_coneInfo_*`
- `charList_name_*`（新增角色名单）
- `coneList_name_*`（新增**光锥**名单 — 这是星穹铁道概念，绝区零叫**音擎 W-Engine**）
- 数据库 `VersionPlanBanner` 也直接写死了 `lightConeName / lightConeRarity / isNewLightCone`

绝区零的版本前瞻专题（`nap_cn`）字段命名很可能不一样，至少术语层面"光锥"要替换为"音擎"，还可能有"邦布 Bangboo"维度。所以**第一步不是写代码，是先抓一份真实的 ZZZ mi18n JSON 看字段长什么样**。

## 4. 推荐接力步骤

### Step 1：定位绝区零官方版本前瞻专题 URL

- 米哈游版本专题通常在 `https://act.mihoyo.com/<game>/...` 或 `https://act.hoyolab.com/...`
- 当前最新版本前瞻直播之后，找到那张「特别节目专题」落地页 URL（专题里会引用 `config.<hash>.js`，里面写了 `mi18n.key`）
- 备选：如果国服暂时没专题页，可以用米哈游官方 hoyolab 的英文专题，`GAME_PREFIX` 加一个对应前缀

### Step 2：手动跑一遍现有 parser，让它告诉你字段对不对

- 在 `backend` 下写一个临时脚本（或 `pnpm tsx` / `ts-node`）调 `parseMihoyoVersionSpecial(landingUrl)`，看会在哪一步抛错
- 大概率会在 `extractVersionAndSubtitle` 或 `parseBanners` 抛，因为 ZZZ 的 i18n key 命名不同
- **把抓到的原始 i18n JSON dump 到一个临时文件**，对照里面的 key 设计字段映射

### Step 3：拆分 parser，把"游戏特化"部分抽出来

建议结构：

```
parsers/
  mihoyo-version-special/
    index.ts          // 通用 i18n 拉取 + dispatch
    hkrpg.ts          // 当前 parser 里星穹铁道这一支
    nap.ts            // 新增：绝区零
    shared.ts         // 时间解析、phase 推断这种通用工具
```

返回的 `ParsedVersionPlan` 结构尽量保持兼容，让 `version-plans.service.ts` 不用改。

### Step 4：schema 调整

- `VersionPlanBanner.lightConeName/lightConeRarity/isNewLightCone` 这三个字段**语义上偏星穹铁道**
- 两种选择：
  - **A（推荐，改动小）**：在代码层把"音擎"也写进 `lightCone*` 这三个字段，只在前端展示时按游戏 key 改 label（"光锥" / "音擎"）。schema 不动，无需迁移。
  - **B**：重命名为 `weaponName/weaponRarity/isNewWeapon`，需要写一个 Prisma migration，并改所有引用点（parser、service、前端 `VersionPlansView.vue` 等）。
- 如果 ZZZ 还有"邦布"这类星穹铁道没有的维度，可以另开一张表 `VersionPlanExtra` 或在 `rawJson` 里塞，不要硬塞进 banner 表。

### Step 5：种子数据

在 db 或通过 API 建一条绝区零 Game：

```
slug: zenless-zone-zero
name: 绝区零
iconUrl: （可空）
officialUrl: https://zzz.mihoyo.com/
```

然后挂一个 `version-special` 类型的 Source 指向 Step 1 找到的专题 URL，触发抓取。

### Step 6：前端验证

- `VersionPlansView.vue` 顶部下拉应该自动出现绝区零选项（因为它按 `versionPlans` 渲染）
- `GameTag` 颜色应已是金色 `#C7A547`
- 如果走方案 A，记得把"光锥"在 ZZZ 卡片下渲染成"音擎"

## 5. 启动与验证

- Linux 启动脚本：`scripts/start-dev.ps1`（看名字是 PowerShell，Win 端就直接用）
- 也有根目录 `start-dev.bat`
- 后端：`backend/`，`pnpm install && pnpm prisma migrate dev && pnpm start:dev`
- 前端：`frontend/`，`pnpm install && pnpm dev`
- 默认前端 5174 端口，后端在 `backend-dev-run.log` / `.runtime/backend.out.log` 里能看到端口

## 6. 几个需要先确认的开放问题

请在动手前先和用户确认这几个：

1. **方案 A 还是 B**（复用 `lightCone*` 字段 vs. 重命名为 `weapon*`）？— 影响是否要写 migration
2. **国服专题 URL** 用哪个？还是用 hoyolab 英文专题？
3. **邦布/Bangboo 这一维度**这轮做不做？做的话进 `rawJson` 还是新表？
4. 跑完 parser dump 出 i18n JSON 后，是否要把样本提交进 `backend/test/fixtures/`？

## 7. 已有但容易踩坑的点

- `mihoyo-version-special.parser.ts:130` 默认 fallback 是 `hkrpg_cn`，如果 ZZZ 的 URL 结构里没 `puzzle/<slug>/` 段，会被错误归到星穹铁道。`detectGameKey` 需要按真实 ZZZ URL 重写。
- `estimateReleaseAt` 用的"phase1 endAt - 21 天"是星穹铁道节奏；ZZZ 也是 6 周一版本（42 天，两个 phase 各 21 天），可以沿用，但**先验证一次**再下结论。
- 提交规范：commit message 用中文，末尾按现有风格加 `Co-Authored-By:` 行。

---

接到这份说明先做 Step 1 + Step 2（dump 一份真实 i18n JSON），把字段实际情况贴回给用户再继续，不要直接照猜写。
