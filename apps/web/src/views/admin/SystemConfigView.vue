<template>
  <div class="config-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>裁定阈值配置</span>
          <el-tag type="info" size="small">只影响最终录用/需修改/拒绝的分界线</el-tag>
        </div>
      </template>

      <div v-if="loading" style="padding: 40px; text-align: center">
        <el-skeleton :rows="3" animated />
      </div>

      <div v-else style="max-width: 520px">
        <p class="intro">
          当前裁定规则：平均分
          <strong>≥ 阈值 + 10</strong>
          录用，
          <strong>≥ 阈值</strong>
          需修改，
          <strong>&lt; 阈值</strong>
          拒绝。
        </p>

        <el-form :model="form" label-width="140px">
          <el-form-item label="录用分数阈值">
            <div class="threshold-block">
              <el-slider
                v-model="form.acceptThreshold"
                :min="0"
                :max="100"
                :step="5"
                show-input
                :input-size="'small'"
              />
              <div class="threshold-hint">
                阈值：<strong>{{ form.acceptThreshold }}</strong> 分
                （≥ {{ form.acceptThreshold + 10 }} 录用 /
                ≥ {{ form.acceptThreshold }} 需修改 /
                &lt; {{ form.acceptThreshold }} 拒绝）
              </div>
            </div>
          </el-form-item>

          <el-form-item>
            <el-button type="primary" :loading="saving" @click="save">保存阈值</el-button>
            <el-button @click="resetForm">重置</el-button>
          </el-form-item>
        </el-form>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { onMounted, reactive, ref } from "vue";
import { api } from "../../services/api";

interface ConfigForm {
  acceptThreshold: number;
}

const loading = ref(false);
const saving = ref(false);
let originalForm: ConfigForm | null = null;

const form = reactive<ConfigForm>({
  acceptThreshold: 70,
});

async function fetchConfig() {
  loading.value = true;
  try {
    const { data } = await api.get("/conf-config");
    if (data) {
      Object.assign(form, {
        acceptThreshold: data.acceptThreshold ?? 70,
      });
      originalForm = { ...form };
    }
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    await api.put("/conf-config", { ...form });
    ElMessage.success("阈值已保存");
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
