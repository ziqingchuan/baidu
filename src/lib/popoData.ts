/**
 * popo 动态数据访问层（替代 Supabase）。
 * 仅当页面运行在 popo 环境（window.PopSDK 存在）时可用；本地 dev 无 PopSDK，降级 localStorage。
 * 对象：
 *   - event_meta   : 每个任务一条标注（event_key 唯一）
 *   - column_order : 每个分类一行的列内顺序（category 唯一）
 */
import type { EventMeta } from '../types'
import type { CategoryId } from '../lib/categories'
import type { BusinessId } from '../lib/business'

declare global {
  interface Window {
    PopSDK?: {
      ready: () => Promise<void>
      data: {
        create: (obj: string, data: Record<string, unknown>) => Promise<{ id: string; data: Record<string, unknown> }>
        find: (obj: string, opts?: { filter?: { jsonPath?: string }; order?: { expression: string }[]; page?: number; pageSize?: number }) => Promise<any[]>
        update: (obj: string, id: string, data: Record<string, unknown>) => Promise<any>
        get: (obj: string, id: string) => Promise<any>
      }
    }
  }
}

/** popo 环境是否可用（平台注入 SDK） */
export function isPopoReady(): boolean {
  return typeof window !== 'undefined' && !!window.PopSDK
}

async function ensureReady(): Promise<void> {
  if (!isPopoReady()) throw new Error('当前环境无 PopSDK（请在 popo 页面使用）')
  await window.PopSDK!.ready()
}

// ---------- event_meta ----------

interface MetaRecord {
  event_key: string
  category: string
  difficulty: number
  reflection: string
  business: string | null
  updated_at: string
  state: string
}

function metaToRecord(eventKey: string, m: EventMeta, businessDefaults: Record<string, BusinessId>): MetaRecord {
  return {
    event_key: eventKey,
    category: m.category,
    difficulty: m.difficulty,
    reflection: m.reflection,
    business: m.business ?? businessDefaults[eventKey] ?? null,
    updated_at: m.updatedAt,
    state: 'active',
  }
}

function recordToMeta(r: any): { key: string; meta: EventMeta } {
  const d = r?.data ?? {}
  return {
    key: d.event_key,
    meta: {
      category: (d.category as CategoryId) ?? 'unassigned',
      difficulty: d.difficulty ?? 0,
      reflection: d.reflection ?? '',
      business: (d.business as BusinessId) ?? undefined,
      updatedAt: d.updated_at ?? '',
    },
  }
}

/** 按 event_key 查一条标注记录，返回记录 id 或 null */
async function findMetaId(eventKey: string): Promise<string | null> {
  await ensureReady()
  const records = await window.PopSDK!.data.find('event_meta', {
    filter: { jsonPath: `$.event_key == "${eventKey}"` },
    page: 1,
    pageSize: 10,
  })
  return records[0]?.id ?? null
}

/** upsert 一条标注（存在则 update，否则 create） */
export async function upsertMeta(eventKey: string, m: EventMeta, businessDefaults: Record<string, BusinessId>): Promise<void> {
  await ensureReady()
  const record = metaToRecord(eventKey, m, businessDefaults)
  const id = await findMetaId(eventKey)
  if (id) await window.PopSDK!.data.update('event_meta', id, record as unknown as Record<string, unknown>)
  else await window.PopSDK!.data.create('event_meta', record as unknown as Record<string, unknown>)
}

/** 分页拉全某对象的全部记录（find 每页上限 100） */
async function findAll(obj: string): Promise<any[]> {
  await ensureReady()
  const out: any[] = []
  for (let page = 1; page <= 20; page++) {
    const records = await window.PopSDK!.data.find(obj, { page, pageSize: 100 })
    out.push(...records)
    if (records.length < 100) break
  }
  return out
}

/** 拉取全部标注（过滤已软删的记录） */
export async function loadAllMetas(): Promise<Record<string, EventMeta>> {
  const records = await findAll('event_meta')
  const out: Record<string, EventMeta> = {}
  for (const r of records) {
    const d = r?.data ?? {}
    if (d.state === 'removed') continue
    const { key, meta } = recordToMeta(r)
    if (key) out[key] = meta
  }
  return out
}

/** 删除一条标注（软删：置 state=removed，Schema 需含 state 字段） */
export async function deleteMeta(eventKey: string): Promise<void> {
  await ensureReady()
  const id = await findMetaId(eventKey)
  if (id) await window.PopSDK!.data.update('event_meta', id, { state: 'removed' } as unknown as Record<string, unknown>)
}

// ---------- column_order ----------

/** upsert 一列的列内顺序（存在则 update，否则 create） */
export async function upsertColumnOrder(category: CategoryId, keys: string[]): Promise<void> {
  await ensureReady()
  const records = await window.PopSDK!.data.find('column_order', {
    filter: { jsonPath: `$.category == "${category}"` },
    page: 1,
    pageSize: 10,
  })
  const data = { category, keys, updated_at: new Date().toISOString() }
  if (records[0]?.id) await window.PopSDK!.data.update('column_order', records[0].id, data)
  else await window.PopSDK!.data.create('column_order', data)
}

/** 拉取全部列顺序 */
export async function loadAllOrders(): Promise<Partial<Record<CategoryId, string[]>>> {
  const records = await findAll('column_order')
  const out: Partial<Record<CategoryId, string[]>> = {}
  for (const r of records) {
    const d = r?.data ?? {}
    if (d.category) out[d.category as CategoryId] = d.keys ?? []
  }
  return out
}

// ---------- 迁移标记：成功才置位，失败下次加载自动重试 ----------
const MIGRATED_KEY = 'output-dashboard:popo-migrated'

export function isMigrationDone(): boolean {
  try {
    return localStorage.getItem(MIGRATED_KEY) === '1'
  } catch {
    return false
  }
}

function markMigrationDone() {
  try {
    localStorage.setItem(MIGRATED_KEY, '1')
  } catch {
    /* 忽略 */
  }
}

// ---------- 一次性迁移：从 Supabase 拉存量标注写入 popo ----------

/**
 * 从 Supabase REST 读取存量标注并写入 popo。
 * - 幂等：按 event_key 先查后写，重复执行不会产生重复记录
 * - 容错：单条失败只计数跳过，不中断整体
 * - 全部成功（或两端都无数据）才标记完成；失败留待下次加载重试
 */
export async function migrateFromSupabase(): Promise<boolean> {
  const url = import.meta.env.VITE_SUPABASE_URL as string
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  if (!url || !anonKey) return false
  try {
    const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
    const [metaRes, orderRes] = await Promise.all([
      fetch(`${url}/rest/v1/event_meta?select=event_key,category,difficulty,reflection,business,updated_at`, { headers }),
      fetch(`${url}/rest/v1/column_order?select=category,keys`, { headers }),
    ])
    if (!metaRes.ok || !orderRes.ok) return false
    const metaRows = await metaRes.json().catch(() => [])
    const orderRows = await orderRes.json().catch(() => [])

    let ok = 0
    let fail = 0
    for (const row of metaRows) {
      if (!row?.event_key) continue
      try {
        await upsertMeta(row.event_key, {
          category: row.category ?? 'unassigned',
          difficulty: row.difficulty ?? 0,
          reflection: row.reflection ?? '',
          business: row.business ?? undefined,
          updatedAt: row.updated_at ?? '',
        }, {})
        ok++
      } catch {
        fail++
      }
    }
    for (const row of orderRows) {
      if (!row?.category) continue
      try {
        await upsertColumnOrder(row.category, row.keys ?? [])
      } catch {
        fail++
      }
    }
    console.log(`[popo] 从 Supabase 迁移：成功 ${ok} 条 / 失败 ${fail} 条`)
    // 全部成功，或无数据可迁（两端都没有 → 也是终态）才标记完成
    if (fail === 0) {
      markMigrationDone()
      return ok > 0
    }
    return false
  } catch (err) {
    console.warn('[popo] 从 Supabase 迁移失败:', err)
    return false
  }
}
