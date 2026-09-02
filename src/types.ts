/** 产出看板数据类型定义（与 scripts/export-data.ts 输出对齐） */
import type { CategoryId } from './lib/categories'
import type { BusinessId } from './lib/business'

/** iCode CR（代码评审） */
export interface Review {
  number: number
  project: string
  branch: string
  subject: string
  status: 'OPEN' | 'MERGED' | 'ABANDONED' | string
  insertions: number
  deletions: number
  updated: string
  revision: string
}

/** iCode 提交 */
export interface Commit {
  commitId: string
  author: string
  commitTime: string
  addLines: number
  deleteLines: number
  subject: string
}

/** iCafe 卡片 */
export interface Card {
  space: string
  sequence: number
  title: string
  status: string
  type: string
  assignee: string
  isFinished: boolean
  lastModified: string
  parent?: string
}

/** 数据快照 */
export interface DashboardData {
  fetchedAt: string
  reviews: Review[]
  commits: Commit[]
  cards: Card[]
}

/** 任务：卡片 / CR / 提交 归并后的"一件事" */
export interface EventItem {
  /** 稳定唯一键，用于挂载反思 */
  key: string
  /** 归并出的主题（优先卡片标题，其次 CR subject，最后 commit subject） */
  title: string
  /** 来源类型 */
  source: 'card' | 'review' | 'commit'
  /** 卡片类型（Story/Bug/Task...），无卡片则为 CR/commit */
  type: string
  /** 状态：CR 用 MERGED/OPEN/ABANDONED，卡片用卡片状态 */
  status: string
  /** 归属代码库 */
  repo: string
  /** 时间（YYYY-MM-DD HH:mm） */
  date: string
  /** 新增行数 */
  insertions: number
  /** 删除行数 */
  deletions: number
  /** 卡片号，如 bunnydo-33 */
  cardNumber?: string
  /** 关联的 CR 编号 */
  reviewNumber?: number
  /** 关联的提交数 */
  commitCount?: number
  /** 所属业务（自动推断的默认值，可在弹窗中手动覆盖） */
  business: BusinessId
  /** 原始数据引用 */
  raw: Card | Review | Commit
}

/** 看板任务元数据：分类 + 难度 + 反思 + 所属业务（localStorage 持久化） */
export interface EventMeta {
  /** 所属分类 id */
  category: CategoryId
  /** 任务难度 1-5，0 表示未打分 */
  difficulty: number
  /** 总结反思正文 */
  reflection: string
  /** 所属业务（用户手动覆盖值；为空则用任务的自动推断值） */
  business?: BusinessId
  /** 更新时间 */
  updatedAt: string
}
