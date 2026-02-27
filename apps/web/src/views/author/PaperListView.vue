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
        <el-table-column label="关键词" min-width="160">
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
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="版权存证" width="200">
          <template #default="{ row }">
            <template v-if="row.txHash">
              <div class="hash-line">
                <el-tooltip :content="`TxHash: ${row.txHash}`" placement="top">
                  <el-tag type="success" size="small" class="hash-tag">
                    {{ row.txHash.slice(0, 14) }}...
                  </el-tag>
                </el-tooltip>
              </div>
              <div class="hash-line" style="margin-top: 4px">
                <el-tooltip :content="`SHA-256: ${row.fileHash}`" placement="top">
                  <span class="hash-short">{{ row.fileHash?.slice(0, 12) }}...</span>
                </el-tooltip>
              </div>
            </template>
            <span v-else class="not-certified">未存证</span>
          </template>
        </el-table-column>
        <el-table-column label="存证时间" width="130">
          <template #default="{ row }">
            {{ row.certifiedAt ? formatDate(row.certifiedAt) : "-" }}
          </template>
        </el-table-column>
        <el-table-column label="投稿时间" width="120">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="showDetail(row)">
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 存证详情抽屉 -->
    <el-drawer v-model="drawerVisible" title="稿件存证详情" size="420px">
      <template v-if="selectedPaper">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="论文标题">{{ selectedPaper.title }}</el-descriptions-item>
          <el-descriptions-item label="摘要">
            <span style="white-space: pre-wrap; font-size: 13px">{{ selectedPaper.abstract }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="关键词">{{ selectedPaper.keywords }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(selectedPaper.status)" size="small">
              {{ statusLabel(selectedPaper.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="文件哈希（SHA-256）">
            <span class="mono">{{ selectedPaper.fileHash ?? "未存证" }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="链上 TxHash">
            <span class="mono">{{ selectedPaper.txHash ?? "-" }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="区块高度">
            {{ selectedPaper.blockHeight ?? "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="存证时间">
            {{ selectedPaper.certifiedAt ? new Date(selectedPaper.certifiedAt).toLocaleString("zh-CN") : "-" }}
          </el-descriptions-item>
        </el-descriptions>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../../services/api";

interface Paper {
  id: string;
  title: string;
  abstract: string;
  keywords: string;
  status: string;
  fileHash: string | null;
  txHash: string | null;
  blockHeight: number | null;
  certifiedAt: string | null;
  createdAt: string;
}

const router = useRouter();
const papers = ref<Paper[]>([]);
const loading = ref(false);
const drawerVisible = ref(false);
const selectedPaper = ref<Paper | null>(null);

async function fetchPapers() {
  loading.value = true;
  try {
    const { data } = await api.get<Paper[]>("/papers/mine");
    papers.value = data;
  } finally {
    loading.value = false;
  }
}

function showDetail(paper: Paper) {
  selectedPaper.value = paper;
  drawerVisible.value = true;
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

.hash-tag {
  font-family: monospace;
  font-size: 11px;
  cursor: default;
}

.hash-short {
  font-family: monospace;
  font-size: 11px;
  color: #67c23a;
  cursor: default;
}

.not-certified {
  font-size: 12px;
  color: #c0c4cc;
}

.mono {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}

.hash-line {
  line-height: 1.4;
}
</style>
