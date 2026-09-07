import { Fragment, useCallback, useMemo, useRef, useState } from 'react'
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
import BoardCard, { CardView } from './BoardCard'
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
  // 跨容器拖拽的落点占位（容器 + 插入位置）：只做视觉占位，不改真实布局
  const [dropTarget, setDropTarget] = useState<{ container: string; index: number } | null>(null)
  // 记录拖拽起点列，onDragEnd 与终点比较以持久化分类
  const startColRef = useRef<CategoryId | null>(null)
  // 上一次同列重排的 (active|over)，防止 rectSorting 下来回振荡触发 React #185（Maximum update depth）
  const lastReorderRef = useRef<string | null>(null)

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
    setDropTarget(null)
    lastReorderRef.current = null
    startColRef.current = findContainer(fromId)
    setDragItems(
      Object.fromEntries(Object.entries(defaultItems).map(([k, v]) => [k, [...v]])) as ColumnItems,
    )
  }

  /**
   * 拖拽中实时移动：仅处理同容器内的列内重排（真实让位动画）。
   * 跨容器（未分类池 ↔ 分类列）不在此实时改布局 —— 拖拽中改布局会让 droppable 矩形
   * 每次测量都变化，触发 dnd-kit measureRect 无限 setState（React #185）。
   * 分类变更统一在 onDragEnd 通过 setCategory 提交。
   */
  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e
    if (!over) return
    const activeContainer = findContainer(active.id)
    const overContainer = findContainer(over.id)
    if (!activeContainer || !overContainer) return

    // 跨容器（未分类池 ↔ 分类列）：不改真实布局（避免 dnd-kit measureRect 循环 / React #185），
    // 只计算落点索引并显示占位槽；分类变更在 onDragEnd 通过 setCategory 提交。
    if (activeContainer !== overContainer) {
      const toItems = renderItems[overContainer] ?? []
      const overKey = String(over.id)
      let index = toItems.length
      if (overKey !== overContainer) {
        const overIndex = toItems.indexOf(overKey)
        if (overIndex >= 0) {
          const overRect = over.rect
          const activeRect = active.rect.current.translated
          const isBelow = activeRect && overRect ? activeRect.top > overRect.top + overRect.height : false
          index = overIndex + (isBelow ? 1 : 0)
        }
      }
      // 索引没变就不更新，避免占位来回跳动触发重渲染循环
      setDropTarget((prev) => {
        if (prev && prev.container === overContainer && prev.index === index) return prev
        return { container: overContainer, index }
      })
      return
    }

    // 同容器：列内重排（真实让位动画）
    setDropTarget(null)
    setDragItems((prev) => {
      if (!prev) return prev
      const fromKey = String(active.id)
      const fromItems = prev[activeContainer]
      // 未分类池不支持池内排序，只允许拖入/拖出
      if (activeContainer === UNASSIGNED_ID) return prev
      const oldIndex = fromItems.indexOf(fromKey)
      const newIndex = fromItems.indexOf(String(over.id))
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return prev
      // 防振荡：同一对 (active|over) 重复触发会让顺序来回翻转，导致无限重渲染（React #185）。
      // 同列重排中同对只移动一次，切断来回翻转。
      const sig = `${active.id}|${over.id}`
      if (lastReorderRef.current === sig) return prev
      lastReorderRef.current = sig
      return { ...prev, [activeContainer]: arrayMove(fromItems, oldIndex, newIndex) }
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
    setDropTarget(null)
    startColRef.current = null
    lastReorderRef.current = null
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
        setDropTarget(null)
        startColRef.current = null
        lastReorderRef.current = null
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
                  {keys.map((key, i) => {
                    const ev = eventMap.get(key)
                    if (!ev) return null
                    return (
                      <Fragment key={ev.key}>
                        {dropTarget?.container === col.id && dropTarget.index === i && (
                          <div className="kanban-drop-slot" />
                        )}
                        <BoardCard
                          event={ev}
                          meta={metas[ev.key]}
                          disabled={!editable}
                          onClick={() => handleCardClick(ev.key)}
                        />
                      </Fragment>
                    )
                  })}
                  {dropTarget?.container === col.id && dropTarget.index >= keys.length && (
                    <div className="kanban-drop-slot" />
                  )}
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
        {/* 未分类池仅可拖出/拖入，不参与池内排序：纯拖拽，避免 rectSortingStrategy 干扰上方列滚动 / 触发 React #185 */}
        <div className="kanban-unassigned-body">
          {unassignedKeys.map((key, i) => {
            const ev = eventMap.get(key)
            if (!ev) return null
            return (
              <Fragment key={ev.key}>
                {dropTarget?.container === UNASSIGNED_ID && dropTarget.index === i && (
                  <div className="kanban-drop-slot pool" />
                )}
                <div className="kanban-unassigned-card">
                  <BoardCard
                    event={ev}
                    meta={metas[ev.key]}
                    disabled={!editable}
                    onClick={() => handleCardClick(ev.key)}
                    sortable={false}
                  />
                </div>
              </Fragment>
            )
          })}
          {dropTarget?.container === UNASSIGNED_ID && dropTarget.index >= unassignedKeys.length && (
            <div className="kanban-drop-slot pool" />
          )}
        </div>
      </UnassignedShell>

      <DragOverlay>
        {activeEvent ? (
          <div style={{ width: 240 }}>
            {/* 覆盖层用无 dnd hooks 的纯卡片，避免与源卡片重复注册触发重渲染循环 */}
            <CardView event={activeEvent} meta={metas[activeEvent.key]} onClick={() => {}} />
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
