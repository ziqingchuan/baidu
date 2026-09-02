/** 所属业务定义：dodo客户端 / BunnyDo / Comate / AI内化 */
export interface Business {
  id: BusinessId
  name: string
  color: string
}

export type BusinessId = 'dodo' | 'bunnydo' | 'comate' | 'ai-internal' | 'other'

export const BUSINESSES: Business[] = [
  { id: 'dodo', name: 'dodo客户端', color: '#7aa7f0' },
  { id: 'bunnydo', name: 'BunnyDo', color: '#a78bfa' },
  { id: 'comate', name: 'Comate', color: '#6ccfcf' },
  { id: 'ai-internal', name: 'AI内化', color: '#f0b47e' },
  { id: 'other', name: '其他', color: '#9aa2b1' },
]

export function businessById(id: BusinessId | undefined): Business | undefined {
  return BUSINESSES.find((b) => b.id === id)
}

/**
 * 根据 代码库 + 标题 自动推断所属业务（仅作默认建议，弹窗中可手动覆盖）。
 * 规则：先按代码库名，再按标题关键词兜底。
 */
export function autoSuggestBusiness(repo: string, title: string): BusinessId {
  const t = `${repo} ${title}`.toLowerCase()
  if (t.includes('dodo')) return 'dodo'
  if (t.includes('bunnydo') || t.includes('bunny')) return 'bunnydo'
  if (t.includes('comate') || t.includes('coding-suggestion') || t.includes('coding suggestion')) return 'comate'
  // skill 发布 / 资质 / AI 相关 → AI内化
  return 'ai-internal'
}
