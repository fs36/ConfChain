import axios from "axios";
import { ElMessage } from "element-plus";

export const api = axios.create({
  baseURL: "/api",
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("cc_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const isVerifyPage =
      typeof window !== "undefined" && window.location.pathname === "/verify";
    const isVerifyApi =
      err.config?.url?.includes("/papers/verify") === true;

    if (status === 401) {
      if (isVerifyPage || isVerifyApi) {
        // 验证页及验证接口不要求登录，401 仅作为业务结果由页面处理，不跳转
        return Promise.reject(err);
      }
      localStorage.removeItem("cc_token");
      localStorage.removeItem("cc_user");
      location.href = "/login";
      ElMessage.error("登录已过期，请重新登录");
    } else if (status === 403) {
      ElMessage.error("权限不足");
    } else if (err.response?.data?.message) {
      ElMessage.error(
        Array.isArray(err.response.data.message)
          ? err.response.data.message.join("; ")
          : err.response.data.message,
      );
    } else {
      ElMessage.error("请求失败，请稍后重试");
    }
    return Promise.reject(err);
  },
);
