import { useEffect, useMemo, useState } from 'react'
import { Card, Tooltip } from 'antd'
import type { EventItem, EventMeta } from '../types'
import { achievementStatuses, preloadMedalImages } from '../lib/achievements'

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
      className={`ach-medal-img${loaded ? ' loaded' : ''}`}
      onLoad={() => setLoaded(true)}
    />
  )
}

/**
 * 成就勋章墙：全量展示所有成就。
 * - 已解锁：显示真实勋章图
 * - 未解锁：置灰
 * hover 勋章显示完成原因与进度；挂载时预加载勋章图进浏览器缓存，避免重复请求。
 */
export default function AchievementWall({ events, metas }: Props) {
  const statuses = useMemo(() => achievementStatuses(events, metas), [events, metas])
  const unlockedCount = statuses.filter((s) => s.unlocked).length

  // 挂载时预加载勋章图（模块级去重，同会话只跑一次）
  useEffect(() => {
    preloadMedalImages()
  }, [])

  return (
    <Card
      size="small"
      title={`成就勋章 · ${unlockedCount}/${statuses.length}`}
      className="charts-card"
      styles={{ body: { paddingTop: 16 } }}
    >
      <div className="ach-wall">
        {statuses.map((a) => (
          <Tooltip
            key={a.id}
            title={a.desc}
          >
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
        ))}
      </div>
    </Card>
  )
}
