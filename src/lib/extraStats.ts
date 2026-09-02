/**
 * 附加统计：从 events + metas 派生图表所需数据（不新增持久化）。
 * 供数据图表页的趣味图使用：日历热力图 / 24h 节律 / 周节奏 / 关键词气泡。
 */
import type { EventItem, EventMeta } from '../types'
import { effectiveCategory } from './boardStats'
import { CATEGORIES, UNASSIGNED_CATEGORY } from './categories'
import { businessById, type BusinessId } from './business'

export interface ExtraStats {
  /** 数据覆盖的年份（取最早任务年份） */
  year: string
  /** 最长连续产出天数 */
  longestStreak: number
  /** 全年每日任务数（日历热力图） */
  daily: { date: string; count: number }[]
  /** 24 小时任务数（工作节律时钟） */
  hourly: number[]
  /** 周一~周日任务数（周节奏雷达） */
  weekdayCounts: number[]
  /** 关键词及其频率（气泡图） */
  keywords: { name: string; value: number }[]
  /** 深夜（22-4点）任务数 */
  nightCount: number
  /** 业务 × 分类 计数矩阵（热力图） */
  bizCategory: { biz: string; category: string; count: number }[]
  /** 业务 → 代码库 计数（矩形树图） */
  bizRepo: { biz: string; repo: string; count: number }[]
  /** 纯代码库聚合（按代码库分块，矩形大小 = 该库任务数） */
  repoCount: { repo: string; count: number }[]
}

const STOP_WORDS = new Set([
  '实现', '优化', '支持', '新增', '修复', '问题', '功能', '模块', '开发', '重构',
  '方案', '能力', '处理', '完成', '相关', '进行', '用于', '提供', '页面', '系统',
  '前端', '后端', '数据', 'the', 'and', 'for', 'with', 'from',
  // 卡片类型 / 提交类型词，不是真正的关键词
  'story', 'task', 'bug', 'fix', 'feat', 'chore', 'refactor', 'release', 'docs', 'perf', 'test',
  // git 操作 / 流程词
  'merge', 'commit', 'push', 'pull', 'branch', 'rebase', 'cherry', 'squash', 'revert', 'review', 'checkout', 'stash',
  // 平台 / 空间前缀词（不是语义关键词）
  'dododododoit', 'devops', 'iscan', 'onetool', 'skill', 'icode', 'icafe', 'frontend', 'release', 'query',
])

function dateKey(date: string): string {
  return date.slice(0, 10)
}

function hourOf(date: string): number {
  return Number(date.slice(11, 13)) || 0
}

/** 代码库路径 → 有语义的短名：关键词优先匹配，未命中才取路径最后一段 */
function repoShortName(repoPath: string): string {
  const low = repoPath.toLowerCase()
  if (low.includes('personal-code')) return 'personal-code'
  if (low.includes('bunnydo')) return 'BunnyDo'
  if (low.includes('coding-suggestion')) return 'coding-suggestion'
  if (low.includes('dodo')) return 'dodo'
  return repoPath.split('/').pop() ?? repoPath
}

/** 从一串文本提取关键词（2-4 字中文词或 3+ 英文字母词，过滤停用词） */
function collectWords(events: EventItem[], metas: Record<string, EventMeta>): { name: string; value: number }[] {
  const freq = new Map<string, number>()
  const add = (t: string) => {
    for (const m of t.match(/[\u4e00-\u9fa5]{2,4}|[a-zA-Z]{3,}/g) ?? []) {
      const w = m.toLowerCase()
      if (STOP_WORDS.has(w)) continue
      freq.set(w, (freq.get(w) ?? 0) + 1)
    }
  }
  for (const e of events) add(e.title)
  for (const m of Object.values(metas)) if (m.reflection) add(m.reflection)
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 9).map(([name, value]) => ({ name, value }))
}

/** 计算附加统计（图表数据） */
export function buildExtraStats(events: EventItem[], metas: Record<string, EventMeta>): ExtraStats {
  const dates = events.map((e) => dateKey(e.date))
  const year = events.length ? dates.reduce((a, b) => (a < b ? a : b)).slice(0, 4) : ''

  // 连续产出：按有产出的日期排序，找最长连续天数
  const days = [...new Set(dates)].sort()
  let longestStreak = 0
  let streak = 0
  for (let i = 0; i < days.length; i++) {
    if (i > 0) {
      const diff = (new Date(days[i]).getTime() - new Date(days[i - 1]).getTime()) / 86400000
      if (diff === 1) streak++
      else streak = 0
    }
    longestStreak = Math.max(longestStreak, streak + 1)
  }

  // 每日任务数（日历热力图）
  const dayFreq = new Map<string, number>()
  for (const d of dates) dayFreq.set(d, (dayFreq.get(d) ?? 0) + 1)
  const daily = [...dayFreq.entries()].map(([date, count]) => ({ date, count }))

  // 24 小时分布（工作节律时钟）
  const hourly = new Array(24).fill(0)
  let nightCount = 0
  for (const e of events) {
    const h = hourOf(e.date)
    hourly[h]++
    if (h >= 22 || h < 4) nightCount++
  }

  // 周节奏（周一~周日）
  const weekdayCounts = new Array(7).fill(0)
  for (const e of events) {
    const wd = new Date(e.date).getDay()
    weekdayCounts[wd]++
  }

  // 业务 × 分类 计数（热力图，含「待归类」列，避免全未归类时图为空）
  const bcKey = (b: string, c: string) => `${b}||${c}`
  const bcMap = new Map<string, number>()
  // 业务 × 代码库 计数（矩形树图，排除未知代码库）
  const brMap = new Map<string, number>()
  // 纯代码库聚合（矩形大小 = 该库任务数）
  const repoMap = new Map<string, number>()
  const catNameOf = (cat: string) =>
    cat === UNASSIGNED_CATEGORY.id ? UNASSIGNED_CATEGORY.name : (CATEGORIES.find((c) => c.id === cat)?.name ?? cat)
  for (const e of events) {
    const bizId = metas[e.key]?.business ?? e.business
    const bizName = businessById(bizId as BusinessId)?.name ?? bizId
    const catName = catNameOf(effectiveCategory(e, metas))
    bcMap.set(bcKey(bizName, catName), (bcMap.get(bcKey(bizName, catName)) ?? 0) + 1)
    const repo = repoShortName(e.repo)
    if (e.repo === '未知代码库' || !e.repo || repo === 'ziqingchuan') continue
    brMap.set(`${bizName}||${repo}`, (brMap.get(`${bizName}||${repo}`) ?? 0) + 1)
    repoMap.set(repo, (repoMap.get(repo) ?? 0) + 1)
  }
  const bizCategory = [...bcMap.entries()].map(([k, count]) => {
    const [biz, category] = k.split('||')
    return { biz, category, count }
  })
  const bizRepo = [...brMap.entries()].map(([k, count]) => {
    const [biz, repo] = k.split('||')
    return { biz, repo, count }
  })
  const repoCount = [...repoMap.entries()]
    .map(([repo, count]) => ({ repo, count }))
    .sort((a, b) => b.count - a.count)

  return {
    year,
    longestStreak,
    daily,
    hourly,
    weekdayCounts,
    keywords: collectWords(events, metas),
    nightCount,
    bizCategory,
    bizRepo,
    repoCount,
  }
}
