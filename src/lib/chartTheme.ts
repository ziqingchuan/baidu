/**
 * 统一 ECharts 柔和主题：低对比、高透明度、圆润。
 * 各图表 option 通过合并本对象获得一致质感。
 */
import type { EChartsOption } from 'echarts'

export const chartBase: EChartsOption = {
  textStyle: { color: '#7c818c', fontSize: 12 },
  // 柔和 tooltip
  tooltip: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderColor: 'rgba(0,0,0,0.06)',
    borderWidth: 1,
    padding: [10, 14],
    textStyle: { color: '#4a4f58', fontSize: 12 },
    extraCssText:
      'box-shadow: 0 8px 24px rgba(60,72,90,0.10); border-radius: 12px; backdrop-filter: blur(6px);',
  },
  // 柔和网格线（替代默认深色分割线）
  grid: { top: 48, left: 44, right: 20, bottom: 32 },
}

/** 柱状条统一圆角 */
export const barRadius: [number, number, number, number] = [6, 6, 2, 2]

/** 默认柔色序列（用于图例/序列，避免强对比） */
export const softPalette = ['#7aa7f0', '#a78bfa', '#6ccfcf', '#f2a08d', '#8bcfa6', '#f0b47e']

/** 生成指定色值的柔和半透明背景（用于区域/柱条） */
export function softFill(color: string, alpha = 0.75): string {
  const m = color.replace('#', '')
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const n = parseInt(full, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}
