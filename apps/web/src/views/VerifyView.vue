<template>
  <div class="verify-page">
    <div class="verify-header">
      <span class="verify-logo">⛓</span>
      <h1>版权存证验证</h1>
      <p class="verify-sub">ConfChain 区块链学术论文版权查验系统</p>
    </div>

    <el-card class="verify-card">
      <el-tabs v-model="activeTab">
        <!-- Tab 1：哈希查询 -->
        <el-tab-pane label="输入哈希值查询" name="hash">
          <el-form @submit.prevent="verifyByHash" style="margin-top: 16px">
            <el-form-item label="SHA-256 文件哈希">
              <el-input
                v-model="hashInput"
                placeholder="请输入 64 位十六进制哈希值"
                clearable
                style="font-family: monospace"
              >
                <template #append>
                  <el-button :loading="loading" @click="verifyByHash">查询</el-button>
                </template>
              </el-input>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- Tab 2：上传文件验证 -->
        <el-tab-pane label="上传文件验证" name="file">
          <div style="margin-top: 16px">
            <el-upload
              ref="uploadRef"
              :auto-upload="false"
              :limit="1"
              :on-change="onFileChange"
              drag
            >
              <el-icon class="upload-icon"><Upload /></el-icon>
              <div class="upload-hint">
                上传原始论文文件，系统自动计算哈希并与链上记录比对
              </div>
              <template #tip>
                <div class="tip">支持任意格式，单文件 ≤20MB</div>
              </template>
            </el-upload>
            <el-button
              type="primary"
              :loading="loading"
              :disabled="!selectedFile"
              style="margin-top: 12px"
              @click="verifyByFile"
            >
              上传并验证
            </el-button>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 验证结果 -->
    <el-card v-if="result !== null" class="result-card">
      <!-- 认证成功 -->
      <el-result
        v-if="result.found"
        icon="success"
        title="版权存证记录存在"
        sub-title="该文件已在 ConfChain 区块链上完成版权存证"
      >
        <template #extra>
          <el-descriptions :column="1" border style="text-align: left">
            <el-descriptions-item label="论文标题">{{ result.title }}</el-descriptions-item>
            <el-descriptions-item label="文件哈希（SHA-256）">
              <span class="mono">{{ result.fileHash }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="链上交易哈希（TxHash）">
              <span class="mono tx-hash">{{ result.txHash }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="区块高度">
              {{ result.blockHeight }}
            </el-descriptions-item>
            <el-descriptions-item label="存证时间">
              {{ result.certifiedAt ? new Date(result.certifiedAt).toLocaleString("zh-CN") : "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="作者钱包地址">
              <span class="mono">{{ result.authorAddress }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="稿件状态">
              <el-tag :type="statusTagType(result.paperStatus)" size="small">
                {{ statusLabel(result.paperStatus) }}
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </template>
      </el-result>

      <!-- 未找到记录 -->
      <el-result
        v-else
        icon="warning"
        title="未找到版权存证记录"
        sub-title="该文件在 ConfChain 上暂无存证记录，请确认文件是否完整或已完成存证"
      />
    </el-card>

    <!-- 返回首页 -->
    <div class="back-link">
      <el-link type="primary" @click="router.push('/login')">登录系统</el-link>
      &nbsp;|&nbsp;
      <el-link type="primary" @click="router.push('/register')">注册账号</el-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Upload } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import type { UploadFile } from "element-plus";
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "../services/api";

const router = useRouter();
const route = useRoute();
const activeTab = ref("hash");
const hashInput = ref("");
const selectedFile = ref<File | null>(null);
const loading = ref(false);
const result = ref<any>(null);

onMounted(async () => {
  const hash = route.query.fileHash as string | undefined;
  if (hash) {
    hashInput.value = hash;
    await verifyByHash();
  }
});

function onFileChange(file: UploadFile) {
  if (file.raw) selectedFile.value = file.raw;
}

async function verifyByHash() {
  if (!hashInput.value.trim()) {
    ElMessage.warning("请输入哈希值");
    return;
  }
  loading.value = true;
  result.value = null;
  try {
    const { data } = await api.get(`/papers/verify`, {
      params: { fileHash: hashInput.value.trim() },
    });
    result.value = data;
  } finally {
    loading.value = false;
  }
}

async function verifyByFile() {
  if (!selectedFile.value) return;
  loading.value = true;
  result.value = null;
  try {
    const formData = new FormData();
    formData.append("file", selectedFile.value);
    const { data } = await api.post("/papers/verify/file", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    result.value = data;
  } finally {
    loading.value = false;
  }
}

const STATUS_LABEL: Record<string, string> = {
  UPLOADED: "已上传",
  CERTIFIED: "已存证",
  UNDER_REVIEW: "审稿中",
  ACCEPTED: "已录用",
  REVISION: "需修改",
  REJECTED: "已拒绝",
};

const STATUS_TYPE: Record<string, "success" | "warning" | "danger" | "info"> = {
  CERTIFIED: "success",
  ACCEPTED: "success",
  UNDER_REVIEW: "warning",
  REVISION: "warning",
  REJECTED: "danger",
  UPLOADED: "info",
};

function statusLabel(s: string) {
  return STATUS_LABEL[s] ?? s;
}
function statusTagType(s: string) {
  return STATUS_TYPE[s] ?? "info";
}
</script>

<style scoped>
.verify-page {
  min-height: 100vh;
  background: linear-gradient(160deg, var(--color-bg-sidebar) 0%, #1a2332 50%, #0f1823 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
}

.verify-header {
  text-align: center;
  color: var(--color-text-inverse);
  margin-bottom: 32px;
}

.verify-logo {
  font-size: 3rem;
  display: block;
  margin-bottom: 12px;
  opacity: 0.9;
}

.verify-header h1 {
  margin: 0 0 8px;
  font-size: 1.75rem;
  font-weight: 600;
  font-family: var(--font-heading);
}

.verify-sub {
  margin: 0;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.65);
}

.verify-card {
  width: 100%;
  max-width: 680px;
  border-radius: 12px;
  border: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-modal);
}

.result-card {
  width: 100%;
  max-width: 680px;
  margin-top: 20px;
  border-radius: 12px;
  border: 1px solid var(--color-border-light);
}

.tip {
  font-size: 0.75rem;
  color: var(--color-text-tertiary);
  margin-top: 4px;
}

.mono {
  font-family: var(--font-mono), monospace;
  font-size: 0.75rem;
  word-break: break-all;
}

.upload-icon {
  font-size: 36px;
  color: var(--el-color-primary);
}

.upload-hint {
  margin-top: 8px;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.tx-hash {
  color: var(--color-primary);
}

.back-link {
  margin-top: 24px;
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.875rem;
}
</style>
