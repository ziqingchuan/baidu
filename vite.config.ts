import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/baidu/',
  build: {
    // 大依赖拆独立 chunk：echarts/antd/xlsx 只在对应懒加载页面用到时按需下载
    rolldownOptions: {
      output: {
        manualChunks(id: string) {
          // xlsx 仅数据管理页用（随懒加载下载）
          if (id.includes('node_modules/xlsx')) return 'xlsx'
          if (id.includes('@ant-design/icons')) return 'antd-icons'
          if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender') || id.includes('node_modules/echarts-for-react')) return 'echarts'
          if (id.includes('node_modules/antd') || id.includes('node_modules/@ant-design')) return 'antd'
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react'
          return undefined
        },
      },
    },
  },
})
