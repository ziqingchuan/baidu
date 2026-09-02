import type { Card, Commit, DashboardData, EventItem, Review } from '../types'
import { autoSuggestBusiness } from './business'

/** 提取 subject 开头的卡片号 token，如 "bunnydo-33 [Story] ..." -> "bunnydo-33" */
function extractCardNumber(subject: string): string | null {
  const token = subject.trim().split(/\s+/)[0]
  if (!token) return null
  if (!/^[A-Za-z][\w-]*-\d+$/.test(token)) return null
  return token
}

/** 从卡片列表构建 小写卡片号 -> 卡片 索引 */
function indexCards(cards: Card[]): Map<string, Card> {
  const m = new Map<string, Card>()
  for (const c of cards) {
    m.set(`${c.space.toLowerCase()}-${c.sequence}`, c)
  }
  return m
}

/**
 * 任务归并：以 CR 为骨架，卡片提供标题/类型/状态增强，commit 聚合到对应卡片。
 * 孤儿 commit（无卡片无 CR）单独成任务。
 */
export function buildEvents(data: DashboardData): EventItem[] {
  const cardIndex = indexCards(data.cards)
  const events: EventItem[] = []
  const orphanCommits: Commit[] = []

  // 第一遍：CR 骨架
  for (const r of data.reviews) {
    const cardNumber = extractCardNumber(r.subject)
    const card = cardNumber ? cardIndex.get(cardNumber.toLowerCase()) : undefined
    const key = card ? `card:${card.space}-${card.sequence}` : `review:${r.number}`
    events.push({
      key,
      title: card?.title || r.subject,
      source: card ? 'card' : 'review',
      type: card?.type || 'CR',
      status: card ? card.status : r.status,
      repo: r.project,
      date: r.updated,
      insertions: r.insertions,
      deletions: r.deletions,
      cardNumber: cardNumber ?? undefined,
      reviewNumber: r.number,
      commitCount: 0,
      business: autoSuggestBusiness(r.project, r.subject),
      raw: card ?? r,
    })
  }

  // 第二遍：commit 归并到卡片/CR 任务，或进入孤儿列表
  for (const c of data.commits) {
    const cardNumber = extractCardNumber(c.subject)
    const card = cardNumber ? cardIndex.get(cardNumber.toLowerCase()) : undefined
    if (card) {
      const key = `card:${card.space}-${card.sequence}`
      const ev = events.find((e) => e.key === key)
      if (ev) ev.commitCount = (ev.commitCount ?? 0) + 1
      continue
    }
    // 尝试匹配 CR（CR subject 前缀与 commit 相同卡片号但无卡片记录时）
    const cr = cardNumber
      ? data.reviews.find((r) => r.subject.trim().startsWith(cardNumber))
      : undefined
    if (cr) {
      const key = `review:${cr.number}`
      const ev = events.find((e) => e.key === key)
      if (ev) ev.commitCount = (ev.commitCount ?? 0) + 1
      continue
    }
    orphanCommits.push(c)
  }

  // 第三遍：孤儿 commit 单独成任务（按提交）
  for (const c of orphanCommits) {
    events.push({
      key: `commit:${c.commitId}`,
      title: c.subject,
      source: 'commit',
      type: 'commit',
      status: 'COMMITTED',
      repo: '未知代码库',
      date: c.commitTime,
      insertions: c.addLines,
      deletions: c.deleteLines,
      commitCount: 1,
      business: autoSuggestBusiness('', c.subject),
      raw: c,
    })
  }

  events.sort((a, b) => (a.date < b.date ? 1 : -1))
  return events
}

/** 获取任务所属月份 YYYY-MM */
export function eventMonth(date: string): string {
  return date.slice(0, 7)
}

/** 按代码库聚合 CR（条数、增删行、合入数） */
export function aggregateByRepo(reviews: Review[]) {
  const map = new Map<string, { repo: string; count: number; insertions: number; deletions: number; merged: number }>()
  for (const r of reviews) {
    const cur = map.get(r.project) ?? { repo: r.project, count: 0, insertions: 0, deletions: 0, merged: 0 }
    cur.count++
    cur.insertions += r.insertions
    cur.deletions += r.deletions
    if (r.status === 'MERGED') cur.merged++
    map.set(r.project, cur)
  }
  return [...map.values()].sort((a, b) => b.insertions - a.insertions)
}

/** 按月份聚合提交（条数、增删行），用于月度活跃度图 */
export function aggregateByMonth(commits: Commit[]) {
  const map = new Map<string, { month: string; count: number; insertions: number; deletions: number }>()
  for (const c of commits) {
    const m = c.commitTime.slice(0, 7)
    const cur = map.get(m) ?? { month: m, count: 0, insertions: 0, deletions: 0 }
    cur.count++
    cur.insertions += c.addLines
    cur.deletions += c.deleteLines
    map.set(m, cur)
  }
  return [...map.values()].sort((a, b) => (a.month < b.month ? -1 : 1))
}

/** 近 N 天提交日历（天 -> 新增行数），用于热力图 */
export function aggregateLastNDays(commits: Commit[], days: number) {
  const result: { date: string; label: string; insertions: number; count: number }[] = []
  const today = new Date()
  const byDay = new Map<string, { insertions: number; count: number }>()
  for (const c of commits) {
    const day = c.commitTime.slice(0, 10)
    const cur = byDay.get(day) ?? { insertions: 0, count: 0 }
    cur.insertions += c.addLines
    cur.count++
    byDay.set(day, cur)
  }
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const v = byDay.get(key) ?? { insertions: 0, count: 0 }
    result.push({ date: key, label: `${d.getMonth() + 1}/${d.getDate()}`, insertions: v.insertions, count: v.count })
  }
  return result
}

/** CR 健康度统计 */
export function reviewHealth(reviews: Review[]) {
  const merged = reviews.filter((r) => r.status === 'MERGED')
  const open = reviews.filter((r) => r.status === 'OPEN')
  const abandoned = reviews.filter((r) => r.status === 'ABANDONED')
  const totalLines = reviews.reduce((a, r) => a + r.insertions + r.deletions, 0)
  const avgLines = reviews.length ? Math.round(totalLines / reviews.length) : 0
  const avgSize = merged.length ? Math.round(merged.reduce((a, r) => a + r.insertions, 0) / merged.length) : 0
  return {
    total: reviews.length,
    merged: merged.length,
    open: open.length,
    abandoned: abandoned.length,
    mergeRate: reviews.length ? Math.round((merged.length / reviews.length) * 100) : 0,
    totalInsertions: reviews.reduce((a, r) => a + r.insertions, 0),
    totalDeletions: reviews.reduce((a, r) => a + r.deletions, 0),
    avgLinesPerCr: avgLines,
    avgInsertionsPerMerged: avgSize,
  }
}

/** 任务月份列表（倒序） */
export function listMonths(events: EventItem[]): string[] {
  const s = new Set(events.map((e) => eventMonth(e.date)))
  return [...s].sort().reverse()
}

/** 从 subject 中解析 iCafe 卡片号，如 "bunnydo-33" / "DevOps-iScan-41404" */
export function getCardNumber(subject: string): string | null {
  return extractCardNumber(subject)
}
