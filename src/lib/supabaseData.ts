/**
 * Supabase 数据访问层：标注（event_meta）+ 列顺序（column_order）的云端读写。
 * 使用 Supabase REST API（anon key，RLS 保护）。本地 dev 无网络时由 useBoardState 降级 localStorage。
 */
import type { EventMeta } from '../types'
import type { CategoryId } from '../lib/categories'
import type { BusinessId } from '../lib/business'

const SB_URL = import.meta.env.VITE_SUPABASE_URL as string
const SB_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string

/** Supabase 是否配置可用 */
export function isSupabaseReady(): boolean {
  return !!(SB_URL && SB_ANON)
}

/** REST 请求头（Supabase 需要 apikey + Authorization） */
function headers(): Record<string, string> {
  return {
    apikey: SB_ANON,
    Authorization: `Bearer ${SB_ANON}`,
    'Content-Type': 'application/json',
  }
}

/** REST 基础地址 */
function rest(table: string): string {
  return `${SB_URL}/rest/v1/${table}`
}

// ---------- 云端读取缓存：localStorage + 1 小时 TTL，写入成功后立即失效 ----------
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 小时
const CACHE_KEY = 'output-dashboard:cloud-cache'

interface CloudCache {
  ts: number
  metas?: Record<string, EventMeta>
  orders?: Partial<Record<CategoryId, string[]>>
  raw?: Partial<Record<'event_meta' | 'column_order', any[]>>
}

/** 读缓存：不存在或超过 TTL 都视为未命中 */
function readCache(): CloudCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as CloudCache
    if (!c.ts || Date.now() - c.ts > CACHE_TTL_MS) return null
    return c
  } catch {
    return null
  }
}

function writeCache(partial: Partial<CloudCache>) {
  try {
    const cur = readCache() ?? { ts: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...cur, ...partial, ts: Date.now() }))
  } catch {
    /* 忽略 */
  }
}

/** 写入成功后调用：让缓存失效，下次读取必然拉最新数据 */
function invalidateCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* 忽略 */
  }
}

/** 把 Supabase 行转成 EventMeta */
function rowToMeta(row: any): EventMeta {
  return {
    category: (row.category as CategoryId) ?? 'unassigned',
    difficulty: row.difficulty ?? 0,
    reflection: row.reflection ?? '',
    business: (row.business as BusinessId) || undefined,
    award: (row.award || undefined) as EventMeta['award'],
    likeCount: row.like_count ?? 0,
    updatedAt: row.updated_at ?? '',
  }
}

/** 把 EventMeta 转成 Supabase 行 */
function metaToRow(eventKey: string, m: EventMeta, businessDefaults: Record<string, BusinessId>): Record<string, unknown> {
  return {
    event_key: eventKey,
    category: m.category,
    difficulty: m.difficulty,
    reflection: m.reflection,
    business: m.business ?? businessDefaults[eventKey] ?? null,
    award: m.award ?? null,
    like_count: m.likeCount ?? 0,
    updated_at: m.updatedAt,
    state: 'active',
  }
}

/** 拉取全部标注（过滤软删）；1 小时内命中缓存则不请求网络 */
export async function loadAllMetas(): Promise<Record<string, EventMeta>> {
  const cached = readCache()
  if (cached?.metas) return cached.metas
  const res = await fetch(`${rest('event_meta')}?select=*&state=eq.active`, { headers: headers() })
  if (!res.ok) throw new Error(`Supabase loadAllMetas ${res.status}`)
  const rows = (await res.json()) as any[]
  const out: Record<string, EventMeta> = {}
  for (const r of rows) {
    if (r.event_key) out[r.event_key] = rowToMeta(r)
  }
  writeCache({ metas: out })
  return out
}

/** upsert 一条标注（按 event_key 冲突时更新） */
export async function upsertMeta(eventKey: string, m: EventMeta, businessDefaults: Record<string, BusinessId>): Promise<void> {
  const res = await fetch(`${rest('event_meta')}?on_conflict=event_key`, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(metaToRow(eventKey, m, businessDefaults)),
  })
  if (!res.ok) throw new Error(`Supabase upsertMeta ${res.status}`)
  invalidateCache()
}

/** 软删一条标注 */
export async function deleteMeta(eventKey: string): Promise<void> {
  const res = await fetch(`${rest('event_meta')}?event_key=eq.${encodeURIComponent(eventKey)}`, {
    method: 'PATCH',
    headers: { ...headers(), Prefer: 'return=minimal' },
    body: JSON.stringify({ state: 'removed' }),
  })
  if (!res.ok) throw new Error(`Supabase deleteMeta ${res.status}`)
  invalidateCache()
}

/** 拉取全部列顺序（category -> keys）；1 小时内命中缓存则不请求网络 */
export async function loadAllOrders(): Promise<Partial<Record<CategoryId, string[]>>> {
  const cached = readCache()
  if (cached?.orders) return cached.orders
  const res = await fetch(`${rest('column_order')}?select=*`, { headers: headers() })
  if (!res.ok) throw new Error(`Supabase loadAllOrders ${res.status}`)
  const rows = (await res.json()) as any[]
  const out: Partial<Record<CategoryId, string[]>> = {}
  for (const r of rows) {
    if (r.category) out[r.category as CategoryId] = (r.keys as string[]) ?? []
  }
  writeCache({ orders: out })
  return out
}

/** upsert 一列的列内顺序（按 category 冲突时更新） */
export async function upsertColumnOrder(category: CategoryId, keys: string[]): Promise<void> {
  const res = await fetch(`${rest('column_order')}?on_conflict=category`, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ category, keys, updated_at: new Date().toISOString() }),
  })
  if (!res.ok) throw new Error(`Supabase upsertColumnOrder ${res.status}`)
  invalidateCache()
}

/** 拉取某对象的全部原始行（含全部字段），供数据管理后台展示；1 小时内命中缓存则不请求网络 */
export async function loadAllRawRecords(obj: 'event_meta' | 'column_order'): Promise<any[]> {
  const cached = readCache()
  if (cached?.raw?.[obj]) return cached.raw[obj]
  const res = await fetch(`${rest(obj)}?select=*`, { headers: headers() })
  if (!res.ok) throw new Error(`Supabase loadAllRawRecords ${res.status}`)
  const rows = (await res.json()) as any[]
  // 转成与之前 DataAdmin 兼容的结构：{ id, data: {...} }
  const mapped = rows.map((r) => ({ id: r.id, data: { ...r } }))
  writeCache({ raw: { ...(readCache()?.raw), [obj]: mapped } })
  return mapped
}

// ---------- 点赞：like_count 存 Supabase event_meta，liked（本机"赞过没"）存 localStorage ----------

export interface MetaLikeInfo {
  recordId: string
  count: number
  liked: boolean
}

const MOCK_LIKE_KEY = 'output-dashboard:mock-likes'

/** 本机点赞状态（count 以云端为准，liked 是本机视角） */
function loadLocalLikes(): Record<string, MetaLikeInfo> {
  try {
    const raw = localStorage.getItem(MOCK_LIKE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* 忽略 */
  }
  return {}
}

function saveLocalLikes(map: Record<string, MetaLikeInfo>) {
  try {
    localStorage.setItem(MOCK_LIKE_KEY, JSON.stringify(map))
  } catch {
    /* 忽略 */
  }
}

/** 拉取全部标注的点赞信息：count 取云端 like_count，liked 取本机 localStorage */
export async function loadMetaLikes(records: Record<string, EventMeta>): Promise<Record<string, MetaLikeInfo>> {
  const local = loadLocalLikes()
  const out: Record<string, MetaLikeInfo> = {}
  for (const key of Object.keys(records)) {
    out[key] = { recordId: key, count: records[key].likeCount ?? 0, liked: !!local[key]?.liked }
  }
  return out
}

/** 云端更新某条标注的点赞数（event_key 冲突合并，行不存在则新建） */
export async function updateLikeCount(eventKey: string, count: number): Promise<void> {
  const res = await fetch(`${rest('event_meta')}?on_conflict=event_key`, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ event_key: eventKey, like_count: count }),
  })
  if (!res.ok) throw new Error(`Supabase updateLikeCount ${res.status}`)
  invalidateCache()
}

/** 点赞 / 取消点赞：本机记录 liked，云端同步 like_count */
export async function toggleMetaLike(eventKey: string, currentCount: number, liked: boolean): Promise<{ count: number; liked: boolean }> {
  const next = { recordId: eventKey, count: Math.max(0, currentCount + (liked ? -1 : 1)), liked: !liked }
  const local = loadLocalLikes()
  local[eventKey] = next
  saveLocalLikes(local)
  if (isSupabaseReady()) {
    try {
      await updateLikeCount(eventKey, next.count)
    } catch (e) {
      console.warn('[supabase] 点赞写入失败:', e)
    }
  }
  return { count: next.count, liked: next.liked }
}
