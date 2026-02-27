# ConfChain 开发交接文档（表结构与 API）

本文档基于当前代码实现整理，目标是让下一次开发可直接接续。

> 最后更新：Phase 1（身份认证与 RBAC 完整化）完成后

---

## 1. 当前开发状态

| 阶段 | 状态 | 说明 |
|------|------|------|
| Phase 0 环境基建 | ✅ 完成 | pnpm monorepo、Docker MySQL、Prisma 迁移、CI |
| Phase 1 身份认证与 RBAC | ✅ 完成 | 后端 JWT+RBAC、前端全页面+路由守卫 |
| Phase 2 版权存证闭环 | ⏳ 待开始 | 真实 WeBASE/FISCO 链对接 |
| Phase 3 匿名审稿主流程 | ⏳ 待开始 | |
| Phase 4 链运维与配置 | ⏳ 待开始 | |

**技术栈**：
- 后端：NestJS + Prisma（MySQL 8.0，端口 3307）
- 前端：Vue 3 + Element Plus + Pinia + Vue Router
- 区块链：FISCO BCOS 3.11（Ubuntu，当前 BlockchainService 为模拟实现）
- 包管理：pnpm（monorepo workspaces）

---

## 2. 数据库表结构（按 Prisma Schema）

Schema 文件：`apps/api/prisma/schema.prisma`

### 2.1 枚举

- `Role`：`ADMIN` | `AUTHOR` | `REVIEWER`
- `PaperStatus`：`UPLOADED` | `CERTIFIED` | `UNDER_REVIEW` | `ACCEPTED` | `REVISION` | `REJECTED`

### 2.2 表定义

#### `User`
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String PK (cuid) | 用户 ID |
| `email` | String UNIQUE | 邮箱（登录账号）|
| `name` | String | 姓名 |
| `passwordHash` | String | bcrypt 哈希 |
| `role` | Role | 默认 `AUTHOR` |
| `walletAddr` | String? UNIQUE | 模拟钱包地址（注册时随机生成）|
| `publicKey` | String? | 预留公钥 |
| `privateKey` | String? | 预留私钥 |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

关系：1:N `Paper`、1:N `ReviewTask`

---

#### `Paper`
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String PK | |
| `title` | String | 论文标题 |
| `abstract` | String | 摘要 |
| `keywords` | String | 逗号分隔 |
| `filePath` | String | 文件路径（占位）|
| `fileHash` | String? UNIQUE | SHA-256 哈希 |
| `status` | PaperStatus | 默认 `UPLOADED` |
| `txHash` | String? | 链上交易哈希 |
| `blockHeight` | Int? | 区块高度 |
| `certifiedAt` | DateTime? | 存证时间 |
| `authorId` | FK → User | |
| `createdAt/updatedAt` | DateTime | |

---

#### `ReviewTask`
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String PK | |
| `paperId` | FK → Paper | |
| `reviewerId` | FK → User | |
| `deadlineAt` | DateTime | 截止时间 |
| `status` | String | `ASSIGNED` / `SUBMITTED` |
| `assignTxHash` | String? | 分配上链哈希 |
| `createdAt/updatedAt` | DateTime | |

---

#### `ReviewResult`
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String PK | |
| `paperId` | FK → Paper | |
| `reviewerId` | String | |
| `score` | Int | 0-100 |
| `recommendation` | String | STRONG_ACCEPT / ACCEPT / WEAK_ACCEPT / REJECT |
| `commentCipher` | String | comment 的 SHA-256（匿名化）|
| `txHash` | String? | 上链哈希 |
| `createdAt/updatedAt` | DateTime | |

---

#### `ConferenceConfig`
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String PK | |
| `conferenceName` | String | 会议名称 |
| `submitStartAt/EndAt` | DateTime | 投稿时间窗口 |
| `reviewDays` | Int | 审稿天数 |
| `acceptThreshold` | Int | 录用分数线（默认 70）|
| `weightInnovation/Science/Writing` | Int | 评分权重（合计 100）|

---

#### `ChainTransaction`
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String PK | |
| `bizType` | String | `COPYRIGHT_CERTIFY` / `REVIEW_SUBMIT` / `REVIEW_ASSIGN` |
| `bizId` | String | 关联业务 ID |
| `txHash` | String UNIQUE | 链上哈希 |
| `blockHeight` | Int? | 区块高度 |
| `payload` | Json? | 原始链返回数据 |
| `createdAt` | DateTime | |

---

## 3. API 清单（当前已实现）

全局前缀：`/api`  
鉴权：Bearer JWT（除 `/api/auth/*`、`/api/health*`、`/api/papers/verify` 外均需要）

### 3.1 Health

| Method | Path | Auth | 说明 |
|--------|------|------|------|
| GET | `/api/health` | 无 | 服务状态 |
| GET | `/api/health/chain` | 无 | 链连接状态 |

### 3.2 Auth

| Method | Path | Auth | 说明 |
|--------|------|------|------|
| POST | `/api/auth/register` | 无 | 注册（name/email/password/role?）|
| POST | `/api/auth/login` | 无 | 登录 → `{accessToken, refreshToken, user}` |
| GET | `/api/auth/me` | JWT | 获取当前用户信息 |

### 3.3 Users（ADMIN 专属）

| Method | Path | Auth | 说明 |
|--------|------|------|------|
| GET | `/api/users` | ADMIN | 获取所有用户列表 |
| PATCH | `/api/users/:id/role` | ADMIN | 修改用户角色 |

### 3.4 Papers

| Method | Path | Auth | 说明 |
|--------|------|------|------|
| POST | `/api/papers` | AUTHOR | 创建稿件（title/abstract/keywords/fileContent）|
| POST | `/api/papers/:id/certify` | AUTHOR | 版权存证（计算 SHA-256 并写链）|
| GET | `/api/papers/mine` | AUTHOR | 我的稿件列表 |
| GET | `/api/papers/admin/all` | ADMIN | 所有稿件列表（含 author 信息）|
| GET | `/api/papers/verify?fileHash=` | 无 | 通过哈希验证版权 |

### 3.5 Reviews

| Method | Path | Auth | 说明 |
|--------|------|------|------|
| POST | `/api/reviews/assign` | ADMIN | 分配审稿人（paperId/reviewerIds/deadlineAt）|
| POST | `/api/reviews/submit` | REVIEWER | 提交审稿意见（taskId/score/recommendation/comment）|
| POST | `/api/reviews/adjudicate/:paperId` | ADMIN | 裁定（按平均分 ≥80/≥70/<70 → ACCEPTED/REVISION/REJECTED）|
| GET | `/api/reviews/tasks/me` | REVIEWER | 我的审稿任务列表（含 paper）|

### 3.6 Blockchain（ADMIN 专属）

| Method | Path | Auth | 说明 |
|--------|------|------|------|
| GET | `/api/blockchain/nodes/status` | ADMIN | 节点状态（当前模拟）|
| GET | `/api/blockchain/tx/:hash` | ADMIN | 交易追踪（当前模拟）|

---

## 4. 前端页面结构（Phase 1 完成后）

```
/login            → 登录页（带注册链接）
/register         → 注册页

/dashboard        → 首页（角色感知快捷入口）[需登录]

/admin/users      → 用户管理（列表 + 角色修改）[ADMIN]
/admin/reviews    → 审稿分配与裁定 [ADMIN]
/admin/blockchain → 链运维（节点状态 + 交易查询）[ADMIN]

/author/papers    → 我的稿件（列表 + 存证操作）[AUTHOR]
/author/submit    → 投稿（表单 + 自动存证）[AUTHOR]

/reviewer/tasks   → 审稿任务（列表 + 提交意见）[REVIEWER]
```

**路由守卫逻辑**：
- 未登录访问需鉴权页 → 跳转 `/login`
- 已登录访问 `/login`/`/register` → 跳转 `/dashboard`
- 角色不匹配 → 跳转 `/dashboard`

---

## 5. 关键文件路径

| 文件 | 用途 |
|------|------|
| `apps/api/prisma/schema.prisma` | 数据库模型定义 |
| `apps/api/src/auth/` | 登录/注册/JWT 策略 |
| `apps/api/src/blockchain/blockchain.service.ts` | 链交互（当前模拟，Phase 2 替换）|
| `apps/web/src/services/api.ts` | 前端统一 axios 实例 |
| `apps/web/src/stores/auth.ts` | 认证 Pinia store |
| `apps/web/src/layouts/AppLayout.vue` | 主布局（侧边栏+顶栏）|
| `apps/web/src/router/index.ts` | 路由定义 + 守卫 |

---

## 6. Phase 2 开发重点

1. **真实文件上传**：替换当前 `fileContent` 文本为 `multipart/form-data` 文件流，保存到本地磁盘（`apps/api/uploads/`）
2. **对接 WeBASE/FISCO**：将 `blockchain.service.ts` 中的模拟实现替换为实际 HTTP 调用（调用 Ubuntu 上的 WeBASE Front API）
3. **Solidity 合约**：完善 `contracts/src/ConfChainCore.sol` 的版权存证与审稿上链逻辑，部署到 FISCO 链
4. **哈希验证公开页**：增强 `/api/papers/verify` 返回的信息，可加 Swagger 文档
5. **Swagger API 文档**：集成 `@nestjs/swagger`，生成接口文档
