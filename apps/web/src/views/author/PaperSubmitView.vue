<template>
  <div class="paper-submit">
    <el-card>
      <template #header>
        <span>提交新稿件</span>
      </template>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        style="max-width: 680px"
      >
        <el-form-item label="论文标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入论文标题" />
        </el-form-item>

        <el-form-item label="摘要" prop="abstract">
          <el-input
            v-model="form.abstract"
            type="textarea"
            :rows="4"
            placeholder="请输入论文摘要"
          />
        </el-form-item>

        <el-form-item label="关键词（逗号分隔）" prop="keywords">
          <el-input v-model="form.keywords" placeholder="如：区块链, 匿名审稿, 版权存证" />
        </el-form-item>

        <el-form-item label="上传论文文件（PDF/Word，≤20MB）" prop="file">
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :limit="1"
            accept=".pdf,.doc,.docx"
            :on-change="onFileChange"
            :on-remove="onFileRemove"
            drag
          >
            <el-icon style="font-size: 36px; color: #409eff"><Upload /></el-icon>
            <div style="margin-top: 8px; font-size: 14px; color: #606266">
              拖拽文件到此处，或
              <span style="color: #409eff; cursor: pointer">点击上传</span>
            </div>
            <template #tip>
              <div class="upload-tip">支持 .pdf / .doc / .docx，单文件不超过 20MB</div>
            </template>
          </el-upload>
        </el-form-item>

        <!-- 上传进度 -->
        <el-progress
          v-if="uploading"
          :percentage="uploadProgress"
          status="striped"
          striped-flow
          style="margin-bottom: 16px"
        />

        <el-form-item>
          <el-button type="primary" :loading="loading" @click="onSubmit">
            提交并存证
          </el-button>
          <el-button @click="router.push('/author/papers')">取消</el-button>
        </el-form-item>
      </el-form>

      <!-- 存证成功结果展示 -->
      <el-result
        v-if="certifyResult"
        icon="success"
        title="投稿并版权存证成功"
        style="margin-top: 24px"
      >
        <template #sub-title>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="论文标题">{{ certifyResult.title }}</el-descriptions-item>
            <el-descriptions-item label="文件哈希">
              <span class="mono">{{ certifyResult.fileHash }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="交易哈希 (TxHash)">
              <el-tag type="success" class="mono">{{ certifyResult.txHash }}</el-tag>
              <el-tag v-if="certifyResult.simulated" type="warning" size="small" style="margin-left:8px">模拟</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="区块高度">
              {{ certifyResult.blockHeight }}
            </el-descriptions-item>
            <el-descriptions-item label="存证时间">
              {{ new Date(certifyResult.certifiedAt).toLocaleString("zh-CN") }}
            </el-descriptions-item>
          </el-descriptions>
        </template>
        <template #extra>
          <el-button type="primary" @click="router.push('/author/papers')">查看我的稿件</el-button>
        </template>
      </el-result>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { Upload } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import type { FormInstance, FormRules, UploadFile } from "element-plus";
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../../services/api";

const router = useRouter();
const formRef = ref<FormInstance>();
const loading = ref(false);
const uploading = ref(false);
const uploadProgress = ref(0);
const selectedFile = ref<File | null>(null);
const certifyResult = ref<any>(null);

const form = reactive({
  title: "",
  abstract: "",
  keywords: "",
});

const rules: FormRules = {
  title: [{ required: true, message: "请输入论文标题" }],
  abstract: [{ required: true, message: "请输入摘要" }],
  keywords: [{ required: true, message: "请输入关键词" }],
};

function onFileChange(file: UploadFile) {
  if (file.raw) {
    selectedFile.value = file.raw;
  }
}

function onFileRemove() {
  selectedFile.value = null;
}

async function onSubmit() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  if (!selectedFile.value) {
    ElMessage.warning("请上传论文文件");
    return;
  }

  loading.value = true;
  uploading.value = true;
  uploadProgress.value = 0;

  try {
    const formData = new FormData();
    formData.append("title", form.title);
    formData.append("abstract", form.abstract);
    formData.append("keywords", form.keywords);
    formData.append("file", selectedFile.value);

    const { data } = await api.post("/papers", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 90000,
      onUploadProgress: (e) => {
        if (e.total) {
          uploadProgress.value = Math.round((e.loaded * 100) / e.total);
        }
      },
    });

    certifyResult.value = data;
    ElMessage.success(data.simulated ? "投稿成功（链为模拟模式）" : "投稿并链上存证成功！");
  } finally {
    loading.value = false;
    uploading.value = false;
  }
}
</script>

<style scoped>
.paper-submit {
  max-width: 800px;
}

.upload-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.mono {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}
</style>
