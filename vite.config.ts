import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// 本地同源代理保留浏览器Origin供后端CSRF检查，生产由独立站点反向代理。
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 18770,
    strictPort: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:18080", changeOrigin: false },
    },
  },
  build: { sourcemap: false },
});
