<template>
  <div class="config-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>会议参数配置</span>
          <el-tag type="info" size="small">修改后即时生效，影响后续分配与裁定行为</el-tag>
        </div>
      </template>

      <div v-if="loading" style="padding: 40px; text-align: center">
        <el-skeleton :rows="8" animated />
      </div>

      <el-form v-else :model="form" :rules="rules" ref="formRef" label-width="160px" style="max-width: 680px">
        <el-divider content-position="left">基本信息</el-divider>
        <el-form-item label="会议名称" prop="conferenceName">
          <el-input v-model="form.conferenceName" placeholder="请输入会议名称" />
        </el-form-item>
        <el-form-item label="投稿开始时间" prop="submitStartAt">
          <el-date-picker
            v-model="form.submitStartAt"
            type="datetime"
            placeholder="选择投稿开始时间"
            value-format="YYYY-MM-DDTHH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="投稿截止时间" prop="submitEndAt">
          <el-date-picker
            v-model="form.submitEndAt"
            type="datetime"
            placeholder="选择投稿截止时间"
            value-format="YYYY-MM-DDTHH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="审稿时长（天）" prop="reviewDays">
          <el-input-number v-model="form.reviewDays" :min="1" :max="180" style="width: 100%" />
        </el-form-item>

        <el-divider content-position="left">裁定规则</el-divider>
        <el-form-item label="录用分数阈值" prop="acceptThreshold">
          <el-slider
            v-model="form.acceptThreshold"
            :min="0"
            :max="100"
            :step="5"
            show-input
            :input-size="'small'"
          />
          <div class="threshold-hint">
            平均分 ≥ {{ form.acceptThreshold + 10 }} → 录用，
            ≥ {{ form.acceptThreshold }} → 需修改，
            &lt; {{ form.acceptThreshold }} → 拒绝
          </div>
        </el-form-item>

        <el-divider content-position="left">评审权重（合计应为 100）</el-divider>
        <el-form-item label="创新性权重" prop="weightInnovation">
          <div class="weight-row">
            <el-slider v-model="form.weightInnovation" :min="0" :max="100" :step="5" show-input :input-size="'small'" />
            <span class="weight-pct">{{ form.weightInnovation }}%</span>
          </div>
        </el-form-item>
        <el-form-item label="科学性权重" prop="weightScience">
          <div class="weight-row">
            <el-slider v-model="form.weightScience" :min="0" :max="100" :step="5" show-input :input-size="'small'" />
            <span class="weight-pct">{{ form.weightScience }}%</span>
          </div>
        </el-form-item>
        <el-form-item label="写作规范权重" prop="weightWriting">
          <div class="weight-row">
            <el-slider v-model="form.weightWriting" :min="0" :max="100" :step="5" show-input :input-size="'small'" />
            <span class="weight-pct">{{ form.weightWriting }}%</span>
          </div>
        </el-form-item>
        <el-form-item>
          <el-tag
            :type="weightTotal === 100 ? 'success' : 'danger'"
            style="margin-bottom: 8px"
          >
            权重合计：{{ weightTotal }} / 100
          </el-tag>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="saving" @click="save">保存配置</el-button>
          <el-button @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import type { FormInstance, FormRules } from "element-plus";
import { computed, onMounted, reactive, ref } from "vue";
import { api } from "../../services/api";

interface ConfigForm {
  conferenceName: string;
  submitStartAt: string;
  submitEndAt: string;
  reviewDays: number;
  acceptThreshold: number;
  weightInnovation: number;
  weightScience: number;
  weightWriting: number;
}

const loading = ref(false);
const saving = ref(false);
const formRef = ref<FormInstance>();
let originalForm: ConfigForm | null = null;

const form = reactive<ConfigForm>({
  conferenceName: "",
  submitStartAt: "",
  submitEndAt: "",
  reviewDays: 14,
  acceptThreshold: 70,
  weightInnovation: 40,
  weightScience: 40,
  weightWriting: 20,
});

const weightTotal = computed(
  () => form.weightInnovation + form.weightScience + form.weightWriting,
);

const rules: FormRules = {
  conferenceName: [{ required: true, message: "请填写会议名称" }],
  submitStartAt: [{ required: true, message: "请选择投稿开始时间" }],
  submitEndAt: [{ required: true, message: "请选择投稿截止时间" }],
  reviewDays: [{ required: true, type: "number", message: "请填写审稿时长" }],
};

async function fetchConfig() {
  loading.value = true;
  try {
    const { data } = await api.get("/conf-config");
    if (data) {
      Object.assign(form, {
        conferenceName: data.conferenceName ?? "",
        submitStartAt: data.submitStartAt
          ? new Date(data.submitStartAt).toISOString().slice(0, 19)
          : "",
        submitEndAt: data.submitEndAt
          ? new Date(data.submitEndAt).toISOString().slice(0, 19)
          : "",
        reviewDays: data.reviewDays ?? 14,
        acceptThreshold: data.acceptThreshold ?? 70,
        weightInnovation: data.weightInnovation ?? 40,
        weightScience: data.weightScience ?? 40,
        weightWriting: data.weightWriting ?? 20,
      });
      originalForm = { ...form };
    }
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;
  if (weightTotal.value !== 100) {
    ElMessage.warning("三项权重之和必须为 100");
    return;
  }
  saving.value = true;
  try {
    await api.put("/conf-config", { ...form });
    ElMessage.success("配置已保存");
    originalForm = { ...form };
  } finally {
    saving.value = false;
  }
}

function resetForm() {
  if (originalForm) {
    Object.assign(form, originalForm);
  }
}

onMounted(fetchConfig);
</script>

<style scoped>
.config-view {
  max-width: 780px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.threshold-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.weight-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.weight-pct {
  font-weight: 700;
  min-width: 40px;
  text-align: right;
  color: #409eff;
}
</style>
