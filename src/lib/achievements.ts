/**
 * 成就勋章逻辑：解锁状态计算 + 勋章图预加载。
 * 成就「数据」（名称 / 描述 / 达成条件 / 展示顺序）已移到 src/data/achievements.ts，改数据去那边改。
 */
import type { EventItem, EventMeta } from '../types'
import { ACHIEVEMENTS, ACHIEVEMENT_GROUPS, MEDAL_ICONS } from '../data/achievements'
import type { AchievementGroupDef } from '../data/achievements'

export interface AchievementDef {
  id: string
  /** 成就名（趣味可爱风格） */
  name: string
  /** hover 显示的完成原因 / 描述 */
  desc: string
  /** 勋章图 */
  icon: string
  /** 是否达成 */
  check: (events: EventItem[], metas: Record<string, EventMeta>) => boolean
  /** 达成进度 0~1（未达成时显示差距感，暂保留简单计数文本） */
  progress?: (events: EventItem[], metas: Record<string, EventMeta>) => { current: number; target: number }
}

/** 全部成就的解锁状态（含进度信息），供勋章墙全量展示 */
export function achievementStatuses(events: EventItem[], metas: Record<string, EventMeta>) {
  return ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked: a.check(events, metas),
    progress: a.progress ? a.progress(events, metas) : undefined,
  }))
}

/** 按评价维度分组的解锁状态，供勋章墙分组展示（空组过滤掉） */
export function achievementStatusesByGroup(events: EventItem[], metas: Record<string, EventMeta>) {
  const statuses = achievementStatuses(events, metas)
  return ACHIEVEMENT_GROUPS.map((g: AchievementGroupDef) => ({
    ...g,
    items: g.ids
      .map((id) => statuses.find((s) => s.id === id))
      .filter((s): s is Exclude<typeof s, undefined> => Boolean(s)),
  })).filter((g) => g.items.length)
}

// ---------- 勋章图预加载（进入浏览器缓存，避免切换/刷新时重复请求） ----------
const preloaded = new Set<string>()

/**
 * 预加载所有勋章图：用 Image() 提前请求，使图片进入浏览器 HTTP/内存缓存。
 * 模块级去重——同会话只预加载一次；缓存命中后刷新不再发起网络请求。
 */
export function preloadMedalImages(): void {
  for (const url of Object.values(MEDAL_ICONS)) {
    if (!url || preloaded.has(url)) continue
    preloaded.add(url)
    const img = new Image()
    img.src = url
    // 设置 fetch 优先级为低，不抢占首屏关键资源
    img.fetchPriority = 'low'
  }
}
