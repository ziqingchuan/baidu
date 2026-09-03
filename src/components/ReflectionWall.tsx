import { useEffect, useMemo, useState } from 'react'
import type { EventItem, EventMeta } from '../types'
import { CATEGORIES, UNASSIGNED_CATEGORY, softTint } from '../lib/categories'
import { effectiveCategory } from '../lib/boardStats'
import { businessById } from '../lib/business'
import { isPopoReady, loadMetaLikes, toggleMetaLike, type MetaLikeInfo } from '../lib/popoData'
import { awardById } from '../lib/awards'
import AwardBadge from './AwardBadge'
import starSvg from '../assets/star.svg'

interface Props {
  events: EventItem[]
  metas: Record<string, EventMeta>
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/** 格式化日期：MM-DD 周X */
function fmtDate(date: string): string {
  const d = new Date(date)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 周${WEEKDAYS[d.getDay()]}`
}

/** 反思墙：把写过反思的任务按分类分组展示，供汇报/自我沉淀查看 */
export default function ReflectionWall({ events, metas }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  // 点赞信息：event_key -> {recordId, count, liked}（popo 真实数据 / 本地 mock，均持久化）
  const [likes, setLikes] = useState<Record<string, MetaLikeInfo>>({})

  useEffect(() => {
    let cancelled = false
    loadMetaLikes()
      .then((info) => {
        if (!cancelled) setLikes(info)
      })
      .catch((e) => console.warn('[popo] 点赞信息加载失败:', e))
    return () => {
      cancelled = true
    }
  }, [events, metas])

  /** 点赞 / 取消点赞 */
  const handleLike = async (eventKey: string, recordId: string, liked: boolean) => {
    try {
      const next = await toggleMetaLike(recordId, liked)
      setLikes((prev) => (prev ? { ...prev, [eventKey]: { recordId, ...next } } : prev))
    } catch (e) {
      console.warn('[popo] 点赞失败:', e)
    }
  }

  // 按分类分组，仅保留有反思的任务
  const groups = useMemo(() => {
    const map = new Map<string, { cat: (typeof CATEGORIES)[number]; items: EventItem[] }>()
    for (const cat of CATEGORIES) map.set(cat.id, { cat, items: [] })
    map.set(UNASSIGNED_CATEGORY.id, { cat: UNASSIGNED_CATEGORY, items: [] })
    for (const e of events) {
      const meta = metas[e.key]
      if (!meta?.reflection?.trim()) continue
      const cat = effectiveCategory(e, metas)
      const g = map.get(cat) ?? map.get(UNASSIGNED_CATEGORY.id)!
      g.items.push(e)
    }
    // 分类内按时间倒序
    for (const g of map.values()) g.items.sort((a, b) => (a.date < b.date ? 1 : -1))
    return [...map.values()].filter((g) => g.items.length)
  }, [events, metas])

  /** 横向优先的瀑布分列：卡片数 ≤3 时直接一一横排（2张=2列、3张=3列），
   *  更多则固定 3 列，卡片贪心分入当前最短列 → 高度自由错落 + 横向填满 */
  const splitColumns = (items: EventItem[]): EventItem[][] => {
    const n = items.length
    if (n <= 3) {
      // 少卡直接横排，每张一列，不堆叠
      return items.map((e) => [e])
    }
    const colCount = 3
    const cols: EventItem[][] = Array.from({ length: colCount }, () => [])
    // 估算列高：标题+日期+反思长度近似，贪心放最短列
    const estHeight = (e: EventItem) => {
      const m = metas[e.key]
      return e.title.length + (m?.reflection?.length ?? 0)
    }
    const colHeight = new Array(colCount).fill(0)
    for (const e of items) {
      let minIdx = 0
      for (let i = 1; i < colCount; i++) if (colHeight[i] < colHeight[minIdx]) minIdx = i
      cols[minIdx].push(e)
      colHeight[minIdx] += estHeight(e)
    }
    return cols
  }

  const total = groups.reduce((a, g) => a + g.items.length, 0)

  if (!total) {
    return (
      <div className="reflection-wrap">
        <div className="reflection-empty">还没有写过反思——点击卡片打开编辑弹窗，写下你的总结反思吧</div>
      </div>
    )
  }

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="reflection-wrap">
      {groups.map((g) => {
        const isCollapsed = collapsed.has(g.cat.id)
        return (
          <section key={g.cat.id} className="reflection-group">
            <header
              className="reflection-group-head"
              style={{ background: softTint(g.cat.color, 0.1) }}
              onClick={() => toggle(g.cat.id)}
            >
              <span className="reflection-group-name" style={{ color: g.cat.color }}>
                <span className="reflection-group-dot" style={{ background: g.cat.color }} />
                {g.cat.name}
              </span>
              <span className="reflection-group-count">{g.items.length} 条</span>
              <span className={`reflection-collapse${isCollapsed ? ' collapsed' : ''}`}>▾</span>
            </header>

            {!isCollapsed && (
              <div className="reflection-list">
                {splitColumns(g.items).map((col, ci) => (
                  <div key={ci} className="reflection-column">
                    {col.map((e) => {
                      const meta = metas[e.key]
                      const biz = businessById(meta?.business ?? e.business)
                      const award = awardById(meta?.award)
                      return (
                        <article key={e.key} className={`reflection-item${award ? ` award-${award.id}` : ''}`}>
                          <div className="reflection-item-head">
                            <span className="reflection-item-title">{e.title}</span>
                            {biz && (
                              <span className="reflection-item-biz" style={{ color: biz.color, borderColor: biz.color }}>
                                {biz.name}
                              </span>
                            )}
                          </div>
                          <div className="reflection-item-meta">
                            <span className="reflection-item-date">
                              <svg className="reflection-cal-icon" viewBox="0 0 1024 1024" aria-hidden="true">
                                <path
                                  d="M716.8 102.4a51.2 51.2 0 0 1 51.2 51.2v51.2h51.2a102.4 102.4 0 0 1 102.4 102.4v563.2a102.4 102.4 0 0 1-102.4 102.4H204.8a102.4 102.4 0 0 1-102.4-102.4V307.2a102.4 102.4 0 0 1 102.4-102.4h51.2v-51.2a51.2 51.2 0 0 1 102.4 0v51.2h409.6v-51.2a51.2 51.2 0 0 1 51.2-51.2zM256 409.6a51.2 51.2 0 0 0 0 102.4h512a51.2 51.2 0 0 0 0-102.4H256z"
                                  fill="currentColor"
                                />
                              </svg>
                              {fmtDate(e.date)}
                            </span>
                            <span className="reflection-item-code">
                              <span className="ins">+{e.insertions}</span>
                              <span className="del">-{e.deletions}</span>
                            </span>
                            {meta?.difficulty ? (
                              <span className="reflection-item-diff">
                                <img className="diff-star" src={starSvg} alt="" />
                                {meta.difficulty}
                              </span>
                            ) : null}
                          </div>
                          <div className="reflection-item-body">{meta?.reflection}</div>
                          <div className="reflection-item-foot">
                            <div className="reflection-foot-left">
                              {award && (
                                <span className="reflection-item-award">
                                  <AwardBadge award={award.id} size={22} />
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              className={`reflection-like${likes[e.key]?.liked ? ' liked' : ''}`}
                              // popo 环境下点赞信息未加载（无真实 recordId）时禁用，避免把 mock id 写入云端
                              disabled={isPopoReady() && !likes[e.key]?.recordId}
                              onClick={() => handleLike(e.key, likes[e.key]?.recordId ?? `mock-${e.key}`, !!likes[e.key]?.liked)}
                            >
                              <svg className="reflection-heart" viewBox="0 0 1024 1024" aria-hidden="true">
                                <path
                                  d="M512 851.2s-287.6-186.6-371.5-344.5C86.7 397.4 128.6 281.6 221.5 235.3c84-41.9 190.5-21.6 290.5 56.3 100-77.9 206.5-98.2 290.5-56.3 92.9 46.3 134.8 162.1 81 271.4C799.6 664.6 512 851.2 512 851.2z"
                                  fill={likes[e.key]?.liked ? '#e8849a' : 'none'}
                                  stroke={likes[e.key]?.liked ? '#e8849a' : '#b8bcc4'}
                                  strokeWidth="56"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              <span className="reflection-like-count">{likes[e.key]?.count ?? 0}</span>
                            </button>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
