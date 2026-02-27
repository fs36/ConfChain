<template>
  <div class="paper-list page-content">
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
            <el-tag :type="row.certifySimulated ? 'warning' : statusTagType(row.status)" size="small">
              {{ statusLabel(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="版权存证" width="200">
          <template #default="{ row }">
            <template v-if="row.txHash">
              <div class="hash-line">
                <el-tooltip :content="`TxHash: ${row.txHash}`" placement="top">
                  <el-tag :type="row.certifySimulated ? 'warning' : 'success'" size="small" class="hash-tag">
                    {{ row.txHash.slice(0, 14) }}...
                  </el-tag>
                </el-tooltip>
                <el-tag v-if="row.certifySimulated" type="warning" size="small" style="margin-left:4px">模拟</el-tag>
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
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="showDetail(row)">
              存证详情
            </el-button>
            <el-button
              v-if="row.txHash"
              type="warning"
              link
              size="small"
              @click="openCertificate(row)"
            >
              导出证书
            </el-button>
            <el-button
              v-if="FINAL_STATUSES.includes(row.status)"
              type="success"
              link
              size="small"
              @click="showAdjudication(row)"
            >
              裁定结果
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 存证详情抽屉 -->
    <el-drawer v-model="drawerVisible" title="稿件存证详情" size="420px">
      <template v-if="selectedPaper">
        <div v-if="selectedPaper.txHash" style="margin-bottom: 16px">
          <el-button type="warning" @click="openCertificate(selectedPaper)">
            导出区块链存证证书
          </el-button>
        </div>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="论文标题">{{ selectedPaper.title }}</el-descriptions-item>
          <el-descriptions-item label="摘要">
            <span style="white-space: pre-wrap; font-size: 13px">{{ selectedPaper.abstract }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="关键词">{{ selectedPaper.keywords }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="selectedPaper.certifySimulated ? 'warning' : statusTagType(selectedPaper.status)" size="small">
              {{ statusLabel(selectedPaper) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="文件哈希（SHA-256）">
            <span class="mono">{{ selectedPaper.fileHash ?? "未存证" }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="链上 TxHash">
            <span class="mono">{{ selectedPaper.txHash ?? "-" }}</span>
            <el-tag v-if="selectedPaper.certifySimulated" type="warning" size="small" style="margin-left:8px">模拟</el-tag>
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

    <!-- 裁定结果抽屉 -->
    <el-drawer v-model="adjDrawerVisible" title="审稿裁定结果" size="460px">
      <div v-if="adjLoading" style="padding: 20px">
        <el-skeleton :rows="5" animated />
      </div>
      <template v-else-if="adjDetail">
        <!-- 最终裁定结论 -->
        <div class="verdict-banner" :class="verdictClass(adjDetail.currentStatus)">
          <div class="verdict-icon">{{ verdictIcon(adjDetail.currentStatus) }}</div>
          <div class="verdict-text">{{ STATUS_LABEL[adjDetail.currentStatus] ?? adjDetail.currentStatus }}</div>
          <div class="verdict-paper">{{ adjDetail.paperTitle }}</div>
        </div>

        <!-- 审稿意见与分数 -->
        <div v-if="adjDetail.reviewResults && adjDetail.reviewResults.length" class="review-section">
          <div class="section-title">审稿意见与分数</div>
          <div class="adj-score-line">
            综合平均分：<span class="adj-score">{{ adjDetail.averageScore ?? "-" }}</span>
            <span class="threshold-hint">
              裁定阈值 {{ thresholdValue }} 分
              （≥ {{ thresholdValue + 10 }} 录用 /
              ≥ {{ thresholdValue }} 需修改 /
              &lt; {{ thresholdValue }} 拒绝）
            </span>
          </div>
          <el-table :data="adjDetail.reviewResults" stripe size="small" class="review-table">
            <el-table-column type="index" label="序号" width="56" />
            <el-table-column label="评分" width="80">
              <template #default="{ row }">
                <el-tag
                  :type="row.score >= 80 ? 'success' : row.score >= 70 ? 'warning' : 'danger'"
                  size="small"
                >
                  {{ row.score }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="录用建议" min-width="120">
              <template #default="{ row }">
                {{ RECOMMENDATION_LABEL[row.recommendation] ?? row.recommendation }}
              </template>
            </el-table-column>
            <el-table-column label="评语" min-width="200">
              <template #default="{ row }">
                <span class="comment-text">
                  {{ row.comment || "（审稿人未填写评语）" }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="提交时间" width="100">
              <template #default="{ row }">
                {{ row.submittedAt ? new Date(row.submittedAt).toLocaleDateString("zh-CN") : "-" }}
              </template>
            </el-table-column>
          </el-table>
          <p class="review-note">审稿意见详细内容已匿名上链存证，仅展示分数与录用建议。</p>
        </div>

        <!-- 裁定详细数据 -->
        <el-descriptions :column="1" border style="margin-top: 20px">
          <el-descriptions-item label="最终状态">
            <el-tag :type="statusTagType(adjDetail.currentStatus)" size="small">
              {{ STATUS_LABEL[adjDetail.currentStatus] ?? adjDetail.currentStatus }}
            </el-tag>
          </el-descriptions-item>
          <template v-if="adjDetail.adjudication">
            <el-descriptions-item label="裁定阈值">
              {{
                `${thresholdValue}分（≥${thresholdValue + 10} 录用 / ≥${thresholdValue} 需修改 / < ${thresholdValue} 拒绝）`
              }}
            </el-descriptions-item>
          </template>
          <el-descriptions-item label="裁定时间">
            {{ adjDetail.adjudicatedAt ? new Date(adjDetail.adjudicatedAt).toLocaleString("zh-CN") : "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="裁定 TxHash">
            <span class="mono">{{ adjDetail.txHash ?? "-" }}</span>
            <el-tag v-if="adjDetail.adjudication?.simulated" type="warning" size="small" style="margin-left:8px">模拟</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="区块高度">
            {{ adjDetail.blockHeight ?? "-" }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 修改意见（仅需修改时展示） -->
        <div v-if="adjDetail.currentStatus === 'REVISION'" class="revision-section">
          <div class="revision-title">修改意见</div>
          <p class="revision-text">
            您的稿件需修改后重新提交。请根据审稿人意见修改全文后，使用下方「提交修订稿」上传新文件，或前往投稿页重新投稿。
          </p>
          <p class="revision-text secondary">如有疑问可联系会议管理员。</p>
          <div class="revision-actions">
            <el-button type="primary" @click="openReviseDialog" :loading="reviseUploading">
              提交修订稿
            </el-button>
            <el-button @click="router.push('/author/submit'); adjDrawerVisible = false">
              去投稿
            </el-button>
          </div>
        </div>

        <el-alert
          v-if="adjDetail.currentStatus === 'ACCEPTED'"
          type="success"
          show-icon
          :closable="false"
          style="margin-top: 16px"
        >
          恭喜！您的稿件已被录用。版权存证与裁定结果均已上链，具有不可篡改的法律效力。
        </el-alert>
        <el-alert
          v-else-if="adjDetail.currentStatus === 'REJECTED'"
          type="error"
          show-icon
          :closable="false"
          style="margin-top: 16px"
        >
          很遗憾，您的稿件未被录用。您可以修改后重新投稿至其他会议。
        </el-alert>

        <div v-if="adjDetail.currentStatus !== 'REVISION'" style="margin-top: 16px">
          <el-button @click="adjDrawerVisible = false">关闭</el-button>
          <el-button v-if="adjDetail.currentStatus === 'REJECTED'" type="primary" link @click="router.push('/author/submit'); adjDrawerVisible = false">
            去投稿
          </el-button>
        </div>
      </template>
    </el-drawer>

    <!-- 提交修订稿对话框 -->
    <el-dialog v-model="reviseDialogVisible" title="提交修订稿" width="480px">
      <p class="revise-desc">请上传修改后的稿件文件（PDF/Word，≤20MB），系统将重新计算哈希并上链存证。</p>
      <el-upload
        ref="reviseUploadRef"
        :auto-upload="false"
        :limit="1"
        accept=".pdf,.doc,.docx"
        :on-change="onReviseFileChange"
        :on-remove="() => reviseFile = null"
      >
        <el-button type="primary">选择文件</el-button>
      </el-upload>
      <template #footer>
        <el-button @click="reviseDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="reviseUploading" :disabled="!reviseFile" @click="submitRevise">
          提交修订稿
        </el-button>
      </template>
    </el-dialog>
    <!-- 区块链存证证书对话框 -->
    <CertificateDialog
      v-if="certPaper"
      v-model="certDialogVisible"
      :paper="certPaper"
    />
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import CertificateDialog from "../../components/CertificateDialog.vue";
import { api } from "../../services/api";

interface Paper {
  id: string;
  title: string;
  abstract: string;
  keywords: string;
  status: string;
  certifySimulated?: boolean | null;
  fileHash: string | null;
  txHash: string | null;
  blockHeight: number | null;
  certifiedAt: string | null;
  createdAt: string;
}

const RECOMMENDATION_LABEL: Record<string, string> = {
  STRONG_ACCEPT: "强烈录用",
  ACCEPT: "录用",
  WEAK_ACCEPT: "需修改后录用",
  REJECT: "拒绝",
};

interface ReviewResultItem {
  score: number;
  recommendation: string;
  comment?: string | null;
  submittedAt: string;
}

interface AdjudicationDetail {
  paperId: string;
  paperTitle: string;
  currentStatus: string;
  adjudication: Record<string, unknown> | null;
  adjudicatedAt: string | null;
  txHash: string | null;
  blockHeight: number | null;
  reviewResults?: ReviewResultItem[];
  averageScore?: number | null;
}

const router = useRouter();
const papers = ref<Paper[]>([]);
const loading = ref(false);
const drawerVisible = ref(false);
const selectedPaper = ref<Paper | null>(null);

const adjDrawerVisible = ref(false);
const adjLoading = ref(false);
const adjDetail = ref<AdjudicationDetail | null>(null);

const reviseDialogVisible = ref(false);
const reviseFile = ref<File | null>(null);
const reviseUploading = ref(false);
const reviseUploadRef = ref();

const certDialogVisible = ref(false);
const certPaper = ref<Paper | null>(null);

const FINAL_STATUSES = ["ACCEPTED", "REVISION", "REJECTED"];

const thresholdValue = computed(() => {
  const payload = (adjDetail.value?.adjudication ?? null) as any;
  const t = payload?.threshold;
  return typeof t === "number" ? t : 70;
});

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

async function showAdjudication(paper: Paper) {
  adjDrawerVisible.value = true;
  adjLoading.value = true;
  adjDetail.value = null;
  try {
    const { data } = await api.get<AdjudicationDetail>(`/papers/${paper.id}/adjudication`);
    adjDetail.value = data;
  } catch {
    ElMessage.error("获取裁定详情失败");
    adjDrawerVisible.value = false;
  } finally {
    adjLoading.value = false;
  }
}

function openCertificate(paper: Paper) {
  certPaper.value = paper;
  certDialogVisible.value = true;
}

function openReviseDialog() {
  reviseFile.value = null;
  reviseUploadRef.value?.clearFiles?.();
  reviseDialogVisible.value = true;
}

function onReviseFileChange(_uploadFile: unknown, uploadFiles: { raw: File }[]) {
  reviseFile.value = uploadFiles[0]?.raw ?? null;
}

async function submitRevise() {
  if (!adjDetail.value || !reviseFile.value) return;
  reviseUploading.value = true;
  try {
    const form = new FormData();
    form.append("file", reviseFile.value);
    await api.post(`/papers/${adjDetail.value.paperId}/revise`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    ElMessage.success("修订稿已提交并重新存证");
    reviseDialogVisible.value = false;
    adjDrawerVisible.value = false;
    await fetchPapers();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message ?? "提交修订稿失败");
  } finally {
    reviseUploading.value = false;
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

function statusLabel(row: Paper) {
  if (row.status === "CERTIFIED" && row.certifySimulated) return "模拟存证";
  return STATUS_LABEL[row.status] ?? row.status;
}

function statusTagType(s: string) {
  return STATUS_TYPE[s] ?? "info";
}

function verdictClass(status: string) {
  if (status === "ACCEPTED") return "verdict-accepted";
  if (status === "REJECTED") return "verdict-rejected";
  return "verdict-revision";
}

function verdictIcon(status: string) {
  if (status === "ACCEPTED") return "✓";
  if (status === "REJECTED") return "✗";
  return "⟳";
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

onMounted(fetchPapers);
</script>

<style scoped>
.paper-list {
  max-width: 1300px;
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

.verdict-banner {
  border-radius: 8px;
  padding: 24px;
  text-align: center;
}

.verdict-accepted {
  background: linear-gradient(135deg, #f0f9eb, #e1f3d8);
  border: 1px solid #b3e19d;
}

.verdict-rejected {
  background: linear-gradient(135deg, #fef0f0, #fde2e2);
  border: 1px solid #fbc4c4;
}

.verdict-revision {
  background: linear-gradient(135deg, #fdf6ec, #faecd8);
  border: 1px solid #f5dab1;
}

.verdict-icon {
  font-size: 36px;
  font-weight: 700;
  margin-bottom: 8px;
}

.verdict-accepted .verdict-icon { color: #67c23a; }
.verdict-rejected .verdict-icon { color: #f56c6c; }
.verdict-revision .verdict-icon { color: #e6a23c; }

.verdict-text {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 4px;
}

.verdict-accepted .verdict-text { color: #529b2e; }
.verdict-rejected .verdict-text { color: #c45656; }
.verdict-revision .verdict-text { color: #b88230; }

.verdict-paper {
  font-size: 13px;
  color: #606266;
  margin-top: 6px;
}

.adj-score {
  font-size: 24px;
  font-weight: 700;
  color: #409eff;
}

.revision-section {
  margin-top: 20px;
  padding: 16px;
  background: #fdf6ec;
  border: 1px solid #f5dab1;
  border-radius: 8px;
}

.revision-title {
  font-size: 15px;
  font-weight: 700;
  color: #b88230;
  margin-bottom: 10px;
}

.revision-text {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.6;
  color: #606266;
}

.revision-text.secondary {
  color: #909399;
  font-size: 12px;
}

.revision-actions {
  margin-top: 14px;
  display: flex;
  gap: 12px;
}

.revise-desc {
  margin: 0 0 16px;
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
}

.review-section {
  margin-top: 20px;
  padding: 12px 0 0;
  border-top: 1px solid #ebeef5;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: #303133;
  margin-bottom: 10px;
}

.adj-score-line {
  font-size: 13px;
  color: #606266;
  margin-bottom: 10px;
}

.threshold-hint {
  font-size: 12px;
  color: #909399;
  margin-left: 6px;
}

.review-table {
  margin-bottom: 8px;
}

.review-note {
  margin: 0;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

.comment-text {
  font-size: 13px;
  color: #606266;
  white-space: pre-wrap;
}
</style>
