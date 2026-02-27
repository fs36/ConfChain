<template>
  <div class="auth-page">
    <el-card class="auth-card" shadow="never">
      <div class="auth-header">
        <span class="auth-logo" aria-hidden="true">⛓</span>
        <h2>注册 ConfChain</h2>
        <p class="subtitle">基于区块链的学术会议平台</p>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="onRegister"
      >
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="请输入真实姓名（2-20字）" />
        </el-form-item>

        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="请输入邮箱" />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="8-20位，需包含大小写字母和数字"
          />
        </el-form-item>

        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width: 100%">
            <el-option label="作者（投稿）" value="AUTHOR" />
            <el-option label="审稿人" value="REVIEWER" />
          </el-select>
        </el-form-item>

        <el-button
          type="primary"
          native-type="submit"
          :loading="loading"
          style="width: 100%; margin-top: 8px"
          @click="onRegister"
        >
          注册
        </el-button>
      </el-form>

      <div class="auth-footer">
        已有账号？
        <el-link type="primary" @click="router.push('/login')">立即登录</el-link>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import type { FormInstance, FormRules } from "element-plus";
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const authStore = useAuthStore();
const formRef = ref<FormInstance>();
const loading = ref(false);

const form = reactive({
  name: "",
  email: "",
  password: "",
  role: "AUTHOR" as "AUTHOR" | "REVIEWER",
});

const rules: FormRules = {
  name: [
    { required: true, message: "请输入姓名" },
    { min: 2, max: 20, message: "姓名长度 2-20 字" },
  ],
  email: [
    { required: true, message: "请输入邮箱" },
    { type: "email", message: "请输入有效的邮箱地址" },
  ],
  password: [
    { required: true, message: "请输入密码" },
    { min: 8, max: 20, message: "密码长度 8-20 位" },
    {
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
      message: "密码需包含大小写字母和数字",
    },
  ],
  role: [{ required: true, message: "请选择角色" }],
};

async function onRegister() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    await authStore.register(form);
    ElMessage.success("注册成功，请登录");
    router.push("/login");
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, var(--color-bg-sidebar) 0%, #1a2332 50%, #0f1823 100%);
  padding: 24px;
}

.auth-card {
  width: 100%;
  max-width: 440px;
  border-radius: 12px;
  border: 1px solid var(--color-border-light);
  box-shadow: var(--shadow-modal);
  animation: auth-card-in 0.5s var(--ease-out) both;
}

@keyframes auth-card-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.auth-header {
  text-align: center;
  margin-bottom: 28px;
}

.auth-logo {
  font-size: 2.25rem;
  display: block;
  margin-bottom: 12px;
  opacity: 0.9;
}

.auth-header h2 {
  margin: 0 0 6px;
  font-size: 1.5rem;
  font-family: var(--font-heading);
  color: var(--color-text);
}

.subtitle {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-tertiary);
}

.auth-footer {
  margin-top: 24px;
  text-align: center;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}
</style>
