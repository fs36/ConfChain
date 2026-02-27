<template>
  <div class="review-assign">
    <!-- 分配审稿人 -->
    <el-card style="margin-bottom: 20px">
      <template #header>
        <div class="card-header">
          <span>审稿分配</span>
          <el-button type="primary" size="small" :loading="loadingPapers" @click="fetchPending">
            刷新待审稿件
          </el-button>
        </div>
      </template>

      <el-table :data="pendingPapers" v-loading="loadingPapers" stripe>
        <el-table-column prop="title" label="论文标题" min-width="200" />
        <el-table-column prop="author.name" label="作者" width="120">
          <template #default="{ row }">{{ row.author?.name ?? "-" }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="110">
          <template #default="{ row }">
            <el-tag size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              link
              size="small"
              :disabled="row.status === 'UNDER_REVIEW'"
              @click="openAssignDialog(row)"
            >
              分配审稿人
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

    <!-- 分配审稿人对话框 -->
    <el-dialog v-model="assignDialogVisible" title="分配审稿人" width="480px">
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
  author?: { name: string };
}

interface Reviewer {
  id: string;
  name: string;
  email: string;
}

const pendingPapers = ref<Paper[]>([]);
const reviewers = ref<Reviewer[]>([]);
const loadingPapers = ref(false);
const assignDialogVisible = ref(false);
const assigning = ref(false);
const adjudicatingId = ref<string | null>(null);
const assignTarget = ref<Paper | null>(null);

const assignForm = reactive({
  reviewerIds: [] as string[],
  deadlineAt: "",
});

async function fetchPending() {
  loadingPapers.value = true;
  try {
    const { data } = await api.get<Paper[]>("/papers/admin/all");
    pendingPapers.value = data;
  } catch {
    // 如后端暂未实现 admin/all，使用空列表占位
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

async function adjudicate(paperId: string) {
  adjudicatingId.value = paperId;
  try {
    const { data } = await api.post(`/reviews/adjudicate/${paperId}`, {});
    ElMessage.success(
      `裁定完成：平均分 ${data.averageScore}，结果：${data.finalStatus}`,
    );
    await fetchPending();
  } finally {
    adjudicatingId.value = null;
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

function statusLabel(s: string) {
  return STATUS_LABEL[s] ?? s;
}

onMounted(async () => {
  await fetchReviewers();
  await fetchPending();
});
</script>

<style scoped>
.review-assign {
  max-width: 1100px;
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
</style>
