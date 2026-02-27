import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    host: true, // 监听所有网卡，局域网可通过本机 IP（如 http://192.168.x.x:5173）访问
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        timeout: 60000,
      },
    },
  },
});
