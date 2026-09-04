/**
 * 骨架屏：按各 tab 的板块结构用大矩形容器占位（不做内部细节）。
 * 云端数据就绪前 / 懒加载 chunk 下载中 / 成就图片加载完成前展示。
 */
type SkeletonView = 'board' | 'charts' | 'reflection' | 'achievements' | 'admin'

/** 大矩形骨架块 */
function Block({ className }: { className?: string }) {
  return <div className={`sk blk ${className ?? ''}`} />
}

/** 图表页：按行板块排布的大矩形 */
export function ChartsSkeleton() {
  return (
    <div className="sk-page">
      <div className="sk-row sk-row-23"><Block /><Block /></div>
      <div className="sk-row sk-row-12"><Block /><Block /></div>
      <div className="sk-row sk-row-13"><Block /><Block /><Block /></div>
      <div className="sk-row sk-row-12"><Block /><Block /></div>
      <Block />
    </div>
  )
}

/** 产出看板：五列大矩形 */
export function BoardSkeleton() {
  return (
    <div className="sk-board">
      {Array.from({ length: 5 }, (_, i) => <Block key={i} />)}
    </div>
  )
}

/** 反思沉淀：三块大矩形 */
export function ReflectionSkeleton() {
  return (
    <div className="sk-page">
      {Array.from({ length: 3 }, (_, i) => <Block key={i} />)}
    </div>
  )
}

/** 成就勋章：几块大矩形 */
export function AchievementSkeleton() {
  return (
    <div className="sk-page">
      {Array.from({ length: 4 }, (_, i) => <Block key={i} />)}
    </div>
  )
}

/** 数据管理：工具栏 + 表格大矩形 */
export function AdminSkeleton() {
  return (
    <div className="sk-page">
      <Block className="b-tool" />
      <Block className="b-table" />
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
