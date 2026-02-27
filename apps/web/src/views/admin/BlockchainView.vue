<template>
  <div class="blockchain-view">
    <el-row :gutter="20">
      <!-- 节点状态 -->
      <el-col :span="24">
        <el-card style="margin-bottom: 20px">
          <template #header>
            <div class="card-header">
              <span>节点状态</span>
              <el-button size="small" :loading="loadingNodes" @click="fetchNodeStatus">
                刷新
              </el-button>
            </div>
          </template>
          <el-descriptions :column="2" border v-loading="loadingNodes">
            <el-descriptions-item label="连接状态">
              <el-tag :type="nodeStatus?.connected ? 'success' : 'danger'" size="small">
                {{ nodeStatus?.connected ? "已连接" : "离线" }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="节点数量">
              {{ nodeStatus?.nodeCount ?? "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="最新区块高度">
              {{ nodeStatus?.blockNumber ?? "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="链 ID">
              {{ nodeStatus?.chainId ?? "-" }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>

      <!-- 交易查询 -->
      <el-col :span="24">
        <el-card>
          <template #header>交易溯源</template>
          <el-form :inline="true">
            <el-form-item label="交易哈希">
              <el-input v-model="txHash" placeholder="输入 txHash" style="width: 360px" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="loadingTx" @click="fetchTx">查询</el-button>
            </el-form-item>
          </el-form>
          <el-descriptions v-if="txDetail" :column="1" border style="margin-top: 16px">
            <el-descriptions-item label="交易哈希">{{ txDetail.txHash }}</el-descriptions-item>
            <el-descriptions-item label="业务类型">{{ txDetail.bizType }}</el-descriptions-item>
            <el-descriptions-item label="业务 ID">{{ txDetail.bizId }}</el-descriptions-item>
            <el-descriptions-item label="区块高度">{{ txDetail.blockHeight }}</el-descriptions-item>
            <el-descriptions-item label="时间戳">{{ txDetail.timestamp }}</el-descriptions-item>
          </el-descriptions>
          <el-empty v-else-if="searched" description="未找到该交易" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "../../services/api";

const loadingNodes = ref(false);
const nodeStatus = ref<any>(null);
const txHash = ref("");
const txDetail = ref<any>(null);
const loadingTx = ref(false);
const searched = ref(false);

async function fetchNodeStatus() {
  loadingNodes.value = true;
  try {
    const { data } = await api.get("/blockchain/nodes/status");
    nodeStatus.value = data;
  } finally {
    loadingNodes.value = false;
  }
}

async function fetchTx() {
  if (!txHash.value.trim()) return;
  loadingTx.value = true;
  searched.value = false;
  txDetail.value = null;
  try {
    const { data } = await api.get(`/blockchain/tx/${txHash.value.trim()}`);
    txDetail.value = data;
  } finally {
    loadingTx.value = false;
    searched.value = true;
  }
}

onMounted(fetchNodeStatus);
</script>

<style scoped>
.blockchain-view {
  max-width: 960px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
