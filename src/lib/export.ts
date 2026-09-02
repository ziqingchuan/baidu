import type { EventItem, EventMeta } from '../types'
import { CATEGORIES, categoryById } from './categories'
import { BUSINESSES, businessById } from './business'
import { effectiveCategory } from './boardStats'

/** 导出看板归类结果 + 打分反思 为 Markdown（用于转正汇报/年终总结） */
export function exportBoardMarkdown(events: EventItem[], metas: Record<string, EventMeta>): string {
  const lines: string[] = []
  lines.push('# 个人产出看板')
  lines.push('')
  lines.push(`> 导出时间：${new Date().toISOString().slice(0, 10)}`)
  lines.push(`> 共 ${events.length} 件事 · 已归类 ${events.filter((e) => effectiveCategory(e, metas) !== 'unassigned').length} 件`)
  lines.push('')

  for (const cat of CATEGORIES) {
    const items = events.filter((e) => effectiveCategory(e, metas) === cat.id)
    if (!items.length) continue
    const totalIns = items.reduce((a, e) => a + e.insertions, 0)
    const totalDel = items.reduce((a, e) => a + e.deletions, 0)
    lines.push(`## ${cat.name}（${items.length} 件 · +${totalIns}/-${totalDel} 行）`)
    lines.push('')
    for (const e of items) {
      const meta = metas[e.key]
      const biz = businessById(meta?.business ?? e.business)
      lines.push(`### ${e.title}`)
      lines.push('')
      lines.push(`- 时间：${e.date} ｜ 代码库：${e.repo} ｜ +${e.insertions}/-${e.deletions}`)
      if (biz) lines.push(`- 所属业务：${biz.name}`)
      if (e.cardNumber) lines.push(`- 卡片：${e.cardNumber}`)
      if (e.reviewNumber) lines.push(`- CR：${e.reviewNumber}`)
      if (meta?.difficulty) lines.push(`- 难度：${'★'.repeat(meta.difficulty)}${'☆'.repeat(5 - meta.difficulty)}`)
      if (meta?.reflection) {
        lines.push('')
        lines.push('  总结反思：')
        lines.push('')
        lines.push(meta.reflection.split('\n').map((l) => `  ${l}`).join('\n'))
      }
      lines.push('')
    }
  }

  const un = events.filter((e) => effectiveCategory(e, metas) === 'unassigned')
  if (un.length) {
    lines.push(`## 待归类（${un.length} 件）`)
    lines.push('')
    for (const e of un) {
      lines.push(`- ${e.title}（${e.date}）`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

/** 下载文本文件 */
export function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** 获取某分类的 accent 色（工具函数复用） */
export function catColor(id: string) {
  return categoryById(id as any).color
}

export { BUSINESSES }
