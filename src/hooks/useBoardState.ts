import { useCallback, useEffect, useState } from 'react'
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
 */
export function useBoardState(businessDefaults: Record<string, BusinessId>) {
  // 先用 localStorage 同步初始化，保证首屏立即有数据
  const [metas, setMetas] = useState<Record<string, EventMeta>>(loadAllLocal)
  const [columnOrder, setColumnOrder] = useState<Partial<Record<CategoryId, string[]>>>(loadOrderLocal)
  // 是否已完成 popo 初始化（避免本地缓存覆盖云端）
  const [hydrated, setHydrated] = useState(false)

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
        // popo 环境：从 popo 拉取，云端空则推送本地数据兜底
        let [cloudMetas, cloudOrders] = await Promise.all([loadAllMetas(), loadAllOrders()])
        const hasCloud = Object.keys(cloudMetas).length > 0 || Object.keys(cloudOrders).length > 0
        if (!hasCloud) {
          // popo 空：把本地数据推到 popo
          const localM = loadAllLocal()
          const localO = loadOrderLocal()
          if (Object.keys(localM).length) {
            for (const [key, m] of Object.entries(localM)) {
              try {
                await upsertMeta(key, m, businessDefaults)
              } catch (e) {
                console.warn('[popo] 初始化同步失败:', e)
              }
            }
          }
          for (const [cat, keys] of Object.entries(localO)) {
            try {
              await upsertColumnOrder(cat as CategoryId, keys ?? [])
            } catch (e) {
              console.warn('[popo] 顺序初始化同步失败:', e)
            }
          }
          ;[cloudMetas, cloudOrders] = await Promise.all([loadAllMetas(), loadAllOrders()])
        }
        if (cancelled) return
        const finalMetas = Object.keys(cloudMetas).length ? cloudMetas : loadAllLocal()
        const finalOrders = Object.keys(cloudOrders).length ? cloudOrders : loadOrderLocal()
        setMetas(finalMetas)
        setColumnOrder(finalOrders)
        saveLocal(STORAGE_KEY, finalMetas)
        saveLocal(ORDER_KEY, finalOrders)
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

  // ---------- 写入：localStorage 即时 + popo 异步（见 patch / saveColumnOrder） ----------

  /** 更新某个任务的部分字段 */
  const patch = useCallback(
    (eventKey: string, patchData: Partial<Omit<EventMeta, 'updatedAt'>>) => {
      setMetas((prev) => {
        const next: EventMeta = {
          category: patchData.category ?? prev[eventKey]?.category ?? 'unassigned',
          difficulty: patchData.difficulty ?? prev[eventKey]?.difficulty ?? 0,
          reflection: patchData.reflection ?? prev[eventKey]?.reflection ?? '',
          business: patchData.business ?? prev[eventKey]?.business,
          updatedAt: new Date().toISOString(),
        }
        const all = { ...prev, [eventKey]: next }
        saveLocal(STORAGE_KEY, all)
        if (isPopoReady()) {
          upsertMeta(eventKey, next, businessDefaults).catch((e) => {
            console.warn('[popo] 写入失败:', e)
          })
        }
        return all
      })
    },
    [businessDefaults],
  )

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

  const remove = useCallback(
    (eventKey: string) => {
      setMetas((prev) => {
        const all = { ...prev }
        delete all[eventKey]
        saveLocal(STORAGE_KEY, all)
        if (isPopoReady()) {
          deleteMeta(eventKey).catch((e) => {
            console.warn('[popo] 删除失败:', e)
          })
        }
        return all
      })
    },
    [],
  )

  const saveColumnOrder = useCallback(
    (category: CategoryId, keys: string[]) => {
      setColumnOrder((prev) => {
        const next = { ...prev, [category]: keys }
        saveLocal(ORDER_KEY, next)
        if (isPopoReady()) {
          upsertColumnOrder(category, keys).catch((e) => {
            console.warn('[popo] 顺序写入失败:', e)
          })
        }
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

  return { metas, setCategory, setDifficulty, setReflection, setBusiness, remove, columnOrder, saveColumnOrder, hydrated, syncLocalToCloud }
}
