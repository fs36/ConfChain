# ConfChain 启动手册

---

## 一、区块链节点（FISCO BCOS）

**启动节点**
```bash
cd ./nodes/127.0.0.1
bash start_all.sh
```

**启动 WeBASE-Front 适配层**
```bash
cd webase-front
bash start.sh
```

**网卡 IP 异常时修复**
```bash
sudo ip link set ens33 up
sudo dhclient ens33
ip addr show ens33
```
```bash
# 终端 1 — 后端
pnpm dev:api

# 终端 2 — 前端
pnpm dev:web
```


## 二、后端（NestJS API）

### 前置条件

1. 安装依赖（项目根目录执行一次即可）
   ```bash
   pnpm install
   ```

2. 配置环境变量（在 `apps/api/` 下创建 `.env` 文件）
   ```env
   # MySQL 连接串
   DATABASE_URL="mysql://root:password@localhost:3306/confchain"

   # JWT 密钥（随机字符串即可）
   JWT_SECRET="your-super-secret-key"

   # WeBASE-Front 地址
   WEBASE_URL="http://127.0.0.1:5002"
   ```

3. 初始化数据库（首次或 schema 变更后执行）
   ```bash
   cd apps/api
   pnpm exec prisma migrate dev
   pnpm exec prisma generate
   ```

### 开发模式启动（热重载）

```bash
# 在项目根目录
pnpm dev:api

# 或进入 apps/api 单独启动
cd apps/api
pnpm dev
```

> 后端默认监听 **http://localhost:3000**，所有接口前缀为 `/api`

### 生产构建 & 启动

```bash
cd apps/api
pnpm build
pnpm start
```

### Prisma Studio（数据库可视化）

```bash
cd apps/api
pnpm exec prisma studio
```

> 默认打开 **http://localhost:5555**

---

## 三、前端（Vue 3 + Vite）

### 开发模式启动

```bash
# 在项目根目录
pnpm dev:web

# 或进入 apps/web 单独启动
cd apps/web
pnpm dev
```

> 前端默认运行在 **http://localhost:5173**，已配置代理将 `/api` 转发到后端 3000 端口

### 生产构建

```bash
cd apps/web
pnpm build
pnpm preview   # 本地预览构建产物
```

---

## 四、同时启动前后端（推荐开发时使用）

打开两个终端分别执行：

```bash
# 终端 1 — 后端
pnpm dev:api

# 终端 2 — 前端
pnpm dev:web
```

---

## 五、Docker 一键启动（含 MySQL）

```bash
# 启动所有服务（后端 + 前端 + MySQL）
pnpm compose:up

# 停止所有服务
pnpm compose:down
```