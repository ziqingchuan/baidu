/** 看板分类体系：五大工作类别 + 待归类 */
export interface Category {
  id: CategoryId
  name: string
  /** 主色（列头 / 标签 / 图表配色） */
  color: string
  /** 一句话说明，用于引导归类 */
  hint: string
}

export type CategoryId =
  | 'feature'
  | 'ux'
  | 'efficiency'
  | 'bugfix'
  | 'engineering'
  | 'unassigned'

export const CATEGORIES: Category[] = [
  { id: 'feature', name: '功能实现', color: '#7aa7f0', hint: '新功能、新能力、模块开发' },
  { id: 'ux', name: '用户体验', color: '#a78bfa', hint: '交互优化、视觉、易用性' },
  { id: 'efficiency', name: '工作提效', color: '#6ccfcf', hint: '提效工具、自动化、流程改进' },
  { id: 'bugfix', name: 'Bug修复', color: '#f2a08d', hint: '缺陷、线上问题、兼容性' },
  { id: 'engineering', name: '工程建设', color: '#8bcfa6', hint: '重构、工程治理、基建、文档' },
]

export const UNASSIGNED_CATEGORY: Category = {
  id: 'unassigned',
  name: '待归类',
  color: '#b8bcc4',
  hint: '尚未归类的任务，拖拽到对应分类',
}

/** 生成柔和浅色背景（透明度 tint），用于列头/标签/图表底色 */
export function softTint(color: string, alpha = 0.14): string {
  return hexToRgba(color, alpha)
}

/** 生成较深的可读文字色（用于浅色背景上的标题/标签文字） */
export function deepTint(color: string): string {
  return hexToRgba(color, 0.85)
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '')
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const n = parseInt(full, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const ALL_COLUMNS: Category[] = [...CATEGORIES, UNASSIGNED_CATEGORY]

export function categoryById(id: CategoryId | undefined): Category {
  return (
    ALL_COLUMNS.find((c) => c.id === id) ??
    UNASSIGNED_CATEGORY
  )
}

/** 按任务标题/类型关键词自动建议分类（仅作初始值，用户可拖拽修改） */
export function autoSuggestCategory(title: string, type: string): CategoryId {
  const t = `${title} ${type}`
  // Bug/修复
  if (/bug|fix|修复|缺陷|故障|异常|崩溃|卡顿|兼容|报错|onerror|闪退/.test(t)) return 'bugfix'
  // 提效/工具/自动化
  if (/提效|效率|自动化|工具|脚本|harness|一键|快捷|模板|批量|减少|省|提速|复用/.test(t)) return 'efficiency'
  // 工程/基建/质量
  if (/重构|治理|初始化|搭建|基建|工程|架构|规范|文档|脚手架|质量|发布|发版|release|升级|版本|打包|构建|迁移|性能优化|监控/.test(t)) return 'engineering'
  // 用户体验
  if (/体验|优化|交互|视觉|样式|ui|hover|图标|走查|动效|动画|弹窗|提示|输入框|按钮|页面|界面|美观|细节|反馈/.test(t)) return 'ux'
  return 'feature'
}
