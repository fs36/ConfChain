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
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
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
            placeholder="请输入详细审稿意见（匿名提交至区块链）"
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
  status: string;
  deadlineAt: string;
  paper?: { title: string; keywords: string };
}

const tasks = ref<ReviewTask[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const submitting = ref(false);
const currentTask = ref<ReviewTask | null>(null);
const reviewFormRef = ref<FormInstance>();

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
</style>
