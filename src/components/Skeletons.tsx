/**
 * 按各 tab 真实结构做的骨架屏：
 * 云端数据就绪前 / 懒加载 chunk 下载中 / 成就图片加载完成前展示，
 * 避免"页面先渲染出来、数据或图片才慢慢蹦出"。
 */
type SkeletonView = 'board' | 'charts' | 'reflection' | 'achievements' | 'admin'

/** 图表页骨架：日历格 + 气泡 + 条形 + 热力块 + 环形 */
export function ChartsSkeleton() {
  return (
    <div className="sk-page">
      <div className="sk-row sk-row-23">
        <div className="sk-chart-card sk-lg">
          <div className="sk-cal">{Array.from({ length: 36 }, (_, i) => <div key={i} className="sk cell" />)}</div>
        </div>
        <div className="sk-chart-card">
          <div className="sk-bubbles">
            {Array.from({ length: 6 }, (_, i) => <div key={i} className="sk bubble" style={{ width: 36 + i * 7, height: 36 + i * 7 }} />)}
          </div>
        </div>
      </div>
      <div className="sk-row sk-row-12">
        <div className="sk-chart-card">
          <div className="sk-bars">{Array.from({ length: 8 }, (_, i) => <div key={i} className="sk bar" style={{ height: `${35 + ((i * 29) % 55)}%` }} />)}</div>
        </div>
        <div className="sk-chart-card"><div className="sk heat" /></div>
      </div>
      <div className="sk-row sk-row-13">
        {[0, 1, 2].map((i) => <div key={i} className="sk-chart-card"><div className="sk ring" /></div>)}
      </div>
    </div>
  )
}

/** 产出看板骨架：五列 + 卡片条 */
export function BoardSkeleton() {
  return (
    <div className="sk-board">
      {Array.from({ length: 5 }, (_, c) => (
        <div key={c} className="sk-col">
          <div className="sk col-head" />
          {Array.from({ length: 3 }, (_, j) => (
            <div key={j} className="sk card-bar" style={{ width: `${88 - j * 14}%` }} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** 反思沉淀骨架：分组标题 + 一排反思卡片 */
export function ReflectionSkeleton() {
  return (
    <div className="sk-page">
      {Array.from({ length: 3 }, (_, g) => (
        <div key={g} className="sk-reflect-group">
          <div className="sk group-head" />
          <div className="sk-row sk-row-13">
            {Array.from({ length: 3 }, (_, c) => (
              <div key={c} className="sk-reflect-card">
                <div className="sk line w-70" />
                <div className="sk line w-90" />
                <div className="sk line w-40" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** 成就勋章骨架：分组标题 + 一排勋章方块 */
export function AchievementSkeleton() {
  return (
    <div className="sk-page">
      {Array.from({ length: 5 }, (_, g) => (
        <div key={g} className="sk-ach-group">
          <div className="sk group-head" />
          <div className="sk-ach-grid">
            {Array.from({ length: 6 }, (_, m) => <div key={m} className="sk medal" />)}
          </div>
        </div>
      ))}
    </div>
  )
}

/** 数据管理骨架：工具栏 + 表格行 */
export function AdminSkeleton() {
  return (
    <div className="sk-page">
      <div className="sk admin-toolbar" />
      <div className="sk-table">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="sk-table-row">
            <div className="sk line w-30" />
            <div className="sk line w-50" />
            <div className="sk line w-70" />
            <div className="sk line w-40" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** 按当前 tab 选对应骨架 */
export function PageSkeleton({ view }: { view: SkeletonView }) {
  switch (view) {
    case 'board': return <BoardSkeleton />
    case 'reflection': return <ReflectionSkeleton />
    case 'achievements': return <AchievementSkeleton />
    case 'admin': return <AdminSkeleton />
    default: return <ChartsSkeleton />
  }
}
