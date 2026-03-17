import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  
  server: {
    port: 12309,        // 设置端口为 12309
    host: '0.0.0.0',    // 允许外部访问
    cors: true,         // ✅ 启用 CORS
    
    // 可选：如果需要更细粒度的控制
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  },
  
  // 如果你使用的端口不是 12309，可以用 proxy 代理
  // server: {
  //   port: 5173,  // Vite 默认端口
  //   proxy: {
  //     // 这样可以保持原端口不变
  //   }
  // }
})
