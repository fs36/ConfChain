<template>
  <div class="task-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>我的审稿任务</span>
          <el-button size="small" :loading="loading" @click="fetchTasks">刷新</el-button>
        </div>
      </template>

      <el-table :data="tasks" v-loading="loading" stripe>
        <el-table-column label="论文标题" min-width="200">
          <template #default="{ row }">{{ row.paper?.title ?? "-" }}</template>
        </el-table-column>
        <el-table-column label="关键词" min-width="160">
          <template #default="{ row }">
            <template v-if="row.paper?.keywords">
              <el-tag
                v-for="kw in row.paper.keywords.split(',')"
                :key="kw"
                size="small"
                style="margin: 2px"
              >
                {{ kw.trim() }}
              </el-tag>
            </template>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="任务状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.status === 'SUBMITTED' ? 'success' : 'warning'" size="small">
              {{ row.status === "SUBMITTED" ? "已提交" : "待审稿" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="截止时间" width="130">
          <template #default="{ row }">{{ formatDate(row.deadlineAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="info" link size="small" @click="viewPaper(row)">
              查看稿件
            </el-button>
            <el-button
              v-if="row.status !== 'SUBMITTED'"
              type="primary"
              link
              size="small"
              @click="openSubmitDialog(row)"
            >
              提交评审
            </el-button>
            <span v-else class="submitted-text">已完成</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 脱敏稿件详情抽屉（无作者信息） -->
    <el-drawer v-model="paperDrawerVisible" title="稿件内容（双盲审稿）" size="480px">
      <div v-if="paperLoading" class="paper-loading">
        <el-skeleton :rows="6" animated />
      </div>
      <template v-else-if="paperDetail">
        <el-alert type="info" show-icon :closable="false" style="margin-bottom: 16px">
          本视图已隐藏作者信息，符合双盲匿名审稿规范。
        </el-alert>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="论文标题">
            <strong>{{ paperDetail.title }}</strong>
          </el-descriptions-item>
          <el-descriptions-item label="关键词">
            <el-tag
              v-for="kw in (paperDetail.keywords ?? '').split(',')"
              :key="kw"
              size="small"
              style="margin: 2px"
            >
              {{ kw.trim() }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="摘要">
            <p class="abstract-text">{{ paperDetail.abstract }}</p>
          </el-descriptions-item>
          <el-descriptions-item label="投稿时间">
            {{ new Date(paperDetail.createdAt).toLocaleDateString("zh-CN") }}
          </el-descriptions-item>
        </el-descriptions>
        <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center">
          <el-button type="primary" plain @click="downloadPaperFile(paperDetail.id)" :loading="downloading">
            下载原文
          </el-button>
          <el-button
            v-if="currentTask && currentTask.status !== 'SUBMITTED'"
            type="primary"
            @click="paperDrawerVisible = false; openSubmitDialog(currentTask)"
          >
            提交评审意见
          </el-button>
        </div>
      </template>
    </el-drawer>

    <!-- 提交评审对话框 -->
    <el-dialog v-model="dialogVisible" title="提交审稿意见" width="520px">
      <el-form :model="reviewForm" :rules="reviewRules" ref="reviewFormRef" label-position="top">
        <el-form-item label="综合评分（0-100）" prop="score">
          <el-input-number v-model="reviewForm.score" :min="0" :max="100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="录用建议" prop="recommendation">
          <el-select v-model="reviewForm.recommendation" style="width: 100%">
            <el-option label="强烈录用" value="STRONG_ACCEPT" />
            <el-option label="录用" value="ACCEPT" />
            <el-option label="需修改后录用" value="WEAK_ACCEPT" />
            <el-option label="拒绝" value="REJECT" />
          </el-select>
        </el-form-item>
        <el-form-item label="审稿意见" prop="comment">
          <el-input
            v-model="reviewForm.comment"
            type="textarea"
            :rows="5"
            placeholder="请输入详细审稿意见（哈希后匿名存证至区块链）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitReview">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import type { FormInstance, FormRules } from "element-plus";
import { onMounted, reactive, ref } from "vue";
import { api } from "../../services/api";

interface ReviewTask {
  id: string;
  paperId: string;
  status: string;
  deadlineAt: string;
  paper?: { id: string; title: string; keywords: string; abstract?: string };
}

interface PaperDetail {
  id: string;
  title: string;
  abstract: string;
  keywords: string;
  createdAt: string;
}

const tasks = ref<ReviewTask[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const submitting = ref(false);
const currentTask = ref<ReviewTask | null>(null);
const reviewFormRef = ref<FormInstance>();

const paperDrawerVisible = ref(false);
const paperDetail = ref<PaperDetail | null>(null);
const paperLoading = ref(false);
const downloading = ref(false);

const reviewForm = reactive({
  score: 70,
  recommendation: "",
  comment: "",
});

const reviewRules: FormRules = {
  score: [{ required: true, message: "请输入评分" }],
  recommendation: [{ required: true, message: "请选择录用建议" }],
  comment: [{ required: true, message: "请填写审稿意见" }],
};

async function fetchTasks() {
  loading.value = true;
  try {
    const { data } = await api.get<ReviewTask[]>("/reviews/tasks/me");
    tasks.value = data;
  } finally {
    loading.value = false;
  }
}

async function viewPaper(task: ReviewTask) {
  currentTask.value = task;
  paperDrawerVisible.value = true;
  paperLoading.value = true;
  paperDetail.value = null;
  try {
    const { data } = await api.get<PaperDetail>(`/reviews/paper/${task.paperId}`);
    paperDetail.value = data;
  } catch {
    ElMessage.error("获取稿件详情失败");
    paperDrawerVisible.value = false;
  } finally {
    paperLoading.value = false;
  }
}

async function downloadPaperFile(paperId: string) {
  downloading.value = true;
  try {
    const res = await api.get(`/papers/${paperId}/download-as-reviewer`, {
      responseType: "blob",
    });
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
  } finally {
    downloading.value = false;
  }
}

function openSubmitDialog(task: ReviewTask) {
  currentTask.value = task;
  reviewForm.score = 70;
  reviewForm.recommendation = "";
  reviewForm.comment = "";
  dialogVisible.value = true;
}

async function submitReview() {
  if (!reviewFormRef.value || !currentTask.value) return;
  const valid = await reviewFormRef.value.validate().catch(() => false);
  if (!valid) return;

  submitting.value = true;
  try {
    await api.post("/reviews/submit", {
      taskId: currentTask.value.id,
      score: reviewForm.score,
      recommendation: reviewForm.recommendation,
      comment: reviewForm.comment,
    });
    ElMessage.success("审稿意见已提交并上链");
    dialogVisible.value = false;
    await fetchTasks();
  } finally {
    submitting.value = false;
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

onMounted(fetchTasks);
</script>

<style scoped>
.task-list {
  max-width: 1100px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.submitted-text {
  font-size: 12px;
  color: #67c23a;
}

.abstract-text {
  margin: 0;
  line-height: 1.7;
  font-size: 13px;
  color: #303133;
  white-space: pre-wrap;
}

.paper-loading {
  padding: 20px;
}
</style>
