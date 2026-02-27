<template>
  <div class="contract-view">
    <!-- 合约信息卡片 -->
    <el-card style="margin-bottom: 20px">
      <template #header>
        <div class="card-header">
          <span>合约管理</span>
          <el-button size="small" :loading="loading" @click="fetchInfo">刷新</el-button>
        </div>
      </template>

      <div v-if="loading" style="padding: 40px; text-align: center">
        <el-skeleton :rows="5" animated />
      </div>

      <template v-else-if="contractInfo">
        <div v-for="c in contractInfo.contracts" :key="c.name" class="contract-block">
          <div class="contract-name">
            <el-tag type="primary" size="large" style="font-size: 15px; font-weight: 700">
              {{ c.name }}
            </el-tag>
            <span class="contract-label">{{ c.label }}</span>
          </div>

          <el-descriptions :column="2" border style="margin-top: 16px">
            <el-descriptions-item label="版权存证合约地址" span="2">
              <span v-if="c.address && !isZeroAddress(c.address)" class="mono">
                {{ c.address }}
              </span>
              <el-tag v-else type="danger" size="small">未配置</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="审稿合约地址" span="2">
              <span v-if="c.reviewAddress && !isZeroAddress(c.reviewAddress)" class="mono">
                {{ c.reviewAddress }}
              </span>
              <el-tag v-else type="danger" size="small">未配置（与版权合约同地址时忽略）</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="群组 ID">{{ c.groupId }}</el-descriptions-item>
            <el-descriptions-item label="链 ID">{{ c.chainId }}</el-descriptions-item>
            <el-descriptions-item label="WeBASE-Front 地址" span="2">
              <span class="mono">{{ c.webaseFrontUrl }}</span>
            </el-descriptions-item>
          </el-descriptions>

          <div class="func-section">
            <div class="func-title">合约函数</div>
            <el-table :data="c.functions" stripe size="small">
              <el-table-column prop="name" label="函数名" width="220">
                <template #default="{ row }">
                  <span class="mono">{{ row.name }}()</span>
                </template>
              </el-table-column>
              <el-table-column prop="desc" label="说明" />
            </el-table>
          </div>

          <el-alert type="info" show-icon :closable="false" style="margin-top: 16px">
            <template #default>
              若地址显示「未配置」，请在 <code>.env</code> 中设置
              <code>FISCO_CONTRACT_COPYRIGHT</code> 和 <code>FISCO_CONTRACT_REVIEW</code>，
              并重启 API 服务。详见 <strong>docs/合约部署说明.md</strong>。
            </template>
          </el-alert>
        </div>
      </template>
    </el-card>

    <!-- 合约相关链上交易记录 -->
    <el-card>
      <template #header>
        <div class="card-header">
          <span>部署 / 调用历史（链上交易）</span>
          <div style="display:flex;gap:8px">
            <el-select v-model="bizTypeFilter" placeholder="全部类型" clearable size="small"
              style="width: 130px" @change="fetchTxList(1)">
              <el-option label="版权存证" value="COPYRIGHT_CERTIFY" />
              <el-option label="审稿上链" value="REVIEW_SUBMIT" />
              <el-option label="裁定结果" value="ADJUDICATE" />
            </el-select>
          </div>
        </div>
      </template>

      <el-table :data="txList" v-loading="loadingTx" stripe>
        <el-table-column label="业务类型" width="120">
          <template #default="{ row }">
            <el-tag :type="bizTagType(row.bizType)" size="small">{{ row.bizTypeLabel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="交易哈希" min-width="200">
          <template #default="{ row }">
            <el-tooltip :content="row.txHash" placement="top">
              <span class="mono small">{{ row.txHash?.slice(0, 22) }}…</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="业务 ID" min-width="160">
          <template #default="{ row }">
            <el-tooltip :content="row.bizId" placement="top">
              <span class="mono small">{{ row.bizId?.slice(0, 14) }}…</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="blockHeight" label="块高" width="90" />
        <el-table-column label="时间" width="130">
          <template #default="{ row }">
            {{ new Date(row.createdAt).toLocaleString("zh-CN") }}
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
import { onMounted, ref } from "vue";
import { api } from "../../services/api";

interface ContractFunction {
  name: string;
  desc: string;
}

interface ContractInfo {
  name: string;
  label: string;
  address: string | null;
  reviewAddress: string | null;
  groupId: string;
  chainId: string;
  webaseFrontUrl: string;
  functions: ContractFunction[];
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

const loading = ref(false);
const contractInfo = ref<{ contracts: ContractInfo[] } | null>(null);

const txList = ref<TxItem[]>([]);
const txTotal = ref(0);
const txPage = ref(1);
const txPageSize = ref(20);
const loadingTx = ref(false);
const bizTypeFilter = ref("");

const ZERO = "0x0000000000000000000000000000000000000000";
function isZeroAddress(addr: string) {
  return !addr || addr === ZERO || addr === "0x0";
}

function bizTagType(bizType: string) {
  const map: Record<string, "success" | "warning" | "danger" | "primary"> = {
    COPYRIGHT_CERTIFY: "success",
    REVIEW_SUBMIT: "warning",
    ADJUDICATE: "danger",
  };
  return map[bizType] ?? "primary";
}

async function fetchInfo() {
  loading.value = true;
  try {
    const { data } = await api.get("/blockchain/contracts/info");
    contractInfo.value = data;
  } finally {
    loading.value = false;
  }
}

async function fetchTxList(page = txPage.value) {
  txPage.value = page;
  loadingTx.value = true;
  try {
    const { data } = await api.get("/blockchain/txs", {
      params: { page, pageSize: txPageSize.value, bizType: bizTypeFilter.value || undefined },
    });
    txList.value = data.items;
    txTotal.value = data.total;
  } finally {
    loadingTx.value = false;
  }
}

onMounted(() => {
  fetchInfo();
  fetchTxList(1);
});
</script>

<style scoped>
.contract-view {
  max-width: 1100px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.contract-block {
  padding: 8px 0;
}

.contract-name {
  display: flex;
  align-items: center;
  gap: 12px;
}

.contract-label {
  font-size: 14px;
  color: #606266;
}

.func-section {
  margin-top: 20px;
}

.func-title {
  font-size: 13px;
  font-weight: 700;
  color: #303133;
  margin-bottom: 8px;
}

.mono {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}

.small { font-size: 11px; }

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
