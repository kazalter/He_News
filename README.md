# HE News (游戏资讯聚合与版本前瞻工具)

一个自托管的**游戏官方资讯聚合与版本前瞻管理系统**。支持多游戏、多来源定时内容抓取与智能解析，自动提取礼包兑换码，提供资讯日历及版本规划展示。主要用于本地及个人多游戏资讯流一站式监控。

系统后端基于 NestJS 构建，前端基于 Vue 3，并使用 Prisma 作为 ORM 配合 SQLite 进行本地关系化数据持久存储。

---

## 功能特性

- **多来源定时抓取**：基于定时调度器（Cron Jobs）对各游戏官方 RSS、API 及 HTML 解析源进行全自动抓取，内置抓取状态与异常日志追踪。
- **智能过滤与去重**：使用内容哈希（Hash）机制，实现资讯正文与链接的多维度自动去重，确保内容流清爽无重复。
- **兑换码结构化提取**：在数据入库时对资讯进行文本结构解析，利用正则表达式与内容过滤器自动提取游戏礼包兑换码，支持手动失效状态维护。
- **产品化日历与前瞻**：前端提供按游戏细分的资讯时间轴流、兑换码一键复制控制台、资讯日历以及未来版本前瞻卡片，让版本更新一目了然。
- **幂等种子恢复系统（Seed）**：提供一键数据库初始化与种子填充机制，方便在新环境下（例如更换电脑）一键恢复崩铁、绝区零、鸣潮等内置游戏及抓取源的全部配置。

---

## 技术栈

| 层次 | 技术选型 |
|---|---|
| **后端** | Node.js + NestJS + Prisma ORM + Uvicorn/Node-schedule |
| **前端** | Vue 3 + Vite + Tailwind CSS / Component Library |
| **数据库** | SQLite (通过 Prisma 映射，轻量关系型) |
| **功能脚本**| bat/sh 一键多服务启动脚本 |

---

## 目录结构

```text
HE_News/
├─ backend/             NestJS 后端项目
│  ├─ src/              核心业务模块（Game, Source, Article, Code）
│  └─ prisma/           Prisma Schema 定义、迁移文件及数据库种子（seed.ts）
├─ frontend/            Vue 3 前端项目
│  ├─ src/              组件、API 接口和路由定义
│  └─ vite.config.ts    前端开发及打包配置
├─ scripts/             辅助管理脚本
└─ start-dev.bat        Windows 全栈一键端口占用清理与合并启动脚本
```

---

## 快速开始 (新环境初始化)

由于 SQLite 数据库文件（`dev.db`）和 `.env` 密钥已被 `.gitignore` 忽略，在新环境中拉取代码后请运行以下初始化步骤：

### 1. 后端依赖安装与数据库初始化
```powershell
cd backend
npm install
copy .env.example .env
npm run setup        # 自动生成数据库迁移、建立表结构并运行种子脚本（重建游戏和抓取源记录）
npm run start:dev    # 启动 NestJS 后端服务（固定端口 3000），调度器将自动开抓
```

### 2. 前端服务启动
另开一个命令行窗口：
```powershell
cd frontend
npm install
npm run dev          # 启动前端服务（端口 5174）
```

---

## 简易日常开发与管理

### 1. 一键启动
在项目根目录下直接双击运行：
```powershell
.\start-dev.bat
```
该脚本会自动检测并清理本地 `3000` (后端) 和 `5174` (前端) 的端口占用，并合并打印前后端的运行日志。按 `Q` 或 `Ctrl+C` 即可安全停掉所有服务。

### 2. REST API 契约
系统对外暴露的标准 Restful 接口，方便自定义爬虫集成或第三方客户端接入：
```text
GET/POST/PATCH/DELETE  /api/games[/:id]       # 游戏配置管理
GET/POST/PATCH/DELETE  /api/sources[/:id]     # 抓取来源配置管理
POST                   /api/sources/:id/crawl # 手动触发指定源的抓取任务
GET                    /api/articles[/:id]    # 资讯阅读与收藏
GET                    /api/codes             # 兑换码获取与更新
GET                    /api/crawl-logs        # 抓取日志追溯
```

