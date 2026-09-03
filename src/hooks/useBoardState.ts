import { useCallback, useEffect, useRef, useState } from 'react'
import type { EventMeta } from '../types'
import type { CategoryId } from '../lib/categories'
import type { BusinessId } from '../lib/business'
import { isPopoReady, loadAllMetas, loadAllOrders, upsertMeta, upsertColumnOrder, deleteMeta, migrateFromSupabase, isMigrationDone } from '../lib/popoData'

const STORAGE_KEY = 'output-dashboard:board'
const ORDER_KEY = 'output-dashboard:order'

// ---------- localStorage 兜底层（本地 dev / popo 环境双写） ----------
function loadAllLocal(): Record<string, EventMeta> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, EventMeta>) : {}
  } catch {
    return {}
  }
}

function loadOrderLocal(): Partial<Record<CategoryId, string[]>> {
  try {
    const raw = localStorage.getItem(ORDER_KEY)
    return raw ? (JSON.parse(raw) as Partial<Record<CategoryId, string[]>>) : {}
  } catch {
    return {}
  }
}

function saveLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 忽略 */
  }
}

/**
 * 看板状态持久化：
 * - popo 环境（部署页）：标注读写走 popo 动态数据（PopSDK），localStorage 双写兜底
 * - 本地 dev：无 PopSDK，仅 localStorage
 * 每个任务一条 EventMeta + 每列一个顺序记录。
 * onSyncError：云端写失败时的回调（用于向用户提示，避免静默失败）。
 */
export function useBoardState(
  businessDefaults: Record<string, BusinessId>,
  onSyncError?: (message: string) => void,
) {
  // 先用 localStorage 同步初始化，保证首屏立即有数据
  const [metas, setMetas] = useState<Record<string, EventMeta>>(loadAllLocal)
  const [columnOrder, setColumnOrder] = useState<Partial<Record<CategoryId, string[]>>>(loadOrderLocal)
  // 是否已完成 popo 初始化（避免本地缓存覆盖云端）
  const [hydrated, setHydrated] = useState(false)
  // 待同步到云端的变更队列（updater 内只记账，effect 中统一 flush，避免 StrictMode 双调用副作用）
  const pendingSyncRef = useRef<Array<{ kind: 'meta' | 'order' | 'remove'; key: string; meta?: EventMeta; keys?: string[] }>>([])
  const onSyncErrorRef = useRef(onSyncError)
  onSyncErrorRef.current = onSyncError

  // 统一 flush 本地持久化 + 云端写（从 pending 队列取，updater 保持纯函数）
  const flushPending = useCallback(
    (currentMetas: Record<string, EventMeta>, currentOrders: Partial<Record<CategoryId, string[]>>) => {
      const pending = pendingSyncRef.current
      if (!pending.length) return
      pendingSyncRef.current = []
      for (const item of pending) {
        if (item.kind === 'meta' && item.meta) {
          saveLocal(STORAGE_KEY, currentMetas)
          if (isPopoReady()) {
            upsertMeta(item.key, item.meta, businessDefaults).catch((e) => {
              console.warn('[popo] 写入失败:', e)
              onSyncErrorRef.current?.('云端同步失败，数据已保存在本地，刷新将重试')
            })
          }
        } else if (item.kind === 'order' && item.keys) {
          saveLocal(ORDER_KEY, currentOrders)
          if (isPopoReady()) {
            upsertColumnOrder(item.key as CategoryId, item.keys).catch((e) => {
              console.warn('[popo] 顺序写入失败:', e)
              onSyncErrorRef.current?.('云端同步失败，数据已保存在本地，刷新将重试')
            })
          }
        } else if (item.kind === 'remove') {
          saveLocal(STORAGE_KEY, currentMetas)
          if (isPopoReady()) {
            deleteMeta(item.key).catch((e) => {
              console.warn('[popo] 删除失败:', e)
              onSyncErrorRef.current?.('云端删除失败，请稍后重试')
            })
          }
        }
      }
    },
    [businessDefaults],
  )

  // ---------- 初始加载：popo 优先，localStorage 兜底 ----------
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        if (!isPopoReady()) {
          // 本地 dev：无 PopSDK，直接使用 localStorage
          if (!cancelled) setHydrated(true)
          return
        }
        // 迁移：没标记过就执行（幂等 upsert，部分失败下次自动补迁；成功才置位标记）
        if (!isMigrationDone()) {
          try {
            await migrateFromSupabase()
          } catch (e) {
            console.warn('[popo] 迁移异常，下次加载重试:', e)
          }
        }
        // popo 环境：从 popo 拉取，并与本地按 updatedAt 逐条合并（避免云端旧快照覆盖本地新标注）
        const [cloudMetas, cloudOrders] = await Promise.all([loadAllMetas(), loadAllOrders()])
        const localM = loadAllLocal()
        const localO = loadOrderLocal()

        // 标注合并：取 updatedAt 更新的那条；云端缺失或本地更新的记录保留，并回推 popo
        const mergedMetas: Record<string, EventMeta> = {}
        const pushMetaKeys: string[] = []
        for (const [key, lm] of Object.entries(localM)) {
          const cm = cloudMetas[key]
          if (!cm || lm.updatedAt > cm.updatedAt) {
            mergedMetas[key] = lm
            pushMetaKeys.push(key)
          } else {
            mergedMetas[key] = cm
          }
        }
        for (const [key, cm] of Object.entries(cloudMetas)) {
          if (!mergedMetas[key]) mergedMetas[key] = cm
        }

        // 列顺序合并：本地有而云端缺失的列回推 popo
        const mergedOrders: Partial<Record<CategoryId, string[]>> = { ...cloudOrders }
        for (const [cat, keys] of Object.entries(localO)) {
          if (keys?.length && !mergedOrders[cat as CategoryId]) {
            mergedOrders[cat as CategoryId] = keys
            try {
              await upsertColumnOrder(cat as CategoryId, keys ?? [])
            } catch (e) {
              console.warn('[popo] 顺序初始化同步失败:', e)
            }
          }
        }
        // 本地独有的标注推送到 popo（幂等 upsert，失败留待下次）
        for (const key of pushMetaKeys) {
          try {
            await upsertMeta(key, mergedMetas[key], businessDefaults)
          } catch (e) {
            console.warn('[popo] 初始化同步失败:', e)
          }
        }
        if (cancelled) return
        setMetas(mergedMetas)
        setColumnOrder(mergedOrders)
        saveLocal(STORAGE_KEY, mergedMetas)
        saveLocal(ORDER_KEY, mergedOrders)
      } catch (err) {
        console.warn('[popo] 加载失败，使用本地缓存:', err)
      } finally {
        if (!cancelled) setHydrated(true)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [businessDefaults])

  // ---------- 写入：updater 只算新状态，副作用经 flushPending 统一处理 ----------

  /** 更新某个任务的部分字段 */
  const patch = useCallback(
    (eventKey: string, patchData: Partial<Omit<EventMeta, 'updatedAt'>>) => {
      setMetas((prev) => {
        const next: EventMeta = {
          category: patchData.category ?? prev[eventKey]?.category ?? 'unassigned',
          difficulty: patchData.difficulty ?? prev[eventKey]?.difficulty ?? 0,
          reflection: patchData.reflection ?? prev[eventKey]?.reflection ?? '',
          business: patchData.business ?? prev[eventKey]?.business,
          // null = 清除奖牌；undefined = 保持不变
          award: (patchData.award === null ? undefined : patchData.award ?? prev[eventKey]?.award) as EventMeta['award'],
          updatedAt: new Date().toISOString(),
        }
        pendingSyncRef.current.push({ kind: 'meta', key: eventKey, meta: next })
        return { ...prev, [eventKey]: next }
      })
    },
    [],
  )

  // 每次 metas / columnOrder 变化后统一 flush 副作用（localStorage 即时 + 云端异步）
  useEffect(() => {
    flushPending(metas, columnOrder)
  }, [metas, columnOrder, flushPending])

  const setCategory = useCallback(
    (eventKey: string, category: CategoryId) => patch(eventKey, { category }),
    [patch],
  )
  const setDifficulty = useCallback(
    (eventKey: string, difficulty: number) => patch(eventKey, { difficulty }),
    [patch],
  )
  const setReflection = useCallback(
    (eventKey: string, reflection: string) => patch(eventKey, { reflection }),
    [patch],
  )
  const setBusiness = useCallback(
    (eventKey: string, business: BusinessId) => patch(eventKey, { business }),
    [patch],
  )
  const setAward = useCallback(
    (eventKey: string, award: 'gold' | 'silver' | 'copper' | null) =>
      patch(eventKey, { award: award ?? null } as unknown as Partial<Omit<EventMeta, 'updatedAt'>>),
    [patch],
  )

  const remove = useCallback(
    (eventKey: string) => {
      setMetas((prev) => {
        const all = { ...prev }
        delete all[eventKey]
        pendingSyncRef.current.push({ kind: 'remove', key: eventKey })
        return all
      })
    },
    [],
  )

  const saveColumnOrder = useCallback(
    (category: CategoryId, keys: string[]) => {
      setColumnOrder((prev) => {
        const next = { ...prev, [category]: keys }
        pendingSyncRef.current.push({ kind: 'order', key: category, keys })
        return next
      })
    },
    [],
  )

  // ---------- 手动同步：把当前本地状态推送到 popo ----------
  const syncLocalToCloud = useCallback(async () => {
    if (!isPopoReady()) return false
    try {
      const metasData = loadAllLocal()
      const orderData = loadOrderLocal()
      for (const [eventKey, m] of Object.entries(metasData)) {
        await upsertMeta(eventKey, m, businessDefaults)
      }
      for (const [category, keys] of Object.entries(orderData)) {
        await upsertColumnOrder(category as CategoryId, keys ?? [])
      }
      return true
    } catch (err) {
      console.warn('[popo] 手动同步失败:', err)
      return false
    }
  }, [businessDefaults])

  return { metas, setCategory, setDifficulty, setReflection, setBusiness, setAward, remove, columnOrder, saveColumnOrder, hydrated, syncLocalToCloud }
}
