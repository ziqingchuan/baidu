import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 部署在 /baidu/ 子路径下，资源统一加前缀（如改部署到域名根目录，再改成 '/'）
  base: '/baidu/',
  build: {
    // echarts 是首页必需（静态引入 + preload）；xlsx 仅数据管理页（懒加载）。
    // antd 不强制整库打包，交给 tree-shaking 只带实际用到的部分，减小首屏体积。
    rolldownOptions: {
      output: {
        manualChunks(id: string) {
          // xlsx 仅数据管理页用（随懒加载下载）
          if (id.includes('node_modules/xlsx')) return 'xlsx'
          if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender') || id.includes('node_modules/echarts-for-react')) return 'echarts'
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react'
          return undefined
        },
      },
    },
  },
})
