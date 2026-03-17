import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 12309,
    cors: true,
    headers: {
      // ✅ 关键：允许从公共网络访问本地服务
      'Access-Control-Allow-Private-Network': 'true',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  },
  // 如果你有 proxy 配置，可能需要在这里也添加
  // proxy: {
  //   '/api': {
  //     target: 'http://10.72.234.127:8103',
  //     changeOrigin: true,
  //   }
  // }
})
