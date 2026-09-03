import { useCallback, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type CollisionDetection,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { Badge, Tooltip, App as AntApp } from 'antd'
import {
  InboxOutlined,
  ClockCircleOutlined,
  AppstoreOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import type { EventItem, EventMeta } from '../types'
import { CATEGORIES, UNASSIGNED_CATEGORY, softTint, type CategoryId } from '../lib/categories'
import type { BusinessId } from '../lib/business'
import { businessById } from '../lib/business'
import BoardCard from './BoardCard'
import EventEditModal from './EventEditModal'
import { effectiveCategory } from '../lib/boardStats'

interface Props {
  events: EventItem[]
  metas: Record<string, EventMeta>
  columnOrder: Partial<Record<CategoryId, string[]>>
  setCategory: (key: string, category: CategoryId) => void
  setDifficulty: (key: string, difficulty: number) => void
  setReflection: (key: string, reflection: string) => void
  setBusiness: (key: string, business: BusinessId) => void
  setAward: (key: string, award: 'gold' | 'silver' | 'copper' | null) => void
  saveColumnOrder: (category: CategoryId, keys: string[]) => void
  /** 是否已登录（未登录：只读，禁拖拽/禁编辑/禁排序） */
  editable: boolean
}

const COLUMNS: { id: CategoryId; name: string; color: string; hint: string }[] = CATEGORIES.map((c) => ({
  id: c.id,
  name: c.name,
  color: c.color,
  hint: c.hint,
}))

const UNASSIGNED_ID = UNASSIGNED_CATEGORY.id as CategoryId

type ColumnItems = Record<CategoryId, string[]>

/** 列排序配置 */
interface SortSpec {
  field: 'time' | 'business'
  dir: 'asc' | 'desc'
}

/**
 * 碰撞检测：优先 pointerWithin（指针实际位置），返回多个命中时
 * 按 droppable 面积升序（卡片 < 列），确保 over 优先命中卡片而非容器，
 * 这样空列也能被可靠识别为目标容器。
 */
const collisionDetection: CollisionDetection = (args) => {
  const pointer = pointerWithin(args)
  if (pointer.length === 0) return closestCorners(args)
  return pointer.sort((a, b) => {
    const ra = args.droppableRects.get(a.id)
    const rb = args.droppableRects.get(b.id)
    const areaA = ra ? ra.width * ra.height : Infinity
    const areaB = rb ? rb.width * rb.height : Infinity
    return areaA - areaB
  })
}

/** 列容器：作为 droppable，整列都是落点 */
function ColumnShell({
  id,
  children,
}: {
  id: CategoryId
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`kanban-column${isOver ? ' drop-over' : ''}`}>
      {children}
    </div>
  )
}

/** 底部通栏未分类看板：作为 droppable，卡片横向 wrap 排布 */
function UnassignedShell({
  children,
}: {
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: UNASSIGNED_ID })
  return (
    <div ref={setNodeRef} className={`kanban-unassigned${isOver ? ' drop-over' : ''}`}>
      {children}
    </div>
  )
}

export default function KanbanBoard({ events, metas, columnOrder, setCategory, setDifficulty, setReflection, setBusiness, setAward, saveColumnOrder, editable }: Props) {
  const { message } = AntApp.useApp()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editKey, setEditKey] = useState<string | null>(null)
  // 每列的排序配置
  const [sorts, setSorts] = useState<Partial<Record<CategoryId, SortSpec>>>({})
  // 拖拽期间的实时列顺序（让位动画由它驱动）；null 表示使用默认顺序
  const [dragItems, setDragItems] = useState<ColumnItems | null>(null)
  // 记录拖拽起点列，onDragEnd 与终点比较以持久化分类
  const startColRef = useRef<CategoryId | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  // key -> event 索引
  const eventMap = useMemo(() => new Map(events.map((e) => [e.key, e])), [events])

  // 所有容器 id：5 个分类 + 未分类
  const allIds = useMemo<CategoryId[]>(() => [...COLUMNS.map((c) => c.id), UNASSIGNED_ID], [])

  /** 任务的展示业务名（用于业务排序）——用 useCallback 固定引用，避免 defaultItems 每次渲染重算导致 items 引用变化 */
  const businessNameOf = useCallback(
    (key: string): string => {
      const ev = eventMap.get(key)
      if (!ev) return ''
      const b = businessById(metas[key]?.business ?? ev.business)
      return b?.name ?? ''
    },
    [eventMap, metas],
  )

  /** 默认列顺序：优先列排序配置，其次用户手动排序，最后按时间倒序 */
  const defaultItems = useMemo<ColumnItems>(() => {
    const map = {} as ColumnItems
    for (const id of allIds) map[id] = []
    for (const e of events) {
      const cat = effectiveCategory(e, metas)
      if (!map[cat]) map[cat] = []
      map[cat].push(e.key)
    }
    for (const id of allIds) {
      const sort = sorts[id]
      if (sort) {
        map[id].sort((a, b) => {
          let cmp = 0
          if (sort.field === 'time') {
            const da = eventMap.get(a)?.date ?? ''
            const db = eventMap.get(b)?.date ?? ''
            cmp = da < db ? -1 : da > db ? 1 : 0
          } else {
            cmp = businessNameOf(a).localeCompare(businessNameOf(b), 'zh')
          }
          return sort.dir === 'asc' ? cmp : -cmp
        })
        continue
      }
      const manual = columnOrder[id]
      if (manual && manual.length) {
        const seen = new Set(manual)
        const extras = map[id].filter((k) => !seen.has(k))
        extras.sort((a, b) => {
          const da = eventMap.get(a)?.date ?? ''
          const db = eventMap.get(b)?.date ?? ''
          return da < db ? 1 : -1
        })
        map[id] = [...manual.filter((k) => map[id].includes(k)), ...extras]
      } else {
        map[id].sort((a, b) => {
          const da = eventMap.get(a)?.date ?? ''
          const db = eventMap.get(b)?.date ?? ''
          return da < db ? 1 : -1
        })
      }
    }
    return map
  }, [events, metas, eventMap, columnOrder, allIds, sorts, businessNameOf])

  // 渲染用顺序：拖拽中实时，否则默认
  const renderItems = dragItems ?? defaultItems

  /** 找 id（卡片或列）所在列 */
  const findContainer = (id: string | number): CategoryId | null => {
    if (allIds.includes(id as CategoryId)) return id as CategoryId
    for (const [cat, keys] of Object.entries(renderItems)) {
      if (keys.includes(String(id))) return cat as CategoryId
    }
    return null
  }

  const activeEvent = activeId ? eventMap.get(activeId) : undefined
  const editingEvent = editKey ? eventMap.get(editKey) : undefined

  const handleDragStart = (e: DragStartEvent) => {
    const fromId = String(e.active.id)
    setActiveId(fromId)
    startColRef.current = findContainer(fromId)
    setDragItems(
      Object.fromEntries(Object.entries(defaultItems).map(([k, v]) => [k, [...v]])) as ColumnItems,
    )
  }

  /** 拖拽中实时移动卡片：同列重排 / 跨列插入，触发真实让位动画 */
  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e
    if (!over) return
    const activeContainer = findContainer(active.id)
    const overContainer = findContainer(over.id)
    if (!activeContainer || !overContainer) return

    setDragItems((prev) => {
      if (!prev) return prev
      const fromKey = String(active.id)
      const fromItems = prev[activeContainer]

      // 同列：arrayMove 重排 → 卡片让位并记录新顺序
      if (activeContainer === overContainer) {
        const oldIndex = fromItems.indexOf(fromKey)
        const newIndex = fromItems.indexOf(String(over.id))
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return prev
        return { ...prev, [activeContainer]: arrayMove(fromItems, oldIndex, newIndex) }
      }

      // 跨列：根据悬停位置插入目标列对应 index
      const oldIndex = fromItems.indexOf(fromKey)
      if (oldIndex < 0) return prev
      const toItems = prev[overContainer]
      const overKey = String(over.id)

      let newIndex: number
      if (toItems.includes(overKey)) {
        // 悬停在目标列某卡片上：根据 active 在其上方/下方决定插前/插后
        const overRect = over.rect
        const activeRect = active.rect.current.translated
        const isBelow =
          activeRect && overRect ? activeRect.top > overRect.top + overRect.height : false
        newIndex = toItems.indexOf(overKey) + (isBelow ? 1 : 0)
      } else {
        // 悬停在列/空白区：追加到末尾
        newIndex = toItems.length
      }

      const fromArr = fromItems.filter((k) => k !== fromKey)
      const toArr = [...toItems.slice(0, newIndex), fromKey, ...toItems.slice(newIndex)]
      return { ...prev, [activeContainer]: fromArr, [overContainer]: toArr }
    })
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    const fromId = String(active.id)
    const overCol = over ? findContainer(over.id) : null
    const startCol = startColRef.current
    if (overCol && startCol && overCol !== startCol) {
      setCategory(fromId, overCol)
    }
    if (dragItems) {
      if (overCol && dragItems[overCol]) saveColumnOrder(overCol, dragItems[overCol])
      if (startCol && dragItems[startCol] && startCol !== overCol) {
        saveColumnOrder(startCol, dragItems[startCol])
      }
    }
    setActiveId(null)
    setDragItems(null)
    startColRef.current = null
  }

  /** 点击卡片：登录后打开编辑弹窗；未登录提示登录 */
  const handleCardClick = (key: string) => {
    if (!editable) {
      message.info('登录后可编辑卡片')
      return
    }
    setEditKey(key)
  }

  const handleEditSave = (difficulty: number, reflection: string) => {
    if (!editKey) return
    const ev = events.find((e) => e.key === editKey)
    if (ev) setCategory(editKey, effectiveCategory(ev, metas))
    setDifficulty(editKey, difficulty)
    setReflection(editKey, reflection)
  }

  /** 点击排序按钮：切换 field/方向 */
  const toggleSort = (col: CategoryId, field: SortSpec['field']) => {
    setSorts((prev) => {
      const cur = prev[col]
      if (cur && cur.field === field) {
        // 同字段：切换方向
        return { ...prev, [col]: { field, dir: cur.dir === 'asc' ? 'desc' : 'asc' } }
      }
      return { ...prev, [col]: { field, dir: field === 'time' ? 'desc' : 'asc' } }
    })
  }

  const clearSort = (col: CategoryId) => {
    setSorts((prev) => {
      const next = { ...prev }
      delete next[col]
      return next
    })
  }

  const unassignedKeys = renderItems[UNASSIGNED_ID] ?? []

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null)
        setDragItems(null)
        startColRef.current = null
      }}
    >
      {/* 五个分类列 */}
      <div className="kanban">
        {COLUMNS.map((col) => {
          const keys = renderItems[col.id] ?? []
          const sort = sorts[col.id]
          return (
            <ColumnShell key={col.id} id={col.id}>
              <div
                className="kanban-column-header"
                style={{ background: softTint(col.color, 0.1) }}
              >
                <span className="kanban-column-name" style={{ color: col.color }}>
                  <span className="kanban-column-dot" style={{ background: col.color }} />
                  {col.name}
                </span>
                <div className="kanban-column-actions">
                  <div className="kanban-sort-btns">
                    <Tooltip title={sort?.field === 'time' ? `按时间排序（${sort.dir === 'asc' ? '旧→新' : '新→旧'}）` : '按时间排序'}>
                      <button
                        type="button"
                        className={`kanban-sort-btn${sort?.field === 'time' ? ' active' : ''}`}
                        style={sort?.field === 'time' ? { color: col.color } : undefined}
                        disabled={!editable}
                        onClick={() => toggleSort(col.id, 'time')}
                      >
                        <ClockCircleOutlined />
                        {sort?.field === 'time' ? (sort.dir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </Tooltip>
                    <Tooltip title={sort?.field === 'business' ? `按业务排序（${sort.dir === 'asc' ? 'A→Z' : 'Z→A'}）` : '按业务排序'}>
                      <button
                        type="button"
                        className={`kanban-sort-btn${sort?.field === 'business' ? ' active' : ''}`}
                        style={sort?.field === 'business' ? { color: col.color } : undefined}
                        disabled={!editable}
                        onClick={() => toggleSort(col.id, 'business')}
                      >
                        <AppstoreOutlined />
                        {sort?.field === 'business' ? (sort.dir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </Tooltip>
                  </div>
                  {sort && (
                    <button
                      type="button"
                      className="kanban-sort-clear"
                      disabled={!editable}
                      onClick={() => clearSort(col.id)}
                    >
                      <CloseOutlined />
                    </button>
                  )}
                  <Badge count={keys.length} showZero color={col.color} />
                </div>
              </div>
              <div className="kanban-column-hint">{col.hint}</div>
              <SortableContext items={keys} strategy={verticalListSortingStrategy}>
                <div className="kanban-column-body">
                  {keys.map((key) => {
                    const ev = eventMap.get(key)
                    if (!ev) return null
                    return (
                      <BoardCard
                        key={ev.key}
                        event={ev}
                        meta={metas[ev.key]}
                        disabled={!editable}
                        onClick={() => handleCardClick(ev.key)}
                      />
                    )
                  })}
                </div>
              </SortableContext>
            </ColumnShell>
          )
        })}
      </div>

      {/* 底部通栏：未分类看板 */}
      <UnassignedShell>
        <div className="kanban-unassigned-header">
          <span className="kanban-unassigned-name">
            <InboxOutlined style={{ color: UNASSIGNED_CATEGORY.color }} />
            未分类
          </span>
          <Badge count={unassignedKeys.length} showZero color={UNASSIGNED_CATEGORY.color} />
        </div>
        <div className="kanban-unassigned-hint">从下方拖拽卡片到上方对应分类中，完成归类</div>
        <SortableContext items={unassignedKeys} strategy={rectSortingStrategy}>
          <div className="kanban-unassigned-body">
            {unassignedKeys.map((key) => {
              const ev = eventMap.get(key)
              if (!ev) return null
              return (
                <div className="kanban-unassigned-card" key={ev.key}>
                  <BoardCard
                    event={ev}
                    meta={metas[ev.key]}
                    disabled={!editable}
                    onClick={() => handleCardClick(ev.key)}
                  />
                </div>
              )
            })}
          </div>
        </SortableContext>
      </UnassignedShell>

      <DragOverlay>
        {activeEvent ? (
          <div style={{ width: 240 }}>
            <BoardCard event={activeEvent} meta={metas[activeEvent.key]} onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>

      <EventEditModal
        event={editingEvent}
        meta={editingEvent ? metas[editingEvent.key] : undefined}
        open={!!editingEvent}
        onClose={() => setEditKey(null)}
        onSave={handleEditSave}
        onBusinessChange={(b) => editingEvent && setBusiness(editingEvent.key, b)}
        onAwardChange={(a) => editingEvent && setAward(editingEvent.key, a)}
      />
    </DndContext>
  )
}
