# ConfChain

基于 FISCO BCOS 的学术会议匿名审稿与版权存证系统。

## 技术栈

- 前端：Vue 3 + TypeScript + Element Plus + Pinia
- 后端：NestJS + Prisma + MySQL 8 + JWT + RBAC
- 区块链：Ubuntu 16.04 上 FISCO BCOS 3.11（Air）+ WeBASE 3.1.1
- 包管理：pnpm workspace
- 测试：Vitest

## 项目结构

- `apps/api`：后端 API（认证、权限、稿件、审稿、链管理）
- `apps/web`：前端控制台
- `contracts`：智能合约与部署脚本
- `packages/shared`：共享类型
- `docs`：需求与实施文档

## 快速开始

1. 复制环境变量模板：
   - `cp .env.example .env`（Windows 可手动复制）
2. 启动本地 MySQL 8（Docker）：
   - `pnpm compose:up`
3. 安装依赖：
   - `pnpm install`
4. 初始化 Prisma：
   - `pnpm --filter @confchain/api prisma:generate`
   - `pnpm --filter @confchain/api prisma:migrate`
5. 启动后端：
   - `pnpm dev:api`
6. 启动前端：
   - `pnpm dev:web`

## 环境连接说明（当前推荐模式）

- Ubuntu 16.04：运行 FISCO BCOS + WeBASE
- Windows 11：运行前后端代码 + 本地 Docker MySQL
- `.env` 中将 `FISCO_RPC_URL`、`WEBASE_FRONT_URL` 配成 Ubuntu IP

## 健康检查

- `GET /api/health`：API 进程状态
- `GET /api/health/chain`：链连接配置状态（基础检查）

## 核心 API（已实现骨架）

- `POST /api/auth/register`：注册并生成链地址
- `POST /api/auth/login`：登录获取 JWT
- `GET /api/users`：管理员查看用户列表
- `PATCH /api/users/:id/role`：管理员分配角色
- `POST /api/papers`：作者创建稿件
- `POST /api/papers/:id/certify`：作者哈希存证
- `GET /api/papers/mine`：作者稿件列表
- `GET /api/papers/verify?fileHash=...`：版权查询
- `POST /api/reviews/assign`：管理员分配审稿任务
- `POST /api/reviews/submit`：审稿人提交匿名评审
- `POST /api/reviews/adjudicate/:paperId`：管理员触发裁定
- `GET /api/reviews/tasks/me`：审稿人任务列表
- `GET /api/blockchain/nodes/status`：节点状态（模拟）
- `GET /api/blockchain/tx/:hash`：交易溯源（模拟）

## 阶段完成情况

- 已完成：基础架构、身份权限骨架、版权存证闭环骨架、匿名审稿闭环骨架、链管理骨架、CI 与文档。
- 待增强：WeBASE 实链调用、文件上传流处理、可视化监控图表、完整 E2E 自动化。
