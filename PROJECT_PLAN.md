# 游戏官方资讯聚合 Web 端项目计划书

## 1. 项目目标

本项目用于集中整合玩家关注游戏的官方最新资讯，重点覆盖：

- 版本更新公告
- 活动公告
- 前瞻直播信息
- 兑换码 / 礼包码 / CDK
- 维护公告和补偿
- 官方社区、官网、Steam、B 站等来源的动态

第一版目标是做出一个可本地运行的私人工具：用户可以添加游戏和官方资讯源，系统可以手动或定时抓取资讯，自动分类并提取兑换码，然后在 Web 页面统一查看。

## 2. 技术栈

### 前端

- Vue 3
- Vite
- TypeScript
- Vue Router
- Pinia
- Element Plus
- Axios

### 后端

- Node.js
- NestJS
- TypeScript
- Prisma
- SQLite

### 抓取与任务

- RSS 抓取优先
- HTML 静态页面解析使用 Cheerio
- 动态页面后续可接入 Playwright
- MVP 阶段先使用手动抓取接口，后续接入定时任务

## 3. MVP 功能范围

### 游戏管理

- 创建游戏
- 编辑游戏名称、标识、图标、官网地址
- 查看游戏列表
- 删除游戏

### 资讯源管理

- 为每个游戏配置多个官方来源
- 来源类型支持：
  - RSS
  - HTML
  - Steam
  - Bilibili
  - Weibo
  - Manual
- 启用 / 禁用来源
- 手动触发抓取

### 资讯聚合

- 拉取来源内容
- 保存标题、摘要、正文、链接、封面、发布时间
- 根据 URL 和内容 Hash 去重
- 按游戏、分类、关键词筛选
- 标记已读
- 收藏资讯

### 自动分类

第一版使用关键词规则：

- 兑换码：兑换码、礼包码、CDK、福利码、口令码
- 前瞻：前瞻、直播、特别节目、版本节目
- 更新：更新公告、版本更新、补丁、Patch Notes
- 维护：维护、停服、补偿
- 活动：活动、限时、签到、挑战
- 公告：公告、通知
- 其他：无法匹配的内容

### 兑换码专区

- 从资讯正文和标题中提取疑似兑换码
- 支持复制兑换码
- 标记已兑换 / 未兑换
- 展示来源资讯和所属游戏

## 4. 页面规划

```txt
/
  首页信息流

/games
  游戏管理

/games/:id
  游戏详情与该游戏资讯

/sources
  来源管理

/codes
  兑换码汇总

/settings
  设置
```

## 5. 后端模块规划

```txt
src/
  app.module.ts

  games/
    games.controller.ts
    games.service.ts
    dto/

  sources/
    sources.controller.ts
    sources.service.ts
    dto/

  articles/
    articles.controller.ts
    articles.service.ts
    dto/

  codes/
    codes.controller.ts
    codes.service.ts

  crawler/
    crawler.service.ts
    parsers/
      rss.parser.ts
      html.parser.ts

  classification/
    classification.service.ts

  prisma/
    prisma.module.ts
    prisma.service.ts
```

## 6. 数据模型

### Game

- id
- name
- slug
- iconUrl
- officialUrl
- createdAt
- updatedAt

### Source

- id
- gameId
- name
- type
- url
- enabled
- crawlIntervalMinutes
- lastCrawledAt
- createdAt
- updatedAt

### Article

- id
- gameId
- sourceId
- title
- summary
- content
- url
- coverUrl
- publishedAt
- category
- contentHash
- isRead
- isFavorite
- createdAt
- updatedAt

### RedeemCode

- id
- gameId
- articleId
- code
- description
- expiredAt
- status
- createdAt
- updatedAt

### CrawlLog

- id
- sourceId
- status
- message
- startedAt
- finishedAt

## 7. API 设计

```txt
GET    /api/games
POST   /api/games
GET    /api/games/:id
PATCH  /api/games/:id
DELETE /api/games/:id

GET    /api/sources
POST   /api/sources
GET    /api/sources/:id
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

## 8. 目录结构

```txt
HE_News/
  frontend/
    Vue 前端

  backend/
    NestJS 后端

  PROJECT_PLAN.md
  README.md
```

## 9. 开发阶段

### 阶段一：项目骨架

- 创建前端 Vue 工程
- 创建后端 NestJS 工程
- 建立统一 README
- 配置基础运行脚本

### 阶段二：数据库与基础 API

- 配置 Prisma
- 建立 SQLite 数据库
- 实现 Game、Source、Article、RedeemCode 的基础 CRUD

### 阶段三：抓取与解析

- 实现 RSS 抓取
- 实现 HTML 页面基础解析
- 实现资讯去重
- 实现分类规则
- 实现兑换码提取

### 阶段四：前端页面

- 实现应用壳和导航
- 实现首页信息流
- 实现游戏管理
- 实现来源管理
- 实现兑换码页

### 阶段五：验证与优化

- 本地启动前后端
- 验证接口连通
- 验证新增游戏、来源、抓取、展示流程
- 补充错误提示和空状态

## 10. 第一版验收标准

- 前后端可以本地启动
- 可以添加至少一个游戏
- 可以为游戏添加一个资讯源
- 可以触发抓取接口
- 抓取到的资讯可以入库并在首页展示
- 兑换码可以被识别并展示在兑换码页
- 页面有基本的筛选、加载、错误和空状态

## 11. 后续增强方向

- 定时任务和失败重试
- 登录和多用户
- AI 摘要和智能标签
- 桌面通知或消息推送
- Docker Compose 一键启动
- PostgreSQL 部署配置
- Playwright 动态页面抓取
- 更多平台的官方账号适配
