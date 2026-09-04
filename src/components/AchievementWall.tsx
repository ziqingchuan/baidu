import { useEffect, useMemo, useState } from 'react'
import { Card, Tooltip } from 'antd'
import type { EventItem, EventMeta } from '../types'
import { achievementStatusesByGroup, preloadMedalImages } from '../lib/achievements'
import { AchievementSkeleton } from './Skeletons'

interface Props {
  events: EventItem[]
  metas: Record<string, EventMeta>
}

/** 勋章图：加载完成前显示占位底色，加载后淡入，避免刷新时图片闪烁 */
function MedalImg({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={`ach-medal-img${loaded ? ' loaded' : ''}`}
      onLoad={() => setLoaded(true)}
    />
  )
}

/** 单个勋章展示（含 hover 完成原因提示；未解锁置灰） */
function AchievementBadge({ a }: { a: { id: string; name: string; desc: string; icon: string; unlocked: boolean } }) {
  return (
    <Tooltip title={a.desc}>
      <div className={`ach-item${a.unlocked ? '' : ' ach-locked'}`}>
        <div className="ach-medal">
          {a.icon ? (
            <MedalImg src={a.icon} alt={a.name} />
          ) : (
            // 未生成勋章图的占位
            <span className="ach-medal-placeholder" />
          )}
        </div>
        <div className="ach-name">{a.name}</div>
      </div>
    </Tooltip>
  )
}

/**
 * 成就勋章墙：按评价维度分组展示所有成就。
 * - 每组一个小标题 + 维度说明，下面展示该组勋章
 * - 已解锁：显示真实勋章图；未解锁：置灰
 * hover 勋章显示完成原因与进度；挂载时预加载勋章图进浏览器缓存，避免重复请求。
 */
export default function AchievementWall({ events, metas }: Props) {
  const groups = useMemo(() => achievementStatusesByGroup(events, metas), [events, metas])
  // 全部勋章图加载完成前先显示骨架屏，避免"页面渲染出来、图片还没加载完"
  const [imagesReady, setImagesReady] = useState(false)

  // 挂载时预加载勋章图（模块级去重，同会话只跑一次）
  useEffect(() => {
    preloadMedalImages()
  }, [])

  // 等所有勋章图加载完成再渲染（失败也算完成，避免骨架卡死）
  useEffect(() => {
    let cancelled = false
    const urls = groups.flatMap((g) => g.items.map((s) => s.icon)).filter(Boolean)
    if (!urls.length) {
      setImagesReady(true)
      return
    }
    Promise.all(
      urls.map(
        (url) =>
          new Promise<void>((resolve) => {
            const img = new Image()
            img.onload = () => resolve()
            img.onerror = () => resolve()
            img.src = url
          }),
      ),
    ).then(() => {
      if (!cancelled) setImagesReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [groups])

  if (!imagesReady) return <AchievementSkeleton />

  return (
    <Card
      size="small"
      className="charts-card"
      styles={{ body: { paddingTop: 16 } }}
    >
      {groups.map((g) => (
        <section key={g.id} className="ach-group">
          <header className="ach-group-head">
            <span className="ach-group-name">{g.name}</span>
            <span className="ach-group-desc">{g.desc}</span>
            <span className="ach-group-count">
              {g.items.filter((s) => s.unlocked).length}/{g.items.length}
            </span>
          </header>
          <div className="ach-wall">
            {g.items.map((a) => (
              <AchievementBadge key={a.id} a={a} />
            ))}
          </div>
        </section>
      ))}
    </Card>
  )
}
