<template>
  <el-container class="app-layout">
    <el-aside width="220px" class="sidebar">
      <div class="logo">
        <span class="logo-icon">⛓</span>
        <span class="logo-text">ConfChain</span>
      </div>
      <el-menu
        :default-active="activeRoute"
        router
        background-color="#1a1f2e"
        text-color="#c0c4cc"
        active-text-color="#409eff"
      >
        <el-menu-item index="/dashboard">
          <el-icon><HomeFilled /></el-icon>
          <span>首页</span>
        </el-menu-item>
        <el-menu-item index="/verify">
          <el-icon><Search /></el-icon>
          <span>版权验证</span>
        </el-menu-item>

        <!-- 管理员菜单 -->
        <template v-if="authStore.isAdmin">
          <el-menu-item index="/admin/users">
            <el-icon><User /></el-icon>
            <span>用户管理</span>
          </el-menu-item>
          <el-menu-item index="/admin/reviews">
            <el-icon><Document /></el-icon>
            <span>审稿分配</span>
          </el-menu-item>
          <el-sub-menu index="chain-manage">
            <template #title>
              <el-icon><Connection /></el-icon>
              <span>区块链管理</span>
            </template>
            <el-menu-item index="/admin/blockchain">
              <el-icon><Connection /></el-icon>
              <span>链运维</span>
            </el-menu-item>
            <el-menu-item index="/admin/contracts">
              <el-icon><Files /></el-icon>
              <span>合约管理</span>
            </el-menu-item>
          </el-sub-menu>
          <el-menu-item index="/admin/config">
            <el-icon><Setting /></el-icon>
            <span>系统配置</span>
          </el-menu-item>
        </template>

        <!-- 作者菜单 -->
        <template v-if="authStore.isAuthor">
          <el-menu-item index="/author/papers">
            <el-icon><Document /></el-icon>
            <span>我的稿件</span>
          </el-menu-item>
          <el-menu-item index="/author/submit">
            <el-icon><Upload /></el-icon>
            <span>投稿</span>
          </el-menu-item>
        </template>

        <!-- 审稿人菜单 -->
        <template v-if="authStore.isReviewer">
          <el-menu-item index="/reviewer/tasks">
            <el-icon><EditPen /></el-icon>
            <span>审稿任务</span>
          </el-menu-item>
        </template>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="app-header">
        <div class="header-left">
          <span class="page-title">{{ pageTitle }}</span>
        </div>
        <div class="header-right">
          <el-tag :type="roleTagType" size="small" class="role-tag">
            {{ roleLabel }}
          </el-tag>
          <el-dropdown @command="handleCommand">
            <div class="user-info">
              <el-avatar :size="32" :style="{ background: avatarColor }">
                {{ avatarLetter }}
              </el-avatar>
              <span class="username">{{ authStore.profile?.name || authStore.profile?.email }}</span>
              <el-icon class="arrow"><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import {
  ArrowDown,
  Connection,
  Document,
  EditPen,
  Files,
  HomeFilled,
  Search,
  Setting,
  Upload,
  User,
} from "@element-plus/icons-vue";
import { ElMessageBox } from "element-plus";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const activeRoute = computed(() => route.path);

const roleLabel = computed(() => {
  const map: Record<string, string> = {
    ADMIN: "管理员",
    AUTHOR: "作者",
    REVIEWER: "审稿人",
  };
  return map[authStore.profile?.role ?? ""] ?? "未知";
});

const roleTagType = computed(() => {
  const map: Record<string, "danger" | "success" | "warning"> = {
    ADMIN: "danger",
    AUTHOR: "success",
    REVIEWER: "warning",
  };
  return map[authStore.profile?.role ?? ""] ?? "info";
});

const avatarLetter = computed(() => {
  const name = authStore.profile?.name || authStore.profile?.email || "?";
  return name[0].toUpperCase();
});

const avatarColor = computed(() => {
  const colors = ["#409eff", "#67c23a", "#e6a23c", "#f56c6c", "#909399"];
  const letter = avatarLetter.value.charCodeAt(0) % colors.length;
  return colors[letter];
});

const pageTitleMap: Record<string, string> = {
  "/dashboard": "首页",
  "/verify": "版权验证",
  "/admin/users": "用户管理",
  "/admin/reviews": "审稿分配",
  "/admin/blockchain": "链运维",
  "/admin/contracts": "合约管理",
  "/admin/config": "系统配置",
  "/author/papers": "我的稿件",
  "/author/submit": "投稿",
  "/reviewer/tasks": "审稿任务",
};

const pageTitle = computed(() => pageTitleMap[route.path] ?? "ConfChain");

async function handleCommand(cmd: string) {
  if (cmd === "logout") {
    await ElMessageBox.confirm("确定退出登录？", "提示", {
      confirmButtonText: "退出",
      cancelButtonText: "取消",
      type: "warning",
    });
    authStore.logout();
    router.push("/login");
  }
}
</script>

<style scoped>
.app-layout {
  height: 100vh;
}

.sidebar {
  background-color: #1a1f2e;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-bottom: 1px solid #2d3348;
}

.logo-icon {
  font-size: 22px;
}

.logo-text {
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 1px;
}

.el-menu {
  border-right: none;
  flex: 1;
}

.app-header {
  height: 60px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.role-tag {
  font-size: 12px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.2s;
}

.user-info:hover {
  background: #f5f7fa;
}

.username {
  font-size: 14px;
  color: #303133;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrow {
  font-size: 12px;
  color: #909399;
}

.app-main {
  background: #f5f7fa;
  padding: 24px;
  overflow-y: auto;
}
</style>
