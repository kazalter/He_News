# HE News

游戏官方资讯聚合 Web 端。前端使用 Vue 3，后端使用 NestJS，数据库使用 SQLite + Prisma。

## 当前已完成

- 项目计划书：`PROJECT_PLAN.md`
- Vue 3 前端工程
- NestJS 后端工程
- Prisma 数据模型和 SQLite 迁移
- 游戏、来源、资讯、兑换码、抓取日志 API
- RSS / HTML 抓取骨架
- 关键词分类和兑换码提取
- 信息流、游戏管理、来源管理、兑换码、设置页面

## 本地启动

一键启动：

```powershell
.\start-dev.bat
```

这个脚本会在启动前清理旧的 `3000` / `5173` 端口进程和运行日志，然后在同一个窗口里合并显示前后端日志。按 `Q` 或 `Ctrl+C` 可以停止两个服务。

后端：

```powershell
cd backend
npm run start:dev
```

前端：

```powershell
cd frontend
npm run dev
```

默认地址：

- 前端：http://localhost:5173
- 后端：http://localhost:3000
- API 前缀：`/api`

## 数据库

SQLite 数据库位于 `backend/prisma/dev.db`。

常用命令：

```powershell
cd backend
npm run prisma:migrate
npm run prisma:generate
npm run prisma:studio
```

## 首次使用流程

1. 打开前端 `http://localhost:5173`
2. 在“游戏”页添加一个游戏
3. 在“来源”页添加官方 RSS 或 HTML 来源
4. 点击来源行里的抓取按钮
5. 回到“信息流”查看资讯
6. 在“兑换码”页查看识别出的兑换码

## API 示例

```txt
GET    /api/games
POST   /api/games
PATCH  /api/games/:id
DELETE /api/games/:id

GET    /api/sources
POST   /api/sources
PATCH  /api/sources/:id
DELETE /api/sources/:id
POST   /api/sources/:id/crawl

GET    /api/articles
GET    /api/articles/:id
PATCH  /api/articles/:id/read
PATCH  /api/articles/:id/favorite

GET    /api/codes
PATCH  /api/codes/:id/status

GET    /api/crawl-logs
```
