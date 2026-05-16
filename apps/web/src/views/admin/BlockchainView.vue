<template>
  <div class="blockchain-view">
    <!-- 统计卡片 -->
    <el-row :gutter="16" style="margin-bottom: 20px">
      <el-col :xs="12" :sm="4">
        <el-card class="stat-card">
          <div class="stat-label">链上交易总数</div>
          <div class="stat-value primary">{{ stats?.total ?? "-" }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="4">
        <el-card class="stat-card">
          <div class="stat-label">版权存证</div>
          <div class="stat-value success">{{ stats?.certifyCount ?? "-" }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="4">
        <el-card class="stat-card">
          <div class="stat-label">审稿上链</div>
          <div class="stat-value warning">{{ stats?.reviewCount ?? "-" }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="4">
        <el-card class="stat-card">
          <div class="stat-label">裁定结果</div>
          <div class="stat-value danger">{{ stats?.adjudicateCount ?? "-" }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="4">
        <el-card class="stat-card">
          <div class="stat-label">待上链</div>
          <div class="stat-value" style="color:#e6a23c">{{ stats?.pendingCount ?? "-" }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="4">
        <el-card class="stat-card">
          <div class="stat-label">上链失败</div>
          <div class="stat-value" style="color:#f56c6c">{{ stats?.failedCount ?? "-" }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 节点状态 -->
    <el-card style="margin-bottom: 20px">
      <template #header>
        <div class="card-header">
          <span>节点状态</span>
          <div style="display:flex;gap:8px">
            <el-tag v-if="autoRefresh" type="success" size="small">自动刷新 30s</el-tag>
            <el-switch v-model="autoRefresh" size="small" active-text="自动刷新" />
            <el-button size="small" :loading="loadingNodes" @click="fetchAll">刷新</el-button>
          </div>
        </div>
      </template>
      <el-descriptions :column="4" border v-loading="loadingNodes">
        <el-descriptions-item label="连接状态">
          <el-tag :type="nodeStatus?.connected ? 'success' : 'danger'" size="small">
            {{ nodeStatus?.connected ? "已连接" : "离线" }}
          </el-tag>
          </el-descriptions-item>
        <el-descriptions-item label="节点数量">
          {{ nodeStatus?.nodeCount ?? "-" }}
        </el-descriptions-item>
        <el-descriptions-item label="最新区块高度">
          <span class="block-height">{{ nodeStatus?.blockNumber ?? "-" }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="链 ID">
          {{ nodeStatus?.chainId ?? "-" }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- 交易溯源（输入 TxHash 查 WeBASE） -->
    <el-card style="margin-bottom: 20px">
      <template #header>交易溯源</template>
      <el-form :inline="true">
        <el-form-item label="交易哈希 / 业务ID">
          <el-input v-model="txSearchInput" placeholder="输入 txHash 或 paperId" style="width: 360px"
            @keydown.enter="onSearch" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loadingTx" @click="onSearch">查询</el-button>
        </el-form-item>
      </el-form>

      <!-- WeBASE 链上详情 -->
      <template v-if="txDetail">
        <el-alert type="success" show-icon :closable="false" style="margin-bottom: 12px">
          已从链上节点查询到交易详情
        </el-alert>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="交易哈希">
            <span class="mono">{{ txDetail.txHash }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="txDetail.status === 'SUCCESS' ? 'success' : 'warning'" size="small">
              {{ txDetail.status }}
            </el-tag>
            <el-tag v-if="txDetail.simulated" type="warning" size="small" style="margin-left:6px">模拟</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="区块高度">{{ txDetail.blockHeight }}</el-descriptions-item>
          <el-descriptions-item label="时间戳">
            {{ txDetail.timestamp ? new Date(txDetail.timestamp).toLocaleString("zh-CN") : "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="发送方">
            <span class="mono">{{ txDetail.from ?? "-" }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="合约地址">
            <span class="mono">{{ txDetail.to ?? "-" }}</span>
          </el-descriptions-item>
        </el-descriptions>
      </template>

      <!-- 本地业务记录 -->
      <template v-if="bizTxs.length">
        <el-divider content-position="left">本地业务记录</el-divider>
        <el-table :data="bizTxs" stripe size="small">
          <el-table-column prop="bizTypeLabel" label="业务类型" width="110">
            <template #default="{ row }">
              <el-tag :type="bizTagType(row.bizType)" size="small">{{ row.bizTypeLabel }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="交易哈希" min-width="160">
            <template #default="{ row }">
              <span class="mono small">{{ row.txHash?.slice(0, 18) }}…</span>
            </template>
          </el-table-column>
          <el-table-column prop="blockHeight" label="块高" width="110" />
          <el-table-column label="时间" width="150">
            <template #default="{ row }">
              {{ new Date(row.createdAt).toLocaleDateString("zh-CN") }}
            </template>
          </el-table-column>
        </el-table>
      </template>

      <el-empty v-else-if="searched && !txDetail" description="未找到该交易记录" />
    </el-card>

    <!-- 待上链队列 -->
    <el-card style="margin-bottom: 20px" v-if="pendingTxs.length || loadingPending">
      <template #header>
        <div class="card-header">
          <span>待上链队列</span>
          <div style="display:flex;gap:8px">
            <el-button
              type="warning"
              size="small"
              :loading="retryingAll"
              @click="retryAllPending"
            >
              全部重试
            </el-button>
            <el-button size="small" :loading="loadingPending" @click="fetchPendingTxs">
              刷新
            </el-button>
          </div>
        </div>
      </template>
      <el-table :data="pendingTxs" v-loading="loadingPending" stripe size="small">
        <el-table-column label="业务类型" width="110">
          <template #default="{ row }">
            <el-tag :type="bizTagType(row.bizType)" size="small">
              {{ bizTypeLabel(row.bizType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="bizId" label="业务 ID" min-width="140">
          <template #default="{ row }">
            <el-tooltip :content="row.bizId">
              <span class="mono small">{{ row.bizId?.slice(0, 14) }}…</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="retryCount" label="重试次数" width="100" align="center">
          <template #default="{ row }">
            <span :style="{ color: row.retryCount >= row.maxRetries - 1 ? '#f56c6c' : '' }">
              {{ row.retryCount }} / {{ row.maxRetries }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="下次重试" width="170">
          <template #default="{ row }">
            {{ row.status === 'PENDING' ? formatDateTime(row.nextRetryAt) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag
              :type="row.status === 'FAILED' ? 'danger' : row.status === 'RETRYING' ? 'warning' : 'info'"
              size="small"
            >
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最后错误" min-width="160">
          <template #default="{ row }">
            <el-tooltip v-if="row.lastError" :content="row.lastError" placement="top">
              <span class="error-msg">{{ row.lastError?.slice(0, 40) }}…</span>
            </el-tooltip>
            <span v-else style="color:#909399">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" align="center" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              size="small"
              link
              :loading="retryingIds[row.id]"
              @click="retryOnePending(row.id)"
            >
              重试
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 链上交易记录列表 -->
    <el-card>
      <template #header>
        <div class="card-header">
          <span>链上交易记录</span>
          <el-select v-model="bizTypeFilter" placeholder="全部类型" clearable size="small"
            style="width: 130px" @change="fetchTxList(1)">
            <el-option label="版权存证" value="COPYRIGHT_CERTIFY" />
            <el-option label="审稿上链" value="REVIEW_SUBMIT" />
            <el-option label="裁定结果" value="ADJUDICATE" />
          </el-select>
        </div>
      </template>

      <el-table :data="txList" v-loading="loadingList" stripe>
        <el-table-column label="业务类型" width="110">
          <template #default="{ row }">
            <el-tag :type="bizTagType(row.bizType)" size="small">{{ row.bizTypeLabel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="交易哈希" min-width="180">
          <template #default="{ row }">
            <el-tooltip :content="row.txHash">
              <span class="mono small clickable" @click="quickTrace(row.txHash)">
                {{ row.txHash?.slice(0, 20) }}…
              </span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="bizId" label="业务 ID" min-width="160">
          <template #default="{ row }">
            <el-tooltip :content="row.bizId">
              <span class="mono small clickable" @click="searchByBizId(row.bizId)">
                {{ row.bizId?.slice(0, 14) }}…
              </span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="blockHeight" label="块高" width="110" />
        <el-table-column label="时间" width="160">
          <template #default="{ row }">
            {{ new Date(row.createdAt).toLocaleDateString("zh-CN") }}
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          background
          layout="total, prev, pager, next"
          :total="txTotal"
          :page-size="txPageSize"
          :current-page="txPage"
          @current-change="fetchTxList"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { onMounted, onUnmounted, ref, watch } from "vue";
import { api } from "../../services/api";

interface NodeStatus {
  connected: boolean;
  nodeCount: number;
  blockNumber: number;
  chainId: string;
  simulated: boolean;
}

interface TxStats {
  total: number;
  certifyCount: number;
  reviewCount: number;
  adjudicateCount: number;
  pendingCount?: number;
  failedCount?: number;
}

interface TxItem {
  id: string;
  bizType: string;
  bizTypeLabel: string;
  bizId: string;
  txHash: string;
  blockHeight: number | null;
  createdAt: string;
}

interface TxDetail {
  txHash: string;
  status: string;
  blockHeight: number;
  timestamp: number;
  from?: string;
  to?: string;
  simulated: boolean;
}

interface PendingTx {
  id: string;
  bizType: string;
  bizId: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: string;
  status: string;
  lastError: string | null;
}

const loadingNodes = ref(false);
const nodeStatus = ref<NodeStatus | null>(null);
const stats = ref<TxStats | null>(null);
const autoRefresh = ref(false);
let refreshTimer: ReturnType<typeof setInterval> | null = null;

const txSearchInput = ref("");
const txDetail = ref<TxDetail | null>(null);
const bizTxs = ref<TxItem[]>([]);
const loadingTx = ref(false);
const searched = ref(false);

const txList = ref<TxItem[]>([]);
const txTotal = ref(0);
const txPage = ref(1);
const txPageSize = ref(20);
const loadingList = ref(false);
const bizTypeFilter = ref("");

// 待上链队列
const pendingTxs = ref<PendingTx[]>([]);
const loadingPending = ref(false);
const retryingAll = ref(false);
const retryingIds = ref<Record<string, boolean>>({});

function bizTagType(bizType: string) {
  const map: Record<string, "success" | "warning" | "danger" | "primary"> = {
    COPYRIGHT_CERTIFY: "success",
    REVIEW_SUBMIT: "warning",
    ADJUDICATE: "danger",
  };
  return map[bizType] ?? "primary";
}

async function fetchNodeStatus() {
  loadingNodes.value = true;
  try {
    const { data } = await api.get("/blockchain/nodes/status");
    nodeStatus.value = data;
  } finally {
    loadingNodes.value = false;
  }
}

async function fetchStats() {
  const { data } = await api.get("/blockchain/stats");
  stats.value = data;
}

async function fetchTxList(page = txPage.value) {
  txPage.value = page;
  loadingList.value = true;
  try {
    const { data } = await api.get("/blockchain/txs", {
      params: { page, pageSize: txPageSize.value, bizType: bizTypeFilter.value || undefined },
    });
    txList.value = data.items;
    txTotal.value = data.total;
  } finally {
    loadingList.value = false;
  }
}

async function fetchAll() {
  await Promise.all([fetchNodeStatus(), fetchStats(), fetchTxList(1), fetchPendingTxs()]);
}

async function onSearch() {
  const q = txSearchInput.value.trim();
  if (!q) return;
  loadingTx.value = true;
  searched.value = false;
  txDetail.value = null;
  bizTxs.value = [];
  try {
    const isTxHash = q.startsWith("0x") && q.length >= 60;
    if (isTxHash) {
      const { data } = await api.get(`/blockchain/tx/${q}`);
      txDetail.value = data;
    }
    const { data: bizData } = await api.get(`/blockchain/biz/${q}`);
    bizTxs.value = bizData;
  } catch {
    // 部分接口可能 404
  } finally {
    loadingTx.value = false;
    searched.value = true;
  }
}

function quickTrace(hash: string) {
  txSearchInput.value = hash;
  onSearch();
}

function searchByBizId(bizId: string) {
  txSearchInput.value = bizId;
  onSearch();
}

// --- 待上链队列 ---

function bizTypeLabel(bizType: string) {
  const map: Record<string, string> = {
    COPYRIGHT_CERTIFY: "版权存证",
    REVIEW_SUBMIT: "审稿上链",
    ADJUDICATE: "裁定结果",
  };
  return map[bizType] ?? bizType;
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    PENDING: "等待中",
    RETRYING: "重试中",
    CONFIRMED: "已确认",
    FAILED: "失败",
  };
  return map[status] ?? status;
}

function formatDateTime(dateStr: string) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("zh-CN");
}

async function fetchPendingTxs() {
  loadingPending.value = true;
  try {
    const { data } = await api.get("/blockchain/pending-txs", {
      params: { page: 1, pageSize: 50 },
    });
    pendingTxs.value = data.items ?? [];
  } catch {
    pendingTxs.value = [];
  } finally {
    loadingPending.value = false;
  }
}

async function retryAllPending() {
  retryingAll.value = true;
  try {
    const { data } = await api.post("/blockchain/retry");
    ElMessage.success(
      `重试完成: 成功 ${data.succeeded} 条, 仍失败 ${data.failed} 条`,
    );
    await Promise.all([fetchPendingTxs(), fetchStats(), fetchTxList(1)]);
  } catch {
    ElMessage.error("重试请求失败");
  } finally {
    retryingAll.value = false;
  }
}

async function retryOnePending(id: string) {
  retryingIds.value = { ...retryingIds.value, [id]: true };
  try {
    await api.post(`/blockchain/retry/${id}`);
    ElMessage.success("重试成功");
    await Promise.all([fetchPendingTxs(), fetchStats(), fetchTxList(1)]);
  } catch {
    ElMessage.error("重试失败");
  } finally {
    const next = { ...retryingIds.value };
    delete next[id];
    retryingIds.value = next;
  }
}

watch(autoRefresh, (val) => {
  if (val) {
    refreshTimer = setInterval(fetchAll, 30000);
  } else {
    if (refreshTimer) clearInterval(refreshTimer);
  }
});

onMounted(fetchAll);
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer);
});
</script>

<style scoped>
.blockchain-view {
  max-width: 1200px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stat-card {
  text-align: center;
  padding: 4px 0;
}

.stat-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
}

.stat-value.primary { color: #409eff; }
.stat-value.success { color: #67c23a; }
.stat-value.warning { color: #e6a23c; }
.stat-value.danger  { color: #f56c6c; }

.block-height {
  font-size: 16px;
  font-weight: 700;
  color: #409eff;
}

.mono {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}

.small {
  font-size: 11px;
}

.clickable {
  cursor: pointer;
  color: #409eff;
}

.clickable:hover {
  text-decoration: underline;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.error-msg {
  font-size: 11px;
  color: #f56c6c;
  cursor: default;
  word-break: break-all;
}
</style>
