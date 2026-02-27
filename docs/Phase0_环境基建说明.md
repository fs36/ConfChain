# Phase 0 环境基建说明

## 目标

在 Windows 11 完成开发环境搭建，并能连通 Ubuntu 16.04 上的 FISCO BCOS + WeBASE。

## 1. Windows 端准备

1. 安装 Node.js 18+
2. 安装 pnpm：
   - `npm i -g pnpm`
3. 启动本地 MySQL 8：
   - `pnpm compose:up`
4. 复制环境变量：
   - 将 `.env.example` 复制为 `.env`
   - 修改 `FISCO_RPC_URL` 和 `WEBASE_FRONT_URL` 为 Ubuntu IP

## 2. Ubuntu 端准备

1. 确认 FISCO BCOS 3.11 Air 节点正常运行
2. 确认 WeBASE 3.1.1 正常运行
3. 确认以下端口对 Windows 可访问：
   - 20200（FISCO RPC）
   - 5002（WeBASE-Front，按实际配置）

## 3. 工程启动

1. 安装依赖：
   - `pnpm install`
2. 初始化数据库：
   - `pnpm --filter @confchain/api prisma:generate`
   - `pnpm --filter @confchain/api prisma:migrate`
3. 启动后端：
   - `pnpm dev:api`
4. 启动前端：
   - `pnpm dev:web`

## 4. 验收检查

1. API 健康检查：
   - `GET http://localhost:3000/api/health`
2. 链配置检查：
   - `GET http://localhost:3000/api/health/chain`
3. CI 流程：
   - 执行 `pnpm build`
   - 执行 `pnpm test`
