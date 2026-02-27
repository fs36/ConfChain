<template>
  <div class="user-manage">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>用户列表</span>
          <el-button type="primary" size="small" :loading="loading" @click="fetchUsers">
            刷新
          </el-button>
        </div>
      </template>

      <el-table :data="users" v-loading="loading" stripe>
        <el-table-column prop="name" label="姓名" min-width="120" />
        <el-table-column prop="email" label="邮箱" min-width="200" />
        <el-table-column prop="role" label="当前角色" width="120">
          <template #default="{ row }">
            <el-tag :type="roleTagType(row.role)" size="small">
              {{ roleLabel(row.role) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="walletAddr" label="钱包地址" min-width="200">
          <template #default="{ row }">
            <el-tooltip :content="row.walletAddr" placement="top">
              <span class="addr-short">{{ shortAddr(row.walletAddr) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="注册时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              link
              size="small"
              @click="openRoleDialog(row)"
            >
              修改角色
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 修改角色对话框 -->
    <el-dialog v-model="dialogVisible" title="修改用户角色" width="360px">
      <p class="dialog-user">
        用户：<strong>{{ editTarget?.email }}</strong>
      </p>
      <el-select v-model="newRole" style="width: 100%">
        <el-option label="作者" value="AUTHOR" />
        <el-option label="审稿人" value="REVIEWER" />
        <el-option label="管理员" value="ADMIN" />
      </el-select>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="updating" @click="updateRole">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { onMounted, ref } from "vue";
import { api } from "../../services/api";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "AUTHOR" | "REVIEWER";
  walletAddr: string;
  createdAt: string;
}

const users = ref<UserItem[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const editTarget = ref<UserItem | null>(null);
const newRole = ref<UserItem["role"]>("AUTHOR");
const updating = ref(false);

async function fetchUsers() {
  loading.value = true;
  try {
    const { data } = await api.get<UserItem[]>("/users");
    users.value = data;
  } finally {
    loading.value = false;
  }
}

function openRoleDialog(user: UserItem) {
  editTarget.value = user;
  newRole.value = user.role;
  dialogVisible.value = true;
}

async function updateRole() {
  if (!editTarget.value) return;
  updating.value = true;
  try {
    await api.patch(`/users/${editTarget.value.id}/role`, { role: newRole.value });
    ElMessage.success("角色已更新");
    dialogVisible.value = false;
    await fetchUsers();
  } finally {
    updating.value = false;
  }
}

function roleLabel(role: string) {
  const map: Record<string, string> = { ADMIN: "管理员", AUTHOR: "作者", REVIEWER: "审稿人" };
  return map[role] ?? role;
}

function roleTagType(role: string): "danger" | "success" | "warning" | "info" {
  const map: Record<string, "danger" | "success" | "warning"> = {
    ADMIN: "danger",
    AUTHOR: "success",
    REVIEWER: "warning",
  };
  return map[role] ?? "info";
}

function shortAddr(addr: string) {
  if (!addr) return "-";
  return addr.slice(0, 8) + "..." + addr.slice(-6);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

onMounted(fetchUsers);
</script>

<style scoped>
.user-manage {
  max-width: 1200px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.addr-short {
  font-family: monospace;
  font-size: 13px;
  color: #606266;
  cursor: default;
}

.dialog-user {
  margin: 0 0 16px;
  color: #606266;
}
</style>
