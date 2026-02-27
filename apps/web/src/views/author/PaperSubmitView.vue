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

        <el-form-item label="关键词（逗号分隔）" prop="keywordsInput">
          <el-input v-model="form.keywordsInput" placeholder="如：区块链, 匿名审稿, 版权存证" />
        </el-form-item>

        <el-form-item label="论文内容（用于哈希计算）" prop="fileContent">
          <el-input
            v-model="form.fileContent"
            type="textarea"
            :rows="6"
            placeholder="粘贴论文正文内容，用于计算哈希值（不会存储原文）"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="loading" @click="onSubmit">
            提交稿件
          </el-button>
          <el-button @click="router.push('/author/papers')">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import type { FormInstance, FormRules } from "element-plus";
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../../services/api";

const router = useRouter();
const formRef = ref<FormInstance>();
const loading = ref(false);

const form = reactive({
  title: "",
  abstract: "",
  keywordsInput: "",
  fileContent: "",
});

const rules: FormRules = {
  title: [{ required: true, message: "请输入论文标题" }],
  abstract: [{ required: true, message: "请输入摘要" }],
  keywordsInput: [{ required: true, message: "请输入关键词" }],
  fileContent: [{ required: true, message: "请粘贴论文内容" }],
};

async function onSubmit() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    const keywords = form.keywordsInput
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    const { data } = await api.post("/papers", {
      title: form.title,
      abstract: form.abstract,
      keywords,
      fileContent: form.fileContent,
      fileName: `${form.title}.txt`,
    });

    // 提交后立即存证
    await api.post(`/papers/${data.id}/certify`, { fileContent: form.fileContent });
    ElMessage.success("投稿并存证成功！");
    router.push("/author/papers");
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.paper-submit {
  max-width: 800px;
}
</style>
