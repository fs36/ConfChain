# ConfChain 开发交接文档（表结构与 API）

本文档基于当前 `main` 分支代码整理，目标是让下一次开发可直接接续。

> 最后更新：2026-03-19（聚焦数据库结构与数据流）

---

## 1. 当前开发状态

| 阶段 | 状态 | 说明 |
|------|------|------|
| Phase 0 环境基建 | ✅ 完成 | pnpm monorepo、Docker MySQL、Prisma 迁移、CI |
| Phase 1 身份认证与 RBAC | ✅ 完成 | 后端 JWT+RBAC、前端路由守卫 |
| Phase 2 版权存证闭环 | ✅ 已具备业务闭环 | 已有上传/存证/验证/链交易落库，链不可达时可降级模拟 |
| Phase 3 匿名审稿主流程 | ✅ 已具备业务闭环 | 分配、提交、裁定、自动分配、管理员汇总查询均已实现 |
| Phase 4 链运维与配置 | ✅ 基础能力完成 | 节点状态、交易追踪、本地交易分页与统计、会议阈值配置 |

技术栈：
- 后端：NestJS + Prisma + MySQL 8
- 前端：Vue 3 + Element Plus + Pinia + Vue Router
- 区块链：FISCO BCOS（通过 WeBASE-Front 调用，支持模拟降级）
- 包管理：pnpm monorepo

---

## 2. 数据库说明（重点）

### 2.1 数据源与迁移

核心文件：
- Prisma Schema：`apps/api/prisma/schema.prisma`
- 迁移目录：`apps/api/prisma/migrations/`

当前迁移：
1. `20260226180434_init`
   - 初始化核心表：`User`、`Paper`、`ReviewTask`、`ReviewResult`、`ConferenceConfig`、`ChainTransaction`
2. `20260227000000_add_certify_simulated`
   - 给 `Paper` 增加 `certifySimulated` 字段（是否模拟存证）

数据源配置：
- `provider = "mysql"`
- `url = env("DATABASE_URL")`

环境与端口注意：
- `docker-compose.yml` 暴露的是 `3307:3306`
- 如果使用项目自带 Docker MySQL，本机 `DATABASE_URL` 应指向 `localhost:3307`

---

### 2.2 枚举定义

#### `Role`
- `ADMIN`
- `AUTHOR`
- `REVIEWER`

#### `PaperStatus`
- `UPLOADED`
- `CERTIFIED`
- `UNDER_REVIEW`
- `ACCEPTED`
- `REVISION`
- `REJECTED`

---

### 2.3 表结构（按 Prisma Schema）

#### `User`
| 字段 | 类型 | 约束/默认 | 说明 |
|------|------|-----------|------|
| `id` | String | PK, cuid() | 用户 ID |
| `email` | String | UNIQUE | 登录账号 |
| `name` | String | - | 用户名 |
| `passwordHash` | String | - | bcrypt 哈希 |
| `role` | Role | 默认 `AUTHOR` | 角色 |
| `walletAddr` | String? | UNIQUE | 钱包地址 |
| `publicKey` | String? | - | 公钥（当前随机生成） |
| `privateKey` | String? | - | 私钥（当前随机生成） |
| `createdAt` | DateTime | now() | 创建时间 |
| `updatedAt` | DateTime | updatedAt | 更新时间 |

关系：
- `User (author)` 1:N `Paper`
- `User (reviewer)` 1:N `ReviewTask`

---

#### `Paper`
| 字段 | 类型 | 约束/默认 | 说明 |
|------|------|-----------|------|
| `id` | String | PK, cuid() | 稿件 ID |
| `title` | String | - | 标题 |
| `abstract` | String | - | 摘要 |
| `keywords` | String | - | 逗号分隔关键词 |
| `filePath` | String | - | 文件路径 |
| `fileHash` | String? | UNIQUE | 文件 SHA-256 |
| `status` | PaperStatus | 默认 `UPLOADED` | 稿件状态 |
| `txHash` | String? | - | 存证交易哈希 |
| `blockHeight` | Int? | - | 区块高度 |
| `certifiedAt` | DateTime? | - | 存证时间 |
| `certifySimulated` | Boolean? | 默认 `false` | 是否模拟存证 |
| `authorId` | String | FK -> `User.id` | 作者 |
| `createdAt` | DateTime | now() | 创建时间 |
| `updatedAt` | DateTime | updatedAt | 更新时间 |

关系：
- `Paper` N:1 `User(author)`
- `Paper` 1:N `ReviewTask`
- `Paper` 1:N `ReviewResult`

---

#### `ReviewTask`
| 字段 | 类型 | 约束/默认 | 说明 |
|------|------|-----------|------|
| `id` | String | PK, cuid() | 任务 ID |
| `paperId` | String | FK -> `Paper.id` | 稿件 |
| `reviewerId` | String | FK -> `User.id` | 审稿人 |
| `deadlineAt` | DateTime | - | 截止时间 |
| `status` | String | 默认 `ASSIGNED` | `ASSIGNED` / `SUBMITTED` |
| `assignTxHash` | String? | - | 当前用于记录提交交易哈希 |
| `createdAt` | DateTime | now() | 创建时间 |
| `updatedAt` | DateTime | updatedAt | 更新时间 |

备注：`status` 当前为字符串字段，不是枚举。

---

#### `ReviewResult`
| 字段 | 类型 | 约束/默认 | 说明 |
|------|------|-----------|------|
| `id` | String | PK, cuid() | 结果 ID |
| `paperId` | String | FK -> `Paper.id` | 稿件 |
| `reviewerId` | String | 逻辑关联 `User.id`（无 FK） | 审稿人 |
| `score` | Int | - | 评分（业务约束 0-100） |
| `recommendation` | String | - | 推荐结论 |
| `comment` | String? | - | 原始评语（业务库） |
| `commentCipher` | String | - | 评语 SHA-256 摘要 |
| `txHash` | String? | - | 审稿上链交易哈希 |
| `createdAt` | DateTime | now() | 创建时间 |
| `updatedAt` | DateTime | updatedAt | 更新时间 |

设计说明：
- 业务层同时保留 `comment` 与 `commentCipher`
- 管理端汇总接口默认不返回审稿人身份字段，满足匿名评审展示需求

---

#### `ConferenceConfig`
| 字段 | 类型 | 约束/默认 | 说明 |
|------|------|-----------|------|
| `id` | String | PK, cuid() | 配置 ID |
| `conferenceName` | String | - | 会议名称 |
| `submitStartAt` | DateTime | - | 投稿开始 |
| `submitEndAt` | DateTime | - | 投稿截止 |
| `reviewDays` | Int | - | 审稿天数 |
| `acceptThreshold` | Int | 默认 `70` | 录用阈值 |
| `weightInnovation` | Int | 默认 `40` | 创新性权重 |
| `weightScience` | Int | 默认 `40` | 科学性权重 |
| `weightWriting` | Int | 默认 `20` | 写作权重 |
| `createdAt` | DateTime | now() | 创建时间 |
| `updatedAt` | DateTime | updatedAt | 更新时间 |

业务规则：服务层读取最新一条配置作为系统有效配置。

---

#### `ChainTransaction`
| 字段 | 类型 | 约束/默认 | 说明 |
|------|------|-----------|------|
| `id` | String | PK, cuid() | 记录 ID |
| `bizType` | String | - | 业务类型 |
| `bizId` | String | - | 业务主键（稿件/任务等） |
| `txHash` | String | UNIQUE | 链交易哈希 |
| `blockHeight` | Int? | - | 区块高度 |
| `payload` | Json? | - | 交易附加信息 |
| `createdAt` | DateTime | now() | 创建时间 |

常见 `bizType`：
- `COPYRIGHT_CERTIFY`
- `REVIEW_SUBMIT`
- `ADJUDICATE`

---

### 2.4 关系与索引要点

外键关系：
- `Paper.authorId -> User.id`
- `ReviewTask.paperId -> Paper.id`
- `ReviewTask.reviewerId -> User.id`
- `ReviewResult.paperId -> Paper.id`

唯一约束：
- `User.email`
- `User.walletAddr`
- `Paper.fileHash`
- `ChainTransaction.txHash`

建模策略说明：
- `ChainTransaction.bizId` 为多态业务引用，不使用外键，便于统一记录不同业务的链流水
- `ReviewResult.reviewerId` 当前无物理外键，适合匿名展示场景，但需要业务层保证数据完整性

---

### 2.5 业务数据流（写库/改库时机）

1) 用户注册与角色
- `AuthService.register`：写 `User`
- `UsersService.updateRole`：更新 `User.role`

2) 投稿与版权存证
- `PapersService.uploadAndCertify`：
  - 先写 `Paper`（`UPLOADED`）
  - 调链后更新 `Paper`（`CERTIFIED`、`txHash`、`blockHeight`、`certifySimulated`）
  - 写 `ChainTransaction`（`COPYRIGHT_CERTIFY`）

3) 审稿分配与提交
- `ReviewsService.assign`：批量写 `ReviewTask`，并更新 `Paper.status = UNDER_REVIEW`
- `ReviewsService.submit`：写 `ReviewResult`，更新 `ReviewTask.status`，写 `ChainTransaction`（`REVIEW_SUBMIT`）

4) 裁定
- `ReviewsService.adjudicate`：更新 `Paper.status`，写 `ChainTransaction`（`ADJUDICATE`）

5) 会议参数
- `ConfConfigService.save`：更新或新建 `ConferenceConfig`（总是以最新记录为准）

---

### 2.6 当前数据库风险与建议

1. `schema.prisma` 与迁移脚本存在一处不一致
- Schema 中 `ReviewResult` 包含 `comment` 字段
- `20260226180434_init` 中未见 `comment` 列
- 建议新增迁移（如 `add_review_result_comment`）补齐，避免新环境迁移后运行时报错

2. 审稿任务状态建议枚举化
- 当前 `ReviewTask.status` 为字符串，建议后续改为枚举，减少状态写入错误

3. 关键查询建议补充索引
- 高频过滤字段如 `ReviewTask(reviewerId, paperId)`、`ReviewResult(paperId)` 可考虑增加复合索引

---

## 3. API 清单（当前代码）

全局前缀：`/api`

### 3.1 Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### 3.2 Users（ADMIN）
- `GET /api/users`
- `PATCH /api/users/:id/role`

### 3.3 Papers
- `POST /api/papers`（AUTHOR，multipart 上传）
- `POST /api/papers/:id/certify`（AUTHOR）
- `GET /api/papers/mine`（AUTHOR）
- `GET /api/papers/admin/all`（ADMIN）
- `GET /api/papers/verify?fileHash=`（公开）
- `POST /api/papers/verify/file`（公开）
- `GET /api/papers/:id/adjudication`（AUTHOR/ADMIN）
- `GET /api/papers/:id/download`（AUTHOR/ADMIN）
- `GET /api/papers/:id/download-as-reviewer`（REVIEWER）
- `POST /api/papers/:id/revise`（AUTHOR）

### 3.4 Reviews
- `POST /api/reviews/assign`（ADMIN）
- `POST /api/reviews/auto-assign`（ADMIN）
- `POST /api/reviews/submit`（REVIEWER）
- `POST /api/reviews/adjudicate/:paperId`（ADMIN）
- `GET /api/reviews/tasks/me`（REVIEWER）
- `GET /api/reviews/paper/:paperId`（REVIEWER）
- `GET /api/reviews/results/:paperId`（ADMIN）
- `GET /api/reviews/admin/paper-detail/:paperId`（ADMIN）

### 3.5 Blockchain（ADMIN）
- `GET /api/blockchain/nodes/status`
- `GET /api/blockchain/tx/:hash`
- `GET /api/blockchain/txs`
- `GET /api/blockchain/stats`
- `GET /api/blockchain/biz/:bizId`
- `GET /api/blockchain/contracts/info`

### 3.6 Conference Config（ADMIN）
- `GET /api/conf-config`
- `PUT /api/conf-config`

---

## 4. 关键文件路径

| 文件 | 用途 |
|------|------|
| `apps/api/prisma/schema.prisma` | 数据库模型定义 |
| `apps/api/prisma/migrations/*` | 结构迁移历史 |
| `apps/api/src/common/prisma.service.ts` | Prisma 客户端注入与连接 |
| `apps/api/src/papers/papers.service.ts` | 投稿、存证、验证、下载相关数据流 |
| `apps/api/src/reviews/reviews.service.ts` | 审稿任务、审稿提交、裁定数据流 |
| `apps/api/src/conf-config/conf-config.service.ts` | 会议配置读写 |
| `apps/api/src/blockchain/chain-tx.service.ts` | 链交易本地分页与统计 |

---

## 5. 下阶段建议（数据库角度）

1. 先补齐 `ReviewResult.comment` 迁移，统一 schema 与 SQL 基线
2. 增加索引并评估慢查询（尤其审稿任务页、结果汇总页）
3. 若后续加强隐私，可将 `ReviewResult.comment` 改为密文存储，仅保留 hash 明文检索
4. 为 `ChainTransaction.bizType` 统一枚举常量，减少脏数据风险
