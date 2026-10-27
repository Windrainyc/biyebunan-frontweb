import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
/** 三个平台独立Origin；代理保留原始Origin，后端执行CSRF检查。 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [vue()],
    server: {
      host: '127.0.0.1',
      port: Number(env.VITE_PORT || 18770),
      strictPort: true,
      proxy: {
        '/api': { target: env.ZX_API_TARGET || 'http://127.0.0.1:18080', changeOrigin: false },
      },
    },
    build: { sourcemap: false },
  };
});
