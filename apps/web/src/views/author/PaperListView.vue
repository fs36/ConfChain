<template>
  <div class="paper-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>我的稿件</span>
          <el-button type="primary" size="small" @click="router.push('/author/submit')">
            新增投稿
          </el-button>
        </div>
      </template>

      <el-table :data="papers" v-loading="loading" stripe>
        <el-table-column prop="title" label="标题" min-width="200" />
        <el-table-column prop="keywords" label="关键词" min-width="160">
          <template #default="{ row }">
            <el-tag
              v-for="kw in row.keywords.split(',')"
              :key="kw"
              size="small"
              style="margin: 2px"
            >
              {{ kw.trim() }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="链上哈希" width="160">
          <template #default="{ row }">
            <span v-if="row.fileHash" class="hash-short">
              <el-tooltip :content="row.fileHash" placement="top">
                {{ row.fileHash.slice(0, 10) }}...
              </el-tooltip>
            </span>
            <el-button
              v-else
              type="warning"
              link
              size="small"
              @click="certify(row)"
              :loading="certifyingId === row.id"
            >
              点击存证
            </el-button>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="投稿时间" width="130">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from "element-plus";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../../services/api";

interface Paper {
  id: string;
  title: string;
  keywords: string;
  status: string;
  fileHash: string | null;
  txHash: string | null;
  createdAt: string;
}

const router = useRouter();
const papers = ref<Paper[]>([]);
const loading = ref(false);
const certifyingId = ref<string | null>(null);

async function fetchPapers() {
  loading.value = true;
  try {
    const { data } = await api.get<Paper[]>("/papers/mine");
    papers.value = data;
  } finally {
    loading.value = false;
  }
}

async function certify(paper: Paper) {
  const result = await ElMessageBox.prompt(
    "请粘贴论文文件内容（用于计算哈希并上链存证）",
    "版权存证",
    {
      confirmButtonText: "存证",
      cancelButtonText: "取消",
      inputType: "textarea",
      inputPlaceholder: "将论文文本内容粘贴于此...",
    },
  );
  const fileContent = (result as any).value as string;
  if (!fileContent) return;
  certifyingId.value = paper.id;
  try {
    await api.post(`/papers/${paper.id}/certify`, { fileContent });
    ElMessage.success("版权存证成功");
    await fetchPapers();
  } finally {
    certifyingId.value = null;
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
  UPLOADED: "info",
  CERTIFIED: "success",
  UNDER_REVIEW: "warning",
  ACCEPTED: "success",
  REVISION: "warning",
  REJECTED: "danger",
};

function statusLabel(s: string) {
  return STATUS_LABEL[s] ?? s;
}

function statusTagType(s: string) {
  return STATUS_TYPE[s] ?? "info";
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

onMounted(fetchPapers);
</script>

<style scoped>
.paper-list {
  max-width: 1100px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hash-short {
  font-family: monospace;
  font-size: 12px;
  color: #67c23a;
  cursor: default;
}
</style>
