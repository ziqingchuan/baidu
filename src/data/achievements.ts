/**
 * 成就勋章数据（可编辑）：想改成就的「名称 / 描述 / 达成条件 / 展示顺序」，直接改这个文件。
 * 勋章图：src/assets/achievements/{id}.webp（文件名即成就 id）。新增成就时把 png 放进目录后执行 pnpm to-webp 生成 webp。
 */
import type { AchievementDef } from '../lib/achievements'
import { dateQuarter } from '../lib/dateQuarter'
import type { EventItem, EventMeta } from '../types'
import type { CategoryId } from '../lib/categories'

/** 勋章图：按 id 自动加载 src/assets/achievements/ 下所有 webp（文件名即成就 id，如 workday-5.webp → id workday-5） */
const medalModules = import.meta.glob('../assets/achievements/*.webp', { eager: true, import: 'default' }) as Record<string, string>

export const MEDAL_ICONS: Record<string, string> = Object.fromEntries(
  Object.entries(medalModules).map(([path, url]) => {
    const id = path.split('/').pop()!.replace(/\.webp$/, '')
    return [id, url]
  }),
)

function medalIcon(id: string): string {
  return MEDAL_ICONS[id] ?? ''
}

// ---------- 达成条件用到的统计工具 ----------

/** 是否为工作日（周一~周五） */
function isWorkday(dateStr: string): boolean {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return false
  const day = d.getDay()
  return day >= 1 && day <= 5
}

/** 每个任务有一个产出日期（去重后按天计数，只算工作日） */
function workdayDates(events: EventItem[]): string[] {
  const s = new Set<string>()
  for (const e of events) {
    const day = e.date.slice(0, 10)
    if (isWorkday(day)) s.add(day)
  }
  return [...s].sort()
}

/** 连续 N 个工作日（跨周末：工作日序列中相邻两天间隔 ≤3 视为连续） */
function maxConsecutiveWorkdays(events: EventItem[]): number {
  const days = workdayDates(events)
  if (!days.length) return 0
  let best = 1
  let cur = 1
  for (let i = 1; i < days.length; i++) {
    const gap = (new Date(days[i]).getTime() - new Date(days[i - 1]).getTime()) / 86400000
    // 周一~周五的相邻工作日最多隔 3 天（周五→下周一）
    if (gap <= 3) cur++
    else cur = 1
    best = Math.max(best, cur)
  }
  return best
}

/** 当前自然月内工作日去重数 */
function currentMonthWorkdays(events: EventItem[]): number {
  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const s = new Set<string>()
  for (const e of events) {
    const day = e.date.slice(0, 10)
    if (day.startsWith(ym) && isWorkday(day)) s.add(day)
  }
  return s.size
}

/** 当前自然月的工作日总数 */
function workdaysInCurrentMonth(): number {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const last = new Date(y, m + 1, 0).getDate()
  let n = 0
  for (let d = 1; d <= last; d++) {
    const day = new Date(y, m, d).getDay()
    if (day >= 1 && day <= 5) n++
  }
  return n
}

/** 任务分类（标注优先，缺省 unassigned） */
function categoryOf(e: EventItem, metas: Record<string, EventMeta>): CategoryId {
  return (metas[e.key]?.category ?? 'unassigned') as CategoryId
}

/** 覆盖的季度数（YYYY-Qn） */
function quarterCount(events: EventItem[]): number {
  const s = new Set<string>()
  for (const e of events) {
    const q = dateQuarter(e.date)
    if (q) s.add(q)
  }
  return s.size
}

/** 单日完成的最多任务数 */
function maxTasksPerDay(events: EventItem[]): number {
  const m = new Map<string, number>()
  for (const e of events) {
    const day = e.date.slice(0, 10)
    m.set(day, (m.get(day) ?? 0) + 1)
  }
  return Math.max(0, ...m.values())
}

/** 同一业务线完成的最多任务数 */
function maxTasksPerBusiness(events: EventItem[], metas: Record<string, EventMeta>): number {
  const m = new Map<string, number>()
  for (const e of events) {
    const biz = metas[e.key]?.business ?? e.business
    m.set(biz, (m.get(biz) ?? 0) + 1)
  }
  return Math.max(0, ...m.values())
}

// ---------- 成就分组（评价维度）：勋章墙按此分组展示 ----------

export interface AchievementGroupDef {
  id: string
  /** 分组小标题 */
  name: string
  /** 一句话说明这个维度在评价什么 */
  desc: string
  /** 该维度包含的成就 id（按展示顺序） */
  ids: string[]
}

export const ACHIEVEMENT_GROUPS: AchievementGroupDef[] = [
  { id: 'onboarding', name: '起步', desc: '迈出第一步', ids: ['first-task'] },
  { id: 'engineering', name: '工程攻坚', desc: '能扛高难度 / 复杂工程，会重构与工程化建设', ids: ['hard-1', 'hard-5', 'delete-5000', 'engineering-5'] },
  { id: 'quality', name: '质量保障', desc: '交付可靠，善于定位与修复问题', ids: ['bugfix-5', 'hard-bug-5'] },
  { id: 'outcome', name: '关键成果', desc: '做出被认可的核心产出', ids: ['copper-1', 'first-gold', 'silver-3', 'gold-3', 'awards-10', 'grand-slam'] },
  { id: 'breadth', name: '广度深耕', desc: '技术视野广、业务理解深', ids: ['category-5', 'business-3', 'business-10'] },
  { id: 'consistency', name: '持续高效', desc: '产出稳定持续、规模可观', ids: ['workday-5', 'month-full', 'quarters-4', 'day-5', 'tasks-50', 'tasks-100', 'lines-10000'] },
  { id: 'reflection', name: '复盘沉淀', desc: '善于总结反思、自我迭代', ids: ['reflection-10', 'reflection-deep'] },
]

// ---------- 成就定义（顺序即勋章墙展示顺序） ----------

export const ACHIEVEMENTS: AchievementDef[] = [
  // ---------- 起步 ----------
  {
    id: 'first-task',
    name: '初露锋芒',
    desc: '完成了第 1 个任务，一切从这一步开始。',
    icon: medalIcon('first-task'),
    check: (e) => e.length >= 1,
    progress: (e) => ({ current: Math.min(e.length, 1), target: 1 }),
  },

  // ---------- 工程攻坚：能扛高难度 / 复杂工程，会重构与工程化建设 ----------
  {
    id: 'hard-1',
    name: '初攀高峰',
    desc: '完成了第 1 个难度 4+ 的任务。',
    icon: medalIcon('hard-1'),
    check: (_e, m) => Object.values(m).some((x) => x.difficulty >= 4),
    progress: (_e, m) => ({ current: Math.min(Object.values(m).filter((x) => x.difficulty >= 4).length, 1), target: 1 }),
  },
  {
    id: 'hard-5',
    name: '攻坚克难',
    desc: '累计完成 5 个难度 4+ 的任务。',
    icon: medalIcon('hard-5'),
    check: (_e, m) => Object.values(m).filter((x) => x.difficulty >= 4).length >= 5,
    progress: (_e, m) => ({ current: Math.min(Object.values(m).filter((x) => x.difficulty >= 4).length, 5), target: 5 }),
  },
  {
    id: 'delete-5000',
    name: '重构高手',
    desc: '累计删除 5000 行代码（清理/重构）。',
    icon: medalIcon('delete-5000'),
    check: (e) => e.reduce((a, x) => a + x.deletions, 0) >= 5000,
    progress: (e) => ({ current: Math.min(e.reduce((a, x) => a + x.deletions, 0), 5000), target: 5000 }),
  },
  {
    id: 'engineering-5',
    name: '工程卫士',
    desc: '完成 5 个工程建设类任务。',
    icon: medalIcon('engineering-5'),
    check: (e, m) => e.filter((x) => categoryOf(x, m) === 'engineering').length >= 5,
    progress: (e, m) => ({ current: Math.min(e.filter((x) => categoryOf(x, m) === 'engineering').length, 5), target: 5 }),
  },

  // ---------- 质量保障：交付可靠，善于定位与修复问题 ----------
  {
    id: 'bugfix-5',
    name: '捕虫达人',
    desc: '修复了 5 个 Bug。',
    icon: medalIcon('bugfix-5'),
    check: (e, m) => e.filter((x) => categoryOf(x, m) === 'bugfix').length >= 5,
    progress: (e, m) => ({ current: Math.min(e.filter((x) => categoryOf(x, m) === 'bugfix').length, 5), target: 5 }),
  },
  {
    id: 'hard-bug-5',
    name: '捕虫专家',
    desc: '完成 5 个难度 3+ 的 Bug 修复。',
    icon: medalIcon('hard-bug-5'),
    check: (e, m) => e.filter((x) => categoryOf(x, m) === 'bugfix' && (m[x.key]?.difficulty ?? 0) >= 3).length >= 5,
    progress: (e, m) => ({
      current: Math.min(e.filter((x) => categoryOf(x, m) === 'bugfix' && (m[x.key]?.difficulty ?? 0) >= 3).length, 5),
      target: 5,
    }),
  },

  // ---------- 关键成果：做出被认可的核心产出（奖牌） ----------
  {
    id: 'copper-1',
    name: '铜牌新星',
    desc: '获得第 1 个铜牌关键成果。',
    icon: medalIcon('copper-1'),
    check: (_e, m) => Object.values(m).some((x) => x.award === 'copper'),
  },
  {
    id: 'silver-3',
    name: '银牌进阶',
    desc: '累计获得 3 个银牌关键成果。',
    icon: medalIcon('silver-3'),
    check: (_e, m) => Object.values(m).filter((x) => x.award === 'silver').length >= 3,
    progress: (_e, m) => ({ current: Math.min(Object.values(m).filter((x) => x.award === 'silver').length, 3), target: 3 }),
  },
  {
    id: 'first-gold',
    name: '金牌突破',
    desc: '获得了第 1 个金牌关键成果。',
    icon: medalIcon('first-gold'),
    check: (_e, m) => Object.values(m).some((x) => x.award === 'gold'),
    progress: (_e, m) => ({ current: Math.min(Object.values(m).filter((x) => x.award === 'gold').length, 1), target: 1 }),
  },
  {
    id: 'gold-3',
    name: '金牌大师',
    desc: '累计获得 3 个金牌关键成果。',
    icon: medalIcon('gold-3'),
    check: (_e, m) => Object.values(m).filter((x) => x.award === 'gold').length >= 3,
    progress: (_e, m) => ({ current: Math.min(Object.values(m).filter((x) => x.award === 'gold').length, 3), target: 3 }),
  },
  {
    id: 'awards-10',
    name: '奖章背包',
    desc: '累计获得 10 枚关键成果奖牌。',
    icon: medalIcon('awards-10'),
    check: (_e, m) => Object.values(m).filter((x) => x.award).length >= 10,
    progress: (_e, m) => ({ current: Math.min(Object.values(m).filter((x) => x.award).length, 10), target: 10 }),
  },
  {
    id: 'grand-slam',
    name: '三色满贯',
    desc: '金银铜牌各至少获得 1 枚。',
    icon: medalIcon('grand-slam'),
    check: (_e, m) => {
      const v = Object.values(m)
      return v.some((x) => x.award === 'gold') && v.some((x) => x.award === 'silver') && v.some((x) => x.award === 'copper')
    },
    progress: (_e, m) => {
      const v = Object.values(m)
      const kinds = [v.some((x) => x.award === 'gold'), v.some((x) => x.award === 'silver'), v.some((x) => x.award === 'copper')].filter(Boolean).length
      return { current: kinds, target: 3 }
    },
  },

  // ---------- 广度深耕：技术视野广、业务理解深 ----------
  {
    id: 'category-5',
    name: '全面探索',
    desc: '任务覆盖 5 个不同类别。',
    icon: medalIcon('category-5'),
    check: (e, m) => new Set(e.map((x) => categoryOf(x, m))).size >= 5,
    progress: (e, m) => ({ current: Math.min(new Set(e.map((x) => categoryOf(x, m))).size, 5), target: 5 }),
  },
  {
    id: 'business-3',
    name: '业务能手',
    desc: '累计参与 3 个不同业务线。',
    icon: medalIcon('business-3'),
    check: (e, m) => new Set(e.map((x) => m[x.key]?.business ?? x.business)).size >= 3,
    progress: (e, m) => ({
      current: Math.min(new Set(e.map((x) => m[x.key]?.business ?? x.business)).size, 3),
      target: 3,
    }),
  },
  {
    id: 'business-10',
    name: '深耕一隅',
    desc: '同一业务线完成 10 个任务。',
    icon: medalIcon('business-10'),
    check: (e, m) => maxTasksPerBusiness(e, m) >= 10,
    progress: (e, m) => ({ current: Math.min(maxTasksPerBusiness(e, m), 10), target: 10 }),
  },

  // ---------- 持续高效：产出稳定持续、规模可观 ----------
  {
    id: 'workday-5',
    name: '持续输出',
    desc: '连续 5 个工作日都有产出。',
    icon: medalIcon('workday-5'),
    check: (e) => maxConsecutiveWorkdays(e) >= 5,
    progress: (e) => ({ current: Math.min(maxConsecutiveWorkdays(e), 5), target: 5 }),
  },
  {
    id: 'month-full',
    name: '火力全开',
    desc: '本月所有工作日都有产出。',
    icon: medalIcon('month-full'),
    check: (e) => currentMonthWorkdays(e) >= workdaysInCurrentMonth(),
    progress: (e) => ({ current: Math.min(currentMonthWorkdays(e), workdaysInCurrentMonth()), target: workdaysInCurrentMonth() }),
  },
  {
    id: 'quarters-4',
    name: '长期主义',
    desc: '连续 4 个季度持续产出。',
    icon: medalIcon('quarters-4'),
    check: (e) => quarterCount(e) >= 4,
    progress: (e) => ({ current: Math.min(quarterCount(e), 4), target: 4 }),
  },
  {
    id: 'day-5',
    name: '高效一日',
    desc: '单日完成 5 个任务。',
    icon: medalIcon('day-5'),
    check: (e) => maxTasksPerDay(e) >= 5,
    progress: (e) => ({ current: Math.min(maxTasksPerDay(e), 5), target: 5 }),
  },
  {
    id: 'tasks-50',
    name: '渐入佳境',
    desc: '累计完成 50 个任务。',
    icon: medalIcon('tasks-50'),
    check: (e) => e.length >= 50,
    progress: (e) => ({ current: Math.min(e.length, 50), target: 50 }),
  },
  {
    id: 'tasks-100',
    name: '百炼成钢',
    desc: '累计完成 100 个任务。',
    icon: medalIcon('tasks-100'),
    check: (e) => e.length >= 100,
    progress: (e) => ({ current: Math.min(e.length, 100), target: 100 }),
  },
  {
    id: 'lines-10000',
    name: '万码初筑',
    desc: '累计新增 10000 行代码。',
    icon: medalIcon('lines-10000'),
    check: (e) => e.reduce((a, x) => a + x.insertions, 0) >= 10000,
    progress: (e) => ({ current: Math.min(e.reduce((a, x) => a + x.insertions, 0), 10000), target: 10000 }),
  },

  // ---------- 复盘沉淀：善于总结反思、自我迭代 ----------
  {
    id: 'reflection-10',
    name: '省思行者',
    desc: '写了 10 次总结反思。',
    icon: medalIcon('reflection-10'),
    check: (_e, m) => Object.values(m).filter((x) => x.reflection?.trim()).length >= 10,
    progress: (_e, m) => ({ current: Math.min(Object.values(m).filter((x) => x.reflection?.trim()).length, 10), target: 10 }),
  },
  {
    id: 'reflection-deep',
    name: '深度反思',
    desc: '写过一篇超过 200 字的总结反思。',
    icon: medalIcon('reflection-deep'),
    check: (_e, m) => Object.values(m).some((x) => (x.reflection?.trim()?.length ?? 0) > 200),
    progress: (_e, m) => ({
      current: Math.min(Math.max(...Object.values(m).map((x) => x.reflection?.trim()?.length ?? 0), 0), 200),
      target: 200,
    }),
  },
]
