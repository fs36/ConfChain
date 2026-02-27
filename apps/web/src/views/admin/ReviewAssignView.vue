<template>
  <div class="review-assign">
    <!-- 稿件列表 -->
    <el-card style="margin-bottom: 20px">
      <template #header>
        <div class="card-header">
          <span>审稿分配</span>
          <el-button type="primary" size="small" :loading="loadingPapers" @click="fetchPending">
            刷新稿件列表
          </el-button>
        </div>
      </template>

      <el-table :data="pendingPapers" v-loading="loadingPapers" stripe>
        <el-table-column label="论文标题" min-width="160">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openPaperDetail(row)">
              {{ row.title }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="作者" width="120">
          <template #default="{ row }">{{ row.author?.name ?? "-" }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTagType(row.status)">
              {{ STATUS_LABEL[row.status] ?? row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="340" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              link
              size="small"
              :disabled="row.status === 'UNDER_REVIEW'"
              @click="openAssignDialog(row)"
            >
              手动分配
            </el-button>
            <el-button
              type="warning"
              link
              size="small"
              :disabled="row.status === 'UNDER_REVIEW'"
              @click="openAutoAssignDialog(row)"
            >
              自动分配
            </el-button>
            <el-button
              type="info"
              link
              size="small"
              v-if="row.status === 'UNDER_REVIEW'"
              @click="viewResults(row)"
            >
              查看意见
            </el-button>
            <el-button
              type="primary"
              link
              size="small"
              @click="openPaperDetail(row)"
            >
              稿件详情
            </el-button>
            <el-button
              type="success"
              link
              size="small"
              v-if="row.status === 'UNDER_REVIEW'"
              @click="adjudicate(row.id)"
              :loading="adjudicatingId === row.id"
            >
              裁定
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 手动分配审稿人对话框 -->
    <el-dialog v-model="assignDialogVisible" title="手动分配审稿人" width="480px">
      <p class="dialog-paper">稿件：<strong>{{ assignTarget?.title }}</strong></p>
      <el-form :model="assignForm" label-position="top">
        <el-form-item label="选择审稿人（多选）">
          <el-select
            v-model="assignForm.reviewerIds"
            multiple
            style="width: 100%"
            placeholder="请选择审稿人"
          >
            <el-option
              v-for="u in reviewers"
              :key="u.id"
              :label="`${u.name} (${u.email})`"
              :value="u.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="审稿截止日期">
          <el-date-picker
            v-model="assignForm.deadlineAt"
            type="date"
            style="width: 100%"
            placeholder="选择截止日期"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="assigning" @click="submitAssign">确认分配</el-button>
      </template>
    </el-dialog>

    <!-- 自动分配对话框 -->
    <el-dialog v-model="autoAssignDialogVisible" title="自动分配（负载均衡）" width="420px">
      <p class="dialog-paper">稿件：<strong>{{ assignTarget?.title }}</strong></p>
      <el-alert type="info" show-icon :closable="false" style="margin-bottom: 16px">
        系统将自动选择当前任务量最少的审稿人，保证负载均衡。
      </el-alert>
      <el-form label-position="top">
        <el-form-item label="分配审稿人数量">
          <el-input-number v-model="autoAssignForm.count" :min="1" :max="10" style="width: 100%" />
        </el-form-item>
        <el-form-item label="审稿截止日期">
          <el-date-picker
            v-model="autoAssignForm.deadlineAt"
            type="date"
            style="width: 100%"
            placeholder="选择截止日期"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="autoAssignDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="autoAssigning" @click="submitAutoAssign">
          自动分配
        </el-button>
      </template>
    </el-dialog>

    <!-- 审稿意见汇总对话框 -->
    <el-dialog v-model="resultsDialogVisible" title="审稿意见汇总" width="600px">
      <div v-if="loadingResults" style="text-align: center; padding: 40px">
        <el-skeleton :rows="4" animated />
      </div>
      <template v-else-if="reviewResults">
        <el-descriptions :column="2" border style="margin-bottom: 16px">
          <el-descriptions-item label="稿件">{{ reviewResultsPaperTitle }}</el-descriptions-item>
          <el-descriptions-item label="评审数量">
            <el-tag type="primary">{{ reviewResults.count }} 条意见</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="平均分">
            <span v-if="reviewResults.averageScore !== null" class="avg-score">
              {{ reviewResults.averageScore }}
              <el-tag
                size="small"
                :type="reviewResults.averageScore >= 80 ? 'success' : reviewResults.averageScore >= 70 ? 'warning' : 'danger'"
                style="margin-left: 8px"
              >
                {{ reviewResults.averageScore >= 80 ? "建议录用" : reviewResults.averageScore >= 70 ? "建议修改" : "建议拒绝" }}
              </el-tag>
            </span>
            <span v-else class="no-score">暂无</span>
          </el-descriptions-item>
          <el-descriptions-item label="裁定阈值">70 分（≥80 录用，≥70 修改，&lt;70 拒绝）</el-descriptions-item>
        </el-descriptions>

        <el-table :data="reviewResults.results" stripe>
          <el-table-column type="index" label="#" width="50" />
          <el-table-column prop="score" label="评分" width="80">
            <template #default="{ row }">
              <el-tag
                :type="row.score >= 80 ? 'success' : row.score >= 70 ? 'warning' : 'danger'"
                size="small"
              >
                {{ row.score }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="recommendation" label="建议" width="150">
            <template #default="{ row }">
              <el-tag size="small" :type="recTagType(row.recommendation)">
                {{ RECOMMENDATION_LABEL[row.recommendation] ?? row.recommendation }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="提交时间" width="130">
            <template #default="{ row }">
              {{ new Date(row.createdAt).toLocaleDateString("zh-CN") }}
            </template>
          </el-table-column>
          <el-table-column label="链上记录" min-width="130">
            <template #default="{ row }">
              <el-tooltip v-if="row.txHash" :content="row.txHash" placement="top">
                <el-tag type="success" size="small">{{ row.txHash.slice(0, 12) }}...</el-tag>
              </el-tooltip>
              <el-tag v-else type="info" size="small">未上链</el-tag>
            </template>
          </el-table-column>
        </el-table>

        <div style="margin-top: 16px; text-align: right">
          <el-button
            v-if="reviewResultsPaperId"
            type="success"
            :loading="adjudicatingId === reviewResultsPaperId"
            @click="adjudicateFromResults"
          >
            立即裁定
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 稿件详情抽屉（管理员：分数、结果、审核意见） -->
    <el-drawer v-model="paperDetailDrawerVisible" title="稿件详情" size="560px">
      <div v-if="paperDetailLoading" style="padding: 20px">
        <el-skeleton :rows="6" animated />
      </div>
      <template v-else-if="paperDetailData">
        <el-descriptions :column="1" border style="margin-bottom: 16px">
          <el-descriptions-item label="论文标题">
            <strong>{{ paperDetailData.paper.title }}</strong>
          </el-descriptions-item>
          <el-descriptions-item label="作者">
            {{ paperDetailData.paper.author?.name ?? "-" }}
            <span v-if="paperDetailData.paper.author?.email" class="author-email">
              （{{ paperDetailData.paper.author.email }}）
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="摘要">
            <p class="abstract-p">{{ paperDetailData.paper.abstract }}</p>
          </el-descriptions-item>
          <el-descriptions-item label="关键词">
            {{ paperDetailData.paper.keywords }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag size="small" :type="statusTagType(paperDetailData.paper.status)">
              {{ STATUS_LABEL[paperDetailData.paper.status] ?? paperDetailData.paper.status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="操作">
            <el-button type="primary" size="small" @click="downloadAdminPaper(paperDetailData.paper.id)">
              下载稿件文件
            </el-button>
          </el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">审稿意见汇总</el-divider>
        <el-descriptions :column="2" border style="margin-bottom: 12px">
          <el-descriptions-item label="评审条数">{{ paperDetailData.results.count }}</el-descriptions-item>
          <el-descriptions-item label="平均分">
            <span v-if="paperDetailData.results.averageScore !== null" class="avg-num">
              {{ paperDetailData.results.averageScore }}
            </span>
            <span v-else>-</span>
          </el-descriptions-item>
        </el-descriptions>
        <el-table :data="paperDetailData.results.results" stripe size="small">
          <el-table-column type="index" label="#" width="48" />
          <el-table-column prop="score" label="分数" width="72">
            <template #default="{ row }">
              <el-tag
                :type="row.score >= 80 ? 'success' : row.score >= 70 ? 'warning' : 'danger'"
                size="small"
              >
                {{ row.score }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="recommendation" label="录用建议" width="110">
            <template #default="{ row }">
              {{ RECOMMENDATION_LABEL[row.recommendation] ?? row.recommendation }}
            </template>
          </el-table-column>
          <el-table-column label="审核意见" min-width="100">
            <template #default>
              <el-tooltip content="评语已哈希上链存证，仅存证不可读">
                <el-tag type="info" size="small">已上链存证</el-tag>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="提交时间" width="100">
            <template #default="{ row }">
              {{ new Date(row.createdAt).toLocaleDateString("zh-CN") }}
            </template>
          </el-table-column>
          <el-table-column label="TxHash" width="100">
            <template #default="{ row }">
              <el-tooltip v-if="row.txHash" :content="row.txHash">
                <span class="hash-short">{{ row.txHash.slice(0, 8) }}…</span>
              </el-tooltip>
              <span v-else>-</span>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="paperDetailData.paper.status === 'UNDER_REVIEW'" style="margin-top: 16px; text-align: right">
          <el-button
            type="success"
            :loading="adjudicatingId === paperDetailData.paper.id"
            @click="adjudicate(paperDetailData.paper.id); paperDetailDrawerVisible = false"
          >
            裁定
          </el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { onMounted, reactive, ref } from "vue";
import { api } from "../../services/api";

interface Paper {
  id: string;
  title: string;
  status: string;
  abstract?: string;
  keywords?: string;
  certifySimulated?: boolean | null;
  author?: { name: string; email?: string };
}

interface Reviewer {
  id: string;
  name: string;
  email: string;
}

interface ReviewResultItem {
  id: string;
  score: number;
  recommendation: string;
  txHash: string | null;
  createdAt: string;
}

interface ReviewResults {
  paperId: string;
  count: number;
  averageScore: number | null;
  results: ReviewResultItem[];
}

const pendingPapers = ref<Paper[]>([]);
const reviewers = ref<Reviewer[]>([]);
const loadingPapers = ref(false);
const assignDialogVisible = ref(false);
const autoAssignDialogVisible = ref(false);
const assigning = ref(false);
const autoAssigning = ref(false);
const adjudicatingId = ref<string | null>(null);
const assignTarget = ref<Paper | null>(null);

const resultsDialogVisible = ref(false);
const loadingResults = ref(false);
const reviewResults = ref<ReviewResults | null>(null);
const reviewResultsPaperTitle = ref("");
const reviewResultsPaperId = ref("");

const paperDetailDrawerVisible = ref(false);
const paperDetailLoading = ref(false);
const paperDetailData = ref<{
  paper: Paper & { author?: { name: string; email: string } };
  results: ReviewResults;
} | null>(null);

const assignForm = reactive({
  reviewerIds: [] as string[],
  deadlineAt: "",
});

const autoAssignForm = reactive({
  count: 3,
  deadlineAt: "",
});

const STATUS_LABEL: Record<string, string> = {
  UPLOADED: "已上传",
  CERTIFIED: "已存证",
  UNDER_REVIEW: "审稿中",
  ACCEPTED: "已录用",
  REVISION: "需修改",
  REJECTED: "已拒绝",
};

const RECOMMENDATION_LABEL: Record<string, string> = {
  STRONG_ACCEPT: "强烈录用",
  ACCEPT: "录用",
  WEAK_ACCEPT: "修改后录用",
  REJECT: "拒绝",
};

function statusTagType(status: string) {
  const map: Record<string, "success" | "warning" | "danger" | "info"> = {
    UPLOADED: "info",
    CERTIFIED: "info",
    UNDER_REVIEW: "warning",
    ACCEPTED: "success",
    REVISION: "warning",
    REJECTED: "danger",
  };
  return map[status] ?? "info";
}

function recTagType(rec: string) {
  const map: Record<string, "success" | "warning" | "danger" | "info"> = {
    STRONG_ACCEPT: "success",
    ACCEPT: "success",
    WEAK_ACCEPT: "warning",
    REJECT: "danger",
  };
  return map[rec] ?? "info";
}

async function fetchPending() {
  loadingPapers.value = true;
  try {
    const { data } = await api.get<Paper[]>("/papers/admin/all");
    pendingPapers.value = data;
  } catch {
    pendingPapers.value = [];
  } finally {
    loadingPapers.value = false;
  }
}

async function fetchReviewers() {
  const { data } = await api.get<Reviewer[]>("/users");
  reviewers.value = data.filter((u: any) => u.role === "REVIEWER");
}

function openAssignDialog(paper: Paper) {
  assignTarget.value = paper;
  assignForm.reviewerIds = [];
  assignForm.deadlineAt = "";
  assignDialogVisible.value = true;
}

function openAutoAssignDialog(paper: Paper) {
  assignTarget.value = paper;
  autoAssignForm.count = 3;
  autoAssignForm.deadlineAt = "";
  autoAssignDialogVisible.value = true;
}

async function openPaperDetail(paper: Paper) {
  paperDetailDrawerVisible.value = true;
  paperDetailLoading.value = true;
  paperDetailData.value = null;
  try {
    const { data } = await api.get<{ paper: Paper & { author?: { name: string; email: string } }; results: ReviewResults }>(
      `/reviews/admin/paper-detail/${paper.id}`,
    );
    paperDetailData.value = data;
  } catch {
    ElMessage.error("获取稿件详情失败");
    paperDetailDrawerVisible.value = false;
  } finally {
    paperDetailLoading.value = false;
  }
}

async function downloadAdminPaper(paperId: string) {
  try {
    const res = await api.get(`/papers/${paperId}/download`, { responseType: "blob" });
    const disposition = res.headers["content-disposition"];
    const fileName =
      disposition?.split("filename=")[1]?.replace(/^"|"$/g, "").trim() ?? "paper.pdf";
    const url = window.URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
    ElMessage.success("文件已开始下载");
  } catch {
    ElMessage.error("下载失败");
  }
}

async function submitAssign() {
  if (!assignTarget.value || !assignForm.deadlineAt || assignForm.reviewerIds.length === 0) {
    ElMessage.warning("请选择审稿人和截止日期");
    return;
  }
  assigning.value = true;
  try {
    await api.post("/reviews/assign", {
      paperId: assignTarget.value.id,
      reviewerIds: assignForm.reviewerIds,
      deadlineAt: new Date(assignForm.deadlineAt).toISOString(),
    });
    ElMessage.success("分配成功");
    assignDialogVisible.value = false;
    await fetchPending();
  } finally {
    assigning.value = false;
  }
}

async function submitAutoAssign() {
  if (!assignTarget.value || !autoAssignForm.deadlineAt) {
    ElMessage.warning("请填写截止日期");
    return;
  }
  autoAssigning.value = true;
  try {
    const { data } = await api.post("/reviews/auto-assign", {
      paperId: assignTarget.value.id,
      count: autoAssignForm.count,
      deadlineAt: new Date(autoAssignForm.deadlineAt).toISOString(),
    });
    ElMessage.success(`自动分配完成，共分配 ${data.length} 位审稿人`);
    autoAssignDialogVisible.value = false;
    await fetchPending();
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message ?? "自动分配失败，可能没有可用审稿人");
  } finally {
    autoAssigning.value = false;
  }
}

async function viewResults(paper: Paper) {
  reviewResultsPaperTitle.value = paper.title;
  reviewResultsPaperId.value = paper.id;
  resultsDialogVisible.value = true;
  loadingResults.value = true;
  reviewResults.value = null;
  try {
    const { data } = await api.get<ReviewResults>(`/reviews/results/${paper.id}`);
    reviewResults.value = data;
  } catch {
    ElMessage.error("获取审稿意见失败");
    resultsDialogVisible.value = false;
  } finally {
    loadingResults.value = false;
  }
}

async function adjudicate(paperId: string) {
  adjudicatingId.value = paperId;
  try {
    const { data } = await api.post(`/reviews/adjudicate/${paperId}`, {});
    ElMessage.success(
      `裁定完成：平均分 ${data.averageScore}，结果：${STATUS_LABEL[data.finalStatus] ?? data.finalStatus}`,
    );
    await fetchPending();
  } finally {
    adjudicatingId.value = null;
  }
}

async function adjudicateFromResults() {
  if (!reviewResultsPaperId.value) return;
  await adjudicate(reviewResultsPaperId.value);
  resultsDialogVisible.value = false;
}

onMounted(async () => {
  await fetchReviewers();
  await fetchPending();
});
</script>

<style scoped>
.review-assign {
  max-width: 1200px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dialog-paper {
  margin: 0 0 16px;
  color: #606266;
}

.author-email {
  font-size: 12px;
  color: #909399;
}

.abstract-p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.avg-num {
  font-weight: 700;
  font-size: 18px;
  color: #409eff;
}

.hash-short {
  font-family: monospace;
  font-size: 11px;
  cursor: default;
}

.avg-score {
  font-size: 22px;
  font-weight: 700;
  color: #303133;
}

.no-score {
  color: #c0c4cc;
}
</style>
