import type { EventItem, EventMeta } from '../types'
import { CATEGORIES, type CategoryId } from './categories'

/** 某任务的生效分类：优先用户设置；未设置一律归为 unassigned（默认全部进未分类，由用户手动归类） */
export function effectiveCategory(e: EventItem, metas: Record<string, EventMeta>): CategoryId {
  return metas[e.key]?.category ?? 'unassigned'
}

export interface BoardStats {
  /** 分类分布：每个分类的任务数 + 行数 */
  categoryDist: { category: CategoryId; name: string; color: string; count: number; insertions: number }[]
  /** 月度任务占比：按月 × 分类的任务数（任务导向主图） */
  monthlyByCategory: { month: string; counts: Record<CategoryId, number> }[]
  /** 难度统计：每分类的平均难度/已打分数量 */
  difficultyStats: { category: CategoryId; name: string; color: string; avg: number; scored: number }[]
  /** 已归类 / 待归类 统计 */
  classified: number
  unclassified: number
  /** 全部任务的平均难度（已打分部分，0-5，保留一位小数） */
  avgDifficulty: number
  /** 覆盖的所属业务数（去重，生效值为手动覆盖或自动推断） */
  businessCoverage: number
  /** 代码变更总量（行） */
  totalInsertions: number
  totalDeletions: number
  /** 代码量月度（保留次要展示） */
  codeMonthly: { month: string; insertions: number; deletions: number; count: number }[]
}

export function buildBoardStats(events: EventItem[], metas: Record<string, EventMeta>): BoardStats {
  const allCatIds = CATEGORIES.map((c) => c.id)

  // 分类分布
  const catCount = new Map<CategoryId, { count: number; insertions: number }>()
  allCatIds.forEach((id) => catCount.set(id, { count: 0, insertions: 0 }))
  for (const e of events) {
    const cat = effectiveCategory(e, metas)
    const c = catCount.get(cat) ?? { count: 0, insertions: 0 }
    c.count++
    c.insertions += e.insertions
    catCount.set(cat, c)
  }
  const categoryDist = CATEGORIES.map((c) => ({
    category: c.id,
    name: c.name,
    color: c.color,
    count: catCount.get(c.id)?.count ?? 0,
    insertions: catCount.get(c.id)?.insertions ?? 0,
  }))

  // 月度任务占比（含 unassigned 单独一档）
  const months = [...new Set(events.map((e) => e.date.slice(0, 7)))].sort()
  const monthlyByCategory = months.map((m) => {
    const counts = {} as Record<CategoryId, number>
    allCatIds.forEach((id) => (counts[id] = 0))
    counts.unassigned = 0
    for (const e of events) {
      if (e.date.slice(0, 7) !== m) continue
      counts[effectiveCategory(e, metas)]++
    }
    return { month: m, counts }
  })

  // 难度统计
  const diffAgg = new Map<CategoryId, { sum: number; scored: number }>()
  allCatIds.forEach((id) => diffAgg.set(id, { sum: 0, scored: 0 }))
  for (const [key, meta] of Object.entries(metas)) {
    const ev = events.find((e) => e.key === key)
    if (!ev || !meta.difficulty) continue
    const cat = effectiveCategory(ev, metas)
    const a = diffAgg.get(cat) ?? { sum: 0, scored: 0 }
    a.sum += meta.difficulty
    a.scored++
    diffAgg.set(cat, a)
  }
  const difficultyStats = CATEGORIES.map((c) => {
    const a = diffAgg.get(c.id) ?? { sum: 0, scored: 0 }
    return {
      category: c.id,
      name: c.name,
      color: c.color,
      avg: a.scored ? Math.round((a.sum / a.scored) * 10) / 10 : 0,
      scored: a.scored,
    }
  })

  // 代码量月度
  const codeMap = new Map<string, { insertions: number; deletions: number; count: number }>()
  for (const e of events) {
    const m = e.date.slice(0, 7)
    const c = codeMap.get(m) ?? { insertions: 0, deletions: 0, count: 0 }
    c.insertions += e.insertions
    c.deletions += e.deletions
    c.count++
    codeMap.set(m, c)
  }
  const codeMonthly = [...codeMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([month, v]) => ({ month, ...v }))

  const classified = events.filter((e) => effectiveCategory(e, metas) !== 'unassigned').length
  const unclassified = events.length - classified

  // 平均难度：全部已打分任务的平均
  const scoredEntries = Object.entries(metas).filter(([, m]) => m.difficulty > 0)
  const avgDifficulty = scoredEntries.length
    ? Math.round((scoredEntries.reduce((a, [, m]) => a + m.difficulty, 0) / scoredEntries.length) * 10) / 10
    : 0

  // 覆盖业务数：生效业务（手动覆盖优先，否则事件自动推断值）去重；「其他」不计入
  const bizSet = new Set<string>()
  for (const e of events) {
    const biz = metas[e.key]?.business ?? e.business
    if (biz && biz !== 'other') bizSet.add(biz)
  }

  // 代码变更总量
  const totalInsertions = events.reduce((a, e) => a + e.insertions, 0)
  const totalDeletions = events.reduce((a, e) => a + e.deletions, 0)

  return {
    categoryDist,
    monthlyByCategory,
    difficultyStats,
    classified,
    unclassified,
    avgDifficulty,
    businessCoverage: bizSet.size,
    totalInsertions,
    totalDeletions,
    codeMonthly,
  }
}
