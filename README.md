# HE News

游戏官方资讯聚合（私人本地工具）：多游戏 / 多来源抓取、关键词分类、兑换码提取、版本前瞻。
Vue 3 前端 + NestJS 后端 + SQLite / Prisma。

> 架构 / source 类型 / 开发约定见 `CLAUDE.md`。

## 换电脑 / 新环境初始化

`backend/prisma/dev.db` 和 `.env` 都**不在 git 里**——代码 clone 就有，但"哪些游戏、从哪抓"的记录是空的，要重建：

```powershell
cd backend
npm install
copy .env.example .env
npm run setup        # 建库 + seed（崩铁 / 绝区零 / 鸣潮 三个游戏和来源建回来，幂等可重跑）
npm run start:dev    # :3000，调度器自动开抓
```

前端另开窗口：`cd frontend; npm install; npm run dev`（:5173）。

> 以后新增游戏 / 来源，记得同步写进 `backend/prisma/seed.ts`，换环境才能一键恢复。

## 日常启动

一键 `.\start-dev.bat`（清 3000/5173 端口、合并前后端日志，`Q` 或 `Ctrl+C` 停）。
或分开起：后端 `npm --prefix backend run start:dev`，前端 `npm --prefix frontend run dev`。

前端 http://localhost:5173 ・ 后端 http://localhost:3000 ・ API 前缀 `/api`。

## 首次使用

三个内置游戏已由 seed 配好、可直接抓。手动加内容：游戏页加游戏 → 来源页加来源 → 点行内抓取按钮 → 在信息流看资讯、兑换码页看码。

## API

```txt
GET/POST/PATCH/DELETE  /api/games[/:id]
GET/POST/PATCH/DELETE  /api/sources[/:id]   ・ POST /api/sources/:id/crawl
GET    /api/articles[/:id]                  ・ PATCH /api/articles/:id/{read,favorite}
GET    /api/codes                           ・ PATCH /api/codes/:id/status
GET    /api/crawl-logs
```
