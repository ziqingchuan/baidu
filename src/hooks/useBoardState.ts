import { useCallback, useEffect, useRef, useState } from 'react'
import type { EventMeta } from '../types'
import type { CategoryId } from '../lib/categories'
import type { BusinessId } from '../lib/business'
import {
  isSupabaseReady,
  loadAllMetas,
  loadAllOrders,
  upsertMeta,
  upsertColumnOrder,
  deleteMeta,
} from '../lib/supabaseData'

/**
 * 看板状态持久化：Supabase 云端为唯一数据源，不做 localStorage 兜底。
 * - 云端读取成功：以云端数据为准
 * - 云端读取失败：页面内报错提示（不回落本地缓存）
 * onError：加载或写入失败时的回调（弹顶部提示）。
 */
export function useBoardState(
  businessDefaults: Record<string, BusinessId>,
  onError?: (message: string) => void,
) {
  const [metas, setMetas] = useState<Record<string, EventMeta>>({})
  const [columnOrder, setColumnOrder] = useState<Partial<Record<CategoryId, string[]>>>({})
  // 初始云端数据是否已加载完成（加载期间页面显示骨架屏）
  const [ready, setReady] = useState(false)
  // 待写入的变更队列（updater 内只记账，effect 中统一 flush，避免 StrictMode 双调用副作用）
  const pendingSyncRef = useRef<Array<{ kind: 'meta' | 'order' | 'remove'; key: string; meta?: EventMeta; keys?: string[] }>>([])
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  // ---------- 初始加载：Supabase 云端为唯一数据源 ----------
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!isSupabaseReady()) {
        if (!cancelled) onErrorRef.current?.('未配置 Supabase，无法读取云端数据')
        if (!cancelled) setReady(true)
        return
      }
      try {
        const [cloudMetas, cloudOrders] = await Promise.all([loadAllMetas(), loadAllOrders()])
        if (cancelled) return
        setMetas(cloudMetas)
        setColumnOrder(cloudOrders)
      } catch (err) {
        console.warn('[supabase] 云端数据读取失败:', err)
        if (!cancelled) onErrorRef.current?.('云端数据读取失败，请检查网络或 Supabase 配置')
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  // ---------- 写入：updater 只算新状态，副作用经 flushPending 统一处理 ----------

  // 统一 flush：云端可用则写云端（无 localStorage 兜底）
  const flushPending = useCallback(() => {
    const pending = pendingSyncRef.current
    if (!pending.length) return
    pendingSyncRef.current = []
    // 同一 key 只保留最后一次变更，避免同 key 并发旧快照覆盖新数据
    const latest = new Map<string, { kind: 'meta' | 'order' | 'remove'; key: string; meta?: EventMeta; keys?: string[] }>()
    for (const item of pending) latest.set(item.key, item)
    for (const item of latest.values()) {
      if (item.kind === 'meta' && item.meta) {
        if (isSupabaseReady()) {
          upsertMeta(item.key, item.meta, businessDefaults).catch((e) => {
            console.warn('[supabase] 写入失败:', e)
            onErrorRef.current?.('云端写入失败')
          })
        }
      } else if (item.kind === 'order' && item.keys) {
        if (isSupabaseReady()) {
          upsertColumnOrder(item.key as CategoryId, item.keys).catch((e) => {
            console.warn('[supabase] 顺序写入失败:', e)
            onErrorRef.current?.('云端顺序保存失败')
          })
        }
      } else if (item.kind === 'remove') {
        if (isSupabaseReady()) {
          deleteMeta(item.key).catch((e) => {
            console.warn('[supabase] 删除失败:', e)
            onErrorRef.current?.('云端删除失败')
          })
        }
      }
    }
  }, [businessDefaults])

  // 每次 metas / columnOrder 变化后统一 flush
  useEffect(() => {
    flushPending()
  }, [metas, columnOrder, flushPending])

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

  return { metas, setCategory, setDifficulty, setReflection, setBusiness, setAward, remove, columnOrder, saveColumnOrder, ready }
}
