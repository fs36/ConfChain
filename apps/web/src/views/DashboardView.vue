<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="24">
        <el-card class="welcome-card">
          <div class="welcome-content">
            <div class="welcome-left">
              <h2>欢迎回来，{{ profile?.name || profile?.email }}</h2>
              <p class="welcome-sub">
                当前角色：
                <el-tag :type="roleTagType" size="small">{{ roleLabel }}</el-tag>
              </p>
              <p class="welcome-addr" v-if="profile?.walletAddr">
                钱包地址：<code>{{ profile.walletAddr }}</code>
              </p>
            </div>
            <div class="welcome-icon">⛓</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 管理员快捷操作 -->
    <el-row :gutter="20" v-if="authStore.isAdmin" class="quick-actions">
      <el-col :xs="24" :sm="8">
        <el-card class="stat-card" @click="router.push('/admin/users')">
          <el-icon class="stat-icon"><User /></el-icon>
          <div class="stat-info">
            <div class="stat-label">用户管理</div>
            <div class="stat-desc">管理用户角色与权限</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="8">
        <el-card class="stat-card" @click="router.push('/admin/reviews')">
          <el-icon class="stat-icon"><Document /></el-icon>
          <div class="stat-info">
            <div class="stat-label">审稿分配</div>
            <div class="stat-desc">分配与裁定稿件评审</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="8">
        <el-card class="stat-card" @click="router.push('/admin/blockchain')">
          <el-icon class="stat-icon"><Connection /></el-icon>
          <div class="stat-info">
            <div class="stat-label">链运维</div>
            <div class="stat-desc">查看节点与交易状态</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 作者快捷操作 -->
    <el-row :gutter="20" v-if="authStore.isAuthor" class="quick-actions">
      <el-col :xs="24" :sm="12">
        <el-card class="stat-card" @click="router.push('/author/submit')">
          <el-icon class="stat-icon"><Upload /></el-icon>
          <div class="stat-info">
            <div class="stat-label">投稿</div>
            <div class="stat-desc">提交论文并存证哈希</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12">
        <el-card class="stat-card" @click="router.push('/author/papers')">
          <el-icon class="stat-icon"><Document /></el-icon>
          <div class="stat-info">
            <div class="stat-label">我的稿件</div>
            <div class="stat-desc">查看投稿状态与链上记录</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 审稿人快捷操作 -->
    <el-row :gutter="20" v-if="authStore.isReviewer" class="quick-actions">
      <el-col :xs="24" :sm="12">
        <el-card class="stat-card" @click="router.push('/reviewer/tasks')">
          <el-icon class="stat-icon"><EditPen /></el-icon>
          <div class="stat-info">
            <div class="stat-label">审稿任务</div>
            <div class="stat-desc">查看并提交匿名评审意见</div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { Connection, Document, EditPen, Upload, User } from "@element-plus/icons-vue";
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const authStore = useAuthStore();
const router = useRouter();
const profile = computed(() => authStore.profile);

const roleLabel = computed(() => {
  const map: Record<string, string> = { ADMIN: "管理员", AUTHOR: "作者", REVIEWER: "审稿人" };
  return map[profile.value?.role ?? ""] ?? "未知";
});

const roleTagType = computed(() => {
  const map: Record<string, "danger" | "success" | "warning"> = {
    ADMIN: "danger",
    AUTHOR: "success",
    REVIEWER: "warning",
  };
  return map[profile.value?.role ?? ""] ?? "info";
});
</script>

<style scoped>
.dashboard {
  max-width: 960px;
}

.welcome-card {
  margin-bottom: 24px;
  background: linear-gradient(135deg, #409eff15, #67c23a10);
  border: 1px solid #409eff30;
}

.welcome-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.welcome-left h2 {
  margin: 0 0 8px;
  font-size: 22px;
  color: #303133;
}

.welcome-sub {
  margin: 0 0 6px;
  color: #606266;
  font-size: 14px;
}

.welcome-addr {
  margin: 0;
  color: #909399;
  font-size: 12px;
}

.welcome-addr code {
  font-family: monospace;
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 4px;
}

.welcome-icon {
  font-size: 52px;
  opacity: 0.3;
}

.quick-actions {
  margin-top: 8px;
}

.quick-actions .el-col {
  margin-bottom: 16px;
}

.stat-card {
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
}

.stat-card:hover {
  box-shadow: 0 4px 20px rgba(64, 158, 255, 0.2);
  transform: translateY(-2px);
}

:deep(.stat-card .el-card__body) {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
}

.stat-icon {
  font-size: 32px;
  color: #409eff;
  flex-shrink: 0;
}

.stat-label {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.stat-desc {
  font-size: 13px;
  color: #909399;
}
</style>
