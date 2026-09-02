import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { EventItem, EventMeta } from '../types'
import { businessById } from '../lib/business'

interface Props {
  event: EventItem
  meta?: EventMeta
  onClick: () => void
  /** 未登录只读：禁用拖拽 */
  disabled?: boolean
}

/** 看板卡片：名称(左上) + 所属业务(右上) + 代码变更数 + 日期 */
export default function BoardCard({ event, meta, onClick, disabled = false }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: event.key,
    disabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const biz = businessById(meta?.business ?? event.business)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="board-card"
    >
      <div className="board-card-title" title={event.title}>
        {event.title}
      </div>
      <div className="board-card-meta">
        {meta?.difficulty ? (
          <span className="board-card-score">⭐️{meta.difficulty}</span>
        ) : null}
        {biz && (
          <span className="board-card-biz" style={{ color: biz.color, borderColor: biz.color }}>
            {biz.name}
          </span>
        )}
      </div>
      <div className="board-card-grid">
        <div className="board-card-stats">
          <span className="ins">+{event.insertions}</span>
          <span className="del">-{event.deletions}</span>
        </div>
        <div className="board-card-date">{event.date.slice(0, 10)}</div>
      </div>
    </div>
  )
}
