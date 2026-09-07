import { useSortable } from '@dnd-kit/sortable'
import { useDraggable } from '@dnd-kit/core'
import type { DraggableAttributes } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { CSSProperties } from 'react'
import type { EventItem, EventMeta } from '../types'
import { businessById } from '../lib/business'
import { awardById } from '../lib/awards'
import AwardBadge from './AwardBadge'
import starSvg from '../assets/star.svg'

interface Props {
  event: EventItem
  meta?: EventMeta
  onClick: () => void
  /** 未登录只读：禁用拖拽 */
  disabled?: boolean
  /** 未分类池卡片：仅可拖拽、不参与排序（规避 rectSortingStrategy 在 React19 下的重渲染循环） */
  sortable?: boolean
}

interface CardViewProps {
  event: EventItem
  meta?: EventMeta
  onClick: () => void
  style?: CSSProperties
  attributes?: DraggableAttributes
  listeners?: Record<string, Function>
  setNodeRef?: (el: HTMLElement | null) => void
}

/** 纯展示层（无 dnd hooks），供未分类池与 DragOverlay 复用 */
export function CardView({ event, meta, onClick, style, attributes, listeners, setNodeRef }: CardViewProps) {
  const biz = businessById(meta?.business ?? event.business)
  const award = awardById(meta?.award)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="board-card"
    >
      {award && (
        <span className="board-card-award">
          <AwardBadge award={award.id} size={20} />
        </span>
      )}
      <div className="board-card-title" title={event.title}>
        {event.title}
      </div>
      <div className="board-card-meta">
        {meta?.difficulty ? (
          <span className="board-card-score">
            <img className="diff-star" src={starSvg} alt="" />
            {meta.difficulty}
          </span>
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

/** 可排序卡片（分类列内） */
function SortableBoardCard({ event, meta, onClick, disabled = false }: Omit<Props, 'sortable'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: event.key, disabled })
  return (
    <CardView
      event={event}
      meta={meta}
      onClick={onClick}
      attributes={attributes}
      listeners={listeners}
      setNodeRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    />
  )
}

/** 仅可拖拽卡片（未分类池，不参与池内排序） */
function DraggableBoardCard({ event, meta, onClick, disabled = false }: Omit<Props, 'sortable'>) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: event.key, disabled })
  return (
    <CardView
      event={event}
      meta={meta}
      onClick={onClick}
      attributes={attributes}
      listeners={listeners}
      setNodeRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), opacity: isDragging ? 0.4 : 1 }}
    />
  )
}

export default function BoardCard(props: Props) {
  return props.sortable === false ? <DraggableBoardCard {...props} /> : <SortableBoardCard {...props} />
}
