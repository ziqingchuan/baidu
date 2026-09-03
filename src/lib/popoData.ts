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
      interact: {
        set: (recordId: string, interaction: 'like' | 'dislike' | 'favorite', op: 'add' | 'cancel') => Promise<{ recordId: string; interactionData: { like_count?: number } }>
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

/** 按 key 串行化云端写：同一 event_key/category 的 upsert 排队执行，避免并发 check-then-act 竞态 */
const writeQueues = new Map<string, Promise<unknown>>()

function enqueueWrite(key: string, task: () => Promise<unknown>): Promise<unknown> {
  const prev = writeQueues.get(key) ?? Promise.resolve()
  // 无论上一个成功与否都继续下一个（失败不阻断后续写），并自动清理队列
  const next = prev.catch(() => undefined).then(task)
  writeQueues.set(key, next)
  void next.finally(() => {
    if (writeQueues.get(key) === next) writeQueues.delete(key)
  })
  return next
}

interface MetaRecord {
  event_key: string
  category: string
  difficulty: number
  reflection: string
  business: string | null
  /** 关键成果奖牌：有值写值，清除（undefined）显式写空串，保证云端字段同步清空 */
  award: string
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
    // 无奖牌也显式写空串，让 update 载荷携带清空信号（云端才会移除旧奖牌）
    award: m.award ?? '',
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
      // popo 里无奖牌时字段可能是 "" / null / 缺失，统一归一为 undefined
      award: (d.award || undefined) as EventMeta['award'],
      updatedAt: d.updated_at ?? '',
    },
  }
}

/** 按 event_key 查一条标注记录 id（存在则返回，否则 null） */
async function findMetaId(eventKey: string): Promise<string | null> {
  const record = await findMetaRecord(eventKey)
  return record?.id ?? null
}

/** upsert 一条标注（存在则 update，否则 create）；按 event_key 串行，避免并发写乱序/重复建记录 */
export async function upsertMeta(eventKey: string, m: EventMeta, businessDefaults: Record<string, BusinessId>): Promise<void> {
  await enqueueWrite(`event_meta:${eventKey}`, async () => {
    await ensureReady()
    const record = metaToRecord(eventKey, m, businessDefaults)
    const id = await findMetaId(eventKey)
    if (id) await window.PopSDK!.data.update('event_meta', id, record as unknown as Record<string, unknown>)
    else await window.PopSDK!.data.create('event_meta', record as unknown as Record<string, unknown>)
  })
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

/** 拉取某对象的全部原始记录（含 id/createdAt/updatedAt/完整 data），供数据管理后台展示 */
export async function loadAllRawRecords(obj: 'event_meta' | 'column_order'): Promise<any[]> {
  return findAll(obj)
}

/** 导入恢复的结果状态 */
export type RestoreResult = 'created' | 'updated' | 'skipped-newer'

/**
 * 按导出的原始记录还原写回 popo（用于数据恢复）。
 * - event_meta：按 event_key 定位（存在则 update，否则 create）
 * - column_order：按 category 定位（存在则 update，否则 create）
 * - 云端已有记录且其 updated_at 比导入记录更新时跳过，避免旧备份覆盖新数据
 * 返回该条记录的处理结果；抛错由调用方处理。
 */
export async function restoreRawRecord(
  obj: 'event_meta' | 'column_order',
  record: { id?: number | string; data?: Record<string, any> },
): Promise<RestoreResult> {
  await ensureReady()
  const d = record?.data ?? {}
  if (obj === 'event_meta') {
    const eventKey = d.event_key
    if (!eventKey) throw new Error('缺少 event_key')
    const existing = await findMetaRecord(eventKey)
    const existingUpdated = existing?.data?.updated_at
    const importUpdated = d.updated_at
    // 云端更新于导入记录 → 跳过，避免覆盖新数据
    if (existing && existingUpdated && importUpdated && existingUpdated > importUpdated) return 'skipped-newer'
    const meta: EventMeta = {
      category: (d.category as CategoryId) ?? 'unassigned',
      difficulty: Number(d.difficulty) || 0,
      reflection: d.reflection ?? '',
      business: (d.business as BusinessId) || undefined,
      award: (d.award || undefined) as EventMeta['award'],
      updatedAt: importUpdated ?? new Date().toISOString(),
    }
    await upsertMeta(eventKey, meta, {})
    return existing ? 'updated' : 'created'
  }
  // column_order
  const category = d.category as CategoryId
  if (!category) throw new Error('缺少 category')
  const existing = await findOrderRecord(category)
  const existingUpdated = existing?.data?.updated_at
  const importUpdated = d.updated_at
  if (existing && existingUpdated && importUpdated && existingUpdated > importUpdated) return 'skipped-newer'
  await upsertColumnOrder(category, Array.isArray(d.keys) ? (d.keys as string[]) : [])
  return existing ? 'updated' : 'created'
}

/** 查一条标注的完整原始记录（含 data.updated_at），用于导入守卫 */
async function findMetaRecord(eventKey: string): Promise<any | null> {
  await ensureReady()
  const records = await window.PopSDK!.data.find('event_meta', {
    filter: { jsonPath: `$.event_key == "${eventKey}"` },
    page: 1,
    pageSize: 10,
  })
  return records[0] ?? null
}

/** 查一条列顺序的完整原始记录（含 data.updated_at），用于导入守卫 */
async function findOrderRecord(category: CategoryId): Promise<any | null> {
  await ensureReady()
  const records = await window.PopSDK!.data.find('column_order', {
    filter: { jsonPath: `$.category == "${category}"` },
    page: 1,
    pageSize: 10,
  })
  return records[0] ?? null
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

// ---------- 点赞（popo 内置 interact，无需额外对象；本地 dev 用 mock 走查） ----------

export interface MetaLikeInfo {
  recordId: string
  count: number
  liked: boolean
}

const MOCK_LIKE_KEY = 'output-dashboard:mock-likes'

/** 本地 mock：从事件 key 确定性生成点赞数（0-8），存 localStorage 便于走查交互 */
function loadMockLikes(): Record<string, MetaLikeInfo> {
  try {
    const raw = localStorage.getItem(MOCK_LIKE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* 忽略 */
  }
  return {}
}

function saveMockLikes(map: Record<string, MetaLikeInfo>) {
  try {
    localStorage.setItem(MOCK_LIKE_KEY, JSON.stringify(map))
  } catch {
    /* 忽略 */
  }
}

/** 确定性 hash（避免每次刷新点赞数变化，方便走查） */
function hashKey(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

/** 拉取全部标注的点赞信息（event_key -> 记录id/点赞数/我是否已赞） */
export async function loadMetaLikes(): Promise<Record<string, MetaLikeInfo>> {
  // 本地 dev：无 PopSDK，返回 mock（持久化到 localStorage）
  if (!isPopoReady()) {
    const records = await findAllLocalMock('event_meta')
    const out = loadMockLikes()
    for (const r of records) {
      const d = r?.data ?? {}
      const key = d.event_key
      if (!key || d.state === 'removed') continue
      if (!out[key]) {
        out[key] = {
          recordId: r.id,
          count: hashKey(key) % 9,
          liked: false,
        }
      }
    }
    saveMockLikes(out)
    return out
  }
  const records = await findAll('event_meta')
  const out: Record<string, MetaLikeInfo> = {}
  for (const r of records) {
    const d = r?.data ?? {}
    const key = d.event_key
    if (!key || d.state === 'removed') continue
    out[key] = {
      recordId: r.id,
      count: r.interactionData?.like_count ?? 0,
      liked: r.userInteraction?.like === 1,
    }
  }
  return out
}

/** 本地 mock：读取本地元数据（无 PopSDK 时用 localStorage 快照模拟记录） */
async function findAllLocalMock(obj: string): Promise<any[]> {
  const STORAGE_KEY = obj === 'event_meta' ? 'output-dashboard:board' : 'output-dashboard:order'
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const metas = JSON.parse(raw) as Record<string, EventMeta>
    return Object.entries(metas).map(([event_key, m]) => ({
      id: `mock-${event_key}`,
      data: { event_key, ...m, state: 'active' },
    }))
  } catch {
    return []
  }
}

/** 点赞 / 取消点赞，返回最新状态 */
export async function toggleMetaLike(recordId: string, liked: boolean): Promise<{ count: number; liked: boolean }> {
  // 本地 dev：mock 点赞（localStorage 持久化）
  if (!isPopoReady()) {
    const eventKey = recordId.replace(/^mock-/, '')
    const out = loadMockLikes()
    const cur = out[eventKey] ?? { recordId, count: hashKey(eventKey) % 9, liked: false }
    const next = { ...cur, count: liked ? Math.max(0, cur.count - 1) : cur.count + 1, liked: !liked }
    out[eventKey] = next
    saveMockLikes(out)
    return { count: next.count, liked: next.liked }
  }
  await ensureReady()
  const result = await window.PopSDK!.interact.set(recordId, 'like', liked ? 'cancel' : 'add')
  return { count: result.interactionData?.like_count ?? 0, liked: !liked }
}

// ---------- column_order ----------

/** upsert 一列的列内顺序（存在则 update，否则 create）；按 category 串行 */
export async function upsertColumnOrder(category: CategoryId, keys: string[]): Promise<void> {
  await enqueueWrite(`column_order:${category}`, async () => {
    await ensureReady()
    const records = await window.PopSDK!.data.find('column_order', {
      filter: { jsonPath: `$.category == "${category}"` },
      page: 1,
      pageSize: 10,
    })
    const data = { category, keys, updated_at: new Date().toISOString() }
    if (records[0]?.id) await window.PopSDK!.data.update('column_order', records[0].id, data)
    else await window.PopSDK!.data.create('column_order', data)
  })
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
