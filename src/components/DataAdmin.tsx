import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Table, Tag, Tooltip, App as AntApp, Empty, Segmented, Input, Modal, Checkbox } from 'antd'
import type { TableProps } from 'antd'
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import * as XLSX from 'xlsx'
import { isPopoReady, loadAllRawRecords, restoreRawRecord } from '../lib/popoData'
import { categoryById, type CategoryId } from '../lib/categories'
import { businessById, type BusinessId } from '../lib/business'
import { useDashboardData } from '../lib/useDashboardData'
import { JsonViewer } from './common/JsonViewer'
import Button from './ui/Button'

/** 单条原始记录（popo find 返回结构，业务字段在 data 里） */
interface RawRecord {
  id: number | string
  data: Record<string, any>
  createdAt?: string
  updatedAt?: string
  interactionData?: Record<string, any>
  userInteraction?: Record<string, any>
}

/** 数据源：popo 动态数据表 / 脚本抓取的原始数据表 */
type TableName =
  | 'event_meta'
  | 'column_order'
  | 'reviews'
  | 'commits'
  | 'cards'

const TABLE_NAMES: Record<TableName, string> = {
  event_meta: '任务标注表（event_meta）',
  column_order: '列顺序表（column_order）',
  reviews: 'CR 评审（reviews）',
  commits: '提交记录（commits）',
  cards: '卡片（cards）',
}

/** 时长差（用于标注"记录多久没更新"） */
function ago(iso?: string): string {
  if (!iso) return '-'
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms) || ms < 0) return '-'
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  if (d > 0) return `${d}天前`
  if (h > 0) return `${h}小时前`
  return '刚刚'
}

/** 把任意值转成可读短文本，undefined/null/空串显示灰色占位 */
function cell(value: unknown): React.ReactNode {
  if (value === undefined || value === null || value === '') {
    return <span className="admin-null">（空）</span>
  }
  if (Array.isArray(value)) {
    const arr = value as unknown[]
    return arr.length ? <span className="admin-arr">{arr.length} 项</span> : <span className="admin-null">（空数组）</span>
  }
  return String(value)
}

/** 短文本 → 彩色标签（无匹配色时用兜底色），空值灰色占位 */
function tagCell(value: unknown, colorMap?: Record<string, string>, fallback = 'default'): React.ReactNode {
  const s = value === undefined || value === null ? '' : String(value)
  if (!s) return <span className="admin-null">（空）</span>
  return <Tag color={colorMap?.[s] ?? fallback} style={{ fontSize: 11, marginInlineEnd: 0 }}>{s}</Tag>
}

/** 固定短 ID / 编号 → 浅灰标签 */
function idTag(v: unknown): React.ReactNode {
  const s = v === undefined || v === null ? '' : String(v)
  if (!s) return <span className="admin-null">-</span>
  return <Tag color="default" style={{ fontSize: 11, marginInlineEnd: 0, color: '#6b7280' }}>{s}</Tag>
}

/** 卡片/CR 状态 → 语义色 */
const STATUS_COLORS: Record<string, string> = {
  MERGED: 'green',
  OPEN: 'blue',
  ABANDONED: 'default',
  新建: 'blue',
  进行中: 'processing',
  已完成: 'green',
  关闭: 'default',
  挂起: 'orange',
}

/** 卡片类型 → 语义色 */
const CARD_TYPE_COLORS: Record<string, string> = {
  Story: 'blue',
  Bug: 'red',
  Task: 'geekblue',
  Feature: 'purple',
  Epic: 'magenta',
  技术专项: 'cyan',
}

// ---------- 本地 mock 数据（无 PopSDK 时用于调试 UI/交互） ----------
const MOCK_CATEGORIES: CategoryId[] = ['feature', 'ux', 'efficiency', 'bugfix', 'engineering']
const MOCK_BUSINESSES: BusinessId[] = ['bunnydo', 'dodo', 'comate', 'ai-internal', 'other']
const MOCK_AWARDS = ['', '', '', '', '', 'gold', 'silver', 'copper']
const MOCK_KEYS_POOL = [
  'card:bunnydo-33',
  'review:120890600',
  'review:120661153',
  'card:dododododoit-2005',
  'review:120900012',
  'card:bunnydo-45',
  'commit:9f3efe3',
  'review:120750111',
  'card:kefu-102',
  'review:120830222',
  'card:zhuanxing-7',
  'commit:a1b2c3d',
]

function mockEventKey(i: number): string {
  const base = MOCK_KEYS_POOL[i % MOCK_KEYS_POOL.length]
  const suffix = Math.floor(i / MOCK_KEYS_POOL.length)
  return suffix > 0 ? `${base}-${suffix}` : base
}

function mockRecord(i: number): RawRecord {
  const cat = MOCK_CATEGORIES[i % MOCK_CATEGORIES.length]
  const biz = MOCK_BUSINESSES[i % MOCK_BUSINESSES.length]
  const diff = i % 6 // 0 表示未打分
  const award = MOCK_AWARDS[i % MOCK_AWARDS.length]
  const hasReflection = i % 3 === 0
  const t = new Date(Date.UTC(2026, 8, 1 + (i % 28), 9 + (i % 10), (i * 7) % 60))
  return {
    id: 19032 - i,
    data: {
      award,
      business: biz,
      category: cat,
      difficulty: diff,
      event_key: mockEventKey(i),
      reflection: hasReflection ? `1. 启发：这是第 ${i + 1} 条任务的反思内容，用于测试较长文本在表格里的展示与截断行为。\n2. 经验：mock 数据方便本地调试。` : '',
      state: 'active',
      updated_at: t.toISOString(),
    },
    createdAt: t.toISOString(),
    updatedAt: t.toISOString(),
    interactionData: i % 4 === 0 ? { like_count: (i % 9) + 1 } : {},
    userInteraction: { dislike: 0, favorite: 0, like: 0 },
  }
}

const MOCK_RECORDS: RawRecord[] = Array.from({ length: 104 }, (_, i) => mockRecord(i))

function mockOrders(): RawRecord[] {
  return MOCK_CATEGORIES.map((cat, i) => {
    const keys = MOCK_RECORDS.filter((r) => r.data.category === cat)
      .slice(0, 10)
      .map((r) => r.data.event_key)
    return {
      id: 20000 + i,
      data: { category: cat, keys, updated_at: new Date().toISOString() },
      createdAt: new Date().toISOString(),
    }
  })
}
const MOCK_ORDERS: RawRecord[] = mockOrders()

/** 记录里所有可检索文本（id + data 序列化），用于搜索过滤 */
function recordSearchText(r: RawRecord): string {
  try {
    return `${r.id} ${JSON.stringify(r.data ?? {})}`.toLowerCase()
  } catch {
    return String(r.id ?? '').toLowerCase()
  }
}

/** 数据源类型：popo 动态数据表（需 PopSDK）还是本地脚本原始数据（无需） */
const POPO_TABLES: TableName[] = ['event_meta', 'column_order']

/**
 * 数据管理后台：把 popo 动态数据表 + 脚本抓取的原始数据表（reviews/commits/cards）可视化，
 * 便于核对云端与本地快照实际存了什么。仅登录后入口可见。本地 dev 无 PopSDK 时动态数据表展示 mock。
 */
export default function DataAdmin() {
  const { message, modal } = AntApp.useApp()
  const dash = useDashboardData()
  const [table, setTable] = useState<TableName>('event_meta')
  const [records, setRecords] = useState<RawRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  // 受控分页：切表/刷新/搜索都保持当前页与每页条数
  const [current, setCurrent] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  /** 脚本原始数据（reviews/commits/cards）转成 RawRecord 统一结构，id 用内置序号 */
  const rawRows = useMemo<Record<'reviews' | 'commits' | 'cards', RawRecord[]>>(() => {
    const withIdx = <T,>(list: T[], prefix: string): RawRecord[] =>
      list.map((item, i) => ({ id: `${prefix}-${i + 1}`, data: item as Record<string, any> }))
    return {
      reviews: withIdx(dash.data.reviews, 'review'),
      commits: withIdx(dash.data.commits, 'commit'),
      cards: withIdx(dash.data.cards, 'card'),
    }
  }, [dash.data])

  // 请求序号：切表/刷新时旧请求返回后不覆盖当前表数据（避免竞态）
  const loadSeqRef = useRef(0)

  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current
    // 本地脚本原始数据：直接来自 dashboard.json，无需 PopSDK
    if (table === 'reviews' || table === 'commits' || table === 'cards') {
      setRecords(rawRows[table])
      return
    }
    if (!isPopoReady()) {
      // 本地 dev：用 mock 数据调试 UI/交互
      setRecords(table === 'event_meta' ? MOCK_RECORDS : MOCK_ORDERS)
      return
    }
    setLoading(true)
    try {
      const rows = await loadAllRawRecords(table)
      // 仅当仍是最新一次请求时才落地，避免旧请求覆盖新表
      if (seq === loadSeqRef.current) setRecords(rows)
    } catch (e) {
      console.warn('[popo] 数据管理后台拉取失败:', e)
      if (seq === loadSeqRef.current) message.error('拉取数据表失败，请查看控制台')
    } finally {
      if (seq === loadSeqRef.current) setLoading(false)
    }
  }, [table, message, rawRows])

  useEffect(() => {
    setRecords([])
    setCurrent(1)
    void load()
  }, [table, load])

  // 搜索过滤：对 key / id / data 内容检索
  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return records
    return records.filter((r) => recordSearchText(r).includes(kw))
  }, [records, keyword])

  // 切换表/搜索时回到第一页
  useEffect(() => {
    setCurrent(1)
  }, [table, keyword])

  // ---------- 导出 ----------
  const [exportOpen, setExportOpen] = useState(false)
  const [exportSelected, setExportSelected] = useState<TableName[]>([])
  const [exporting, setExporting] = useState(false)

  const ALL_TABLES: TableName[] = ['event_meta', 'column_order', 'reviews', 'commits', 'cards']

  const openExport = () => {
    setExportSelected([...ALL_TABLES])
    setExportOpen(true)
  }

  /** 拉取某个表当前应导出的完整数据（popo 表走云端，原始表走本地快照） */
  const fetchTableRows = useCallback(
    async (t: TableName): Promise<RawRecord[]> => {
      if (t === 'reviews' || t === 'commits' || t === 'cards') return rawRows[t]
      if (!isPopoReady()) return t === 'event_meta' ? MOCK_RECORDS : MOCK_ORDERS
      return loadAllRawRecords(t)
    },
    [rawRows],
  )

  /** 导出的 Excel 行：展平 record（id + data 字段 + createdAt/updatedAt） */
  const flattenRow = (r: RawRecord): Record<string, unknown> => {
    const row: Record<string, unknown> = { id: r.id, ...(r.data ?? {}) }
    if (r.createdAt) row.createdAt = r.createdAt
    if (r.updatedAt) row.updatedAt = r.updatedAt
    return row
  }

  const handleExportExcel = async () => {
    if (!exportSelected.length) {
      message.warning('请先选择要导出的表')
      return
    }
    setExporting(true)
    try {
      const book = XLSX.utils.book_new()
      for (const t of exportSelected) {
        const rows = await fetchTableRows(t)
        const sheet = XLSX.utils.json_to_sheet(rows.map(flattenRow))
        XLSX.utils.book_append_sheet(book, sheet, TABLE_NAMES[t].split('（')[0])
      }
      XLSX.writeFile(book, `数据管理后台-${new Date().toISOString().slice(0, 10)}.xlsx`)
      message.success(`已导出 ${exportSelected.length} 张表到 Excel`)
      setExportOpen(false)
    } catch (e) {
      console.warn('[popo] 导出 Excel 失败:', e)
      message.error('导出 Excel 失败，请查看控制台')
    } finally {
      setExporting(false)
    }
  }

  const handleExportJson = async () => {
    if (!exportSelected.length) {
      message.warning('请先选择要导出的表')
      return
    }
    setExporting(true)
    try {
      const payload: { exportedAt: string; tables: Record<string, unknown> } = {
        exportedAt: new Date().toISOString(),
        tables: {},
      }
      for (const t of exportSelected) {
        payload.tables[t] = await fetchTableRows(t)
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `数据管理后台-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      message.success(`已导出 ${exportSelected.length} 张表到 JSON`)
      setExportOpen(false)
    } catch (e) {
      console.warn('[popo] 导出 JSON 失败:', e)
      message.error('导出 JSON 失败，请查看控制台')
    } finally {
      setExporting(false)
    }
  }

  // ---------- 导入（恢复） ----------
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)

  const openImport = () => {
    setImportFile(null)
    setImportOpen(true)
  }

  const handleImportFile = (file: File) => {
    setImportFile(file)
  }

  /** 解析导入的 JSON，并逐条还原写回 popo（event_meta 按 event_key、column_order 按 category） */
  const handleImport = async () => {
    if (!importFile) {
      message.warning('请先选择要导入的 JSON 文件')
      return
    }
    if (!isPopoReady()) {
      message.error('当前环境无 PopSDK（本地开发），导入恢复只能在 popo 线上页面执行')
      return
    }
    setImporting(true)
    try {
      const text = await importFile.text()
      const payload = JSON.parse(text) as { tables?: Record<string, any[]> }
      const tables = payload.tables ?? {}
      // 只恢复可写回 popo 的两张表
      const restoreTables = (['event_meta', 'column_order'] as const).filter((t) => Array.isArray(tables[t]))
      if (!restoreTables.length) {
        message.warning('文件中没有可恢复的 event_meta / column_order 数据')
        return
      }
      let ok = 0
      let skipped = 0
      let fail = 0
      const failedKeys: string[] = []
      for (const t of restoreTables) {
        for (const rec of tables[t]) {
          try {
            const result = await restoreRawRecord(t, rec)
            if (result === 'skipped-newer') skipped++
            else ok++
          } catch (e) {
            fail++
            const key = rec?.data?.event_key ?? rec?.data?.category ?? rec?.id ?? '?'
            failedKeys.push(`${t}::${key}`)
            console.warn(`[popo] 恢复失败 ${t}::${key}:`, e)
          }
        }
      }
      const skipText = skipped > 0 ? `，跳过 ${skipped} 条云端较新数据` : ''
      if (fail === 0) {
        message.success(`导入恢复完成：成功 ${ok} 条${skipText}`)
      } else {
        message.warning(`导入完成：成功 ${ok} 条，失败 ${fail} 条${skipText}（详见控制台）`)
      }
      setImportOpen(false)
      setImportFile(null)
      // 刷新当前表
      void load()
    } catch (e) {
      console.warn('[popo] 导入 JSON 解析失败:', e)
      message.error('导入失败：JSON 解析错误或格式不符')
    } finally {
      setImporting(false)
    }
  }

  /** 导入前二次确认（写操作，防误触） */
  const confirmImport = () => {
    if (!importFile) {
      message.warning('请先选择要导入的 JSON 文件')
      return
    }
    modal.confirm({
      title: '确认导入恢复？',
      content: `将把 ${importFile.name} 中的 event_meta / column_order 数据写回 popo 数据库。云端较新的记录会被跳过不覆盖。`,
      okText: '确认导入',
      cancelText: '取消',
      onOk: () => handleImport(),
    })
  }

  // ---------- event_meta 列（反思窄、难度纯数字、event_key 无标签） ----------
  const eventColumns: TableProps<RawRecord>['columns'] = [
    {
      title: '记录 ID',
      dataIndex: 'id',
      width: 88,
      fixed: 'left',
      align: 'center',
      render: (v: RawRecord['id']) => idTag(v),
    },
    {
      title: 'event_key',
      dataIndex: ['data', 'event_key'],
      width: 210,
      render: (v: unknown) => (
        <Tooltip title={String(v ?? '')} placement="topLeft">
          <span className="admin-mono">{String(v ?? '') || <span className="admin-null">（空）</span>}</span>
        </Tooltip>
      ),
    },
    {
      title: '分类',
      dataIndex: ['data', 'category'],
      width: 92,
      align: 'center',
      render: (v: unknown) => {
        const c = categoryById((v as CategoryId) || undefined)
        return c ? <Tag color={c.color} style={{ fontSize: 11 }}>{c.name}</Tag> : cell(v)
      },
    },
    {
      title: '难度',
      dataIndex: ['data', 'difficulty'],
      width: 58,
      align: 'center',
      render: (v: unknown) => (Number(v) > 0 ? <span className="admin-mono">{String(v)}</span> : <span className="admin-null">-</span>),
    },
    {
      title: '所属业务',
      dataIndex: ['data', 'business'],
      width: 100,
      align: 'center',
      render: (v: unknown) => {
        const b = businessById((v as BusinessId) || undefined)
        return b ? <Tag color={b.color} style={{ fontSize: 11 }}>{b.name}</Tag> : cell(v)
      },
    },
    {
      title: '关键成果',
      dataIndex: ['data', 'award'],
      width: 84,
      align: 'center',
      render: (v: unknown) => {
        const award = String(v ?? '')
        if (!award) return <span className="admin-null">-</span>
        const map: Record<string, string> = { gold: '金牌', silver: '银牌', copper: '铜牌' }
        return <Tag color={award === 'gold' ? 'gold' : award === 'silver' ? 'default' : 'orange'}>{map[award] ?? award}</Tag>
      },
    },
    {
      title: '反思',
      dataIndex: ['data', 'reflection'],
      width: 76,
      align: 'center',
      render: (v: unknown) => (String(v ?? '').trim() ? <span className="admin-arr">有</span> : <span className="admin-null">无</span>),
    },
    {
      title: 'updated_at',
      dataIndex: ['data', 'updated_at'],
      width: 128,
      render: (v: unknown) => {
        const t = String(v ?? '')
        if (!t) return <span className="admin-null">（空）</span>
        return (
          <Tooltip title={`${t}\n数据更新时间，距今 ${ago(t)}`}>
            <span className="admin-mono">{t.slice(0, 19).replace('T', ' ')}</span>
          </Tooltip>
        )
      },
    },
    {
      title: '记录创建',
      dataIndex: 'createdAt',
      width: 96,
      render: (v: unknown, r: RawRecord) => {
        const t = String(v ?? '') || r.updatedAt
        return t ? <span className="admin-mono">{new Date(t).toLocaleDateString()}</span> : '-'
      },
    },
    {
      title: '点赞',
      dataIndex: 'interactionData',
      width: 64,
      align: 'center',
      render: (_v: unknown, r: RawRecord) => {
        const like = r.interactionData?.like_count ?? 0
        return like > 0 ? <span className="admin-like">♥ {like}</span> : <span className="admin-null">0</span>
      },
    },
  ]

  // ---------- column_order 列 ----------
  const orderColumns: TableProps<RawRecord>['columns'] = [
    {
      title: '记录 ID',
      dataIndex: 'id',
      width: 100,
      fixed: 'left',
      align: 'center',
      render: (v: RawRecord['id']) => idTag(v),
    },
    {
      title: '分类',
      dataIndex: ['data', 'category'],
      width: 120,
      align: 'center',
      render: (v: unknown) => {
        const c = categoryById((v as CategoryId) || undefined)
        return c ? <Tag color={c.color}>{c.name}</Tag> : cell(v)
      },
    },
    {
      title: '列内任务数',
      dataIndex: ['data', 'keys'],
      width: 120,
      align: 'center',
      render: (_v: unknown, r: RawRecord) => {
        const arr = r.data?.keys as unknown[] | undefined
        return arr ? <span>{arr.length} 项</span> : <span className="admin-null">（空）</span>
      },
    },
    {
      title: 'updated_at',
      dataIndex: ['data', 'updated_at'],
      width: 190,
      align: 'center',
      render: (v: unknown) => <span className="admin-mono">{String(v ?? '') || '（空）'}</span>,
    },
  ]

  /** 展开行：完整原始数据 JSON（含 record 元信息 + data） */
  const expandedRow = (r: RawRecord) => (
    <div className="admin-json">
      <JsonViewer data={r} maxHeight="300px" />
    </div>
  )

  /** 原始数据表字段描述：kind 控制渲染方式与对齐（tag=彩色标签居中，number=等宽数字居中，text=左对齐文本） */
  interface RawField {
    title: string
    key: string
    width?: number
    kind?: 'tag' | 'number' | 'text'
    /** tag 模式的颜色映射（无匹配时用 fallback） */
    colorMap?: Record<string, string>
    fallback?: string
  }

  const rawColumns = (keyFields: RawField[], contentKey?: string): TableProps<RawRecord>['columns'] => {
    const cols: NonNullable<TableProps<RawRecord>['columns']> = [
      {
        title: '序号',
        dataIndex: 'id',
        width: 80,
        fixed: 'left',
        align: 'center',
        render: (v: RawRecord['id']) => idTag(v),
      },
      ...keyFields.map((f) => {
        const kind = f.kind ?? 'text'
        const align: 'left' | 'center' = kind === 'text' ? 'left' : 'center'
        if (kind === 'tag') {
          return {
            title: f.title,
            dataIndex: ['data', f.key],
            width: f.width ?? 120,
            align,
            render: (v: unknown) => tagCell(v, f.colorMap, f.fallback),
          }
        }
        if (kind === 'number') {
          return {
            title: f.title,
            dataIndex: ['data', f.key],
            width: f.width ?? 100,
            align,
            render: (v: unknown) => <span className="admin-mono">{String(v ?? '') || <span className="admin-null">-</span>}</span>,
          }
        }
        return {
          title: f.title,
          dataIndex: ['data', f.key],
          width: f.width ?? 180,
          ellipsis: true,
          render: (v: unknown) => cell(v),
        }
      }),
    ]
    if (contentKey) {
      cols.push({
        title: '内容摘要',
        dataIndex: ['data', contentKey],
        ellipsis: true,
        render: (v: unknown) => (
          <Tooltip title={String(v ?? '')} placement="topLeft">
            <span className="admin-mono">{String(v ?? '') || <span className="admin-null">（空）</span>}</span>
          </Tooltip>
        ),
      })
    }
    return cols
  }

  /** 各原始数据表的列定义 */
  const reviewsColumns = rawColumns(
    [
      { title: 'CR 编号', key: 'number', width: 110, kind: 'number' },
      { title: '代码库', key: 'project', width: 220 },
      { title: '分支', key: 'branch', width: 130, kind: 'tag', fallback: 'blue' },
    ],
    'subject',
  )
  const commitsColumns = rawColumns(
    [
      { title: 'commitId', key: 'commitId', width: 250 },
      { title: '作者', key: 'author', width: 100, kind: 'tag', fallback: 'geekblue' },
    ],
    'subject',
  )
  const cardsColumns = rawColumns(
    [
      { title: '空间', key: 'space', width: 110, kind: 'tag', fallback: 'purple' },
      { title: '卡片号', key: 'sequence', width: 80, kind: 'number' },
      { title: '状态', key: 'status', width: 90, kind: 'tag', colorMap: STATUS_COLORS, fallback: 'default' },
      { title: '类型', key: 'type', width: 90, kind: 'tag', colorMap: CARD_TYPE_COLORS, fallback: 'cyan' },
    ],
    'title',
  )

  /** 当前表列定义 */
  const columns: TableProps<RawRecord>['columns'] =
    table === 'event_meta'
      ? eventColumns
      : table === 'column_order'
        ? orderColumns
        : table === 'reviews'
          ? reviewsColumns
          : table === 'commits'
            ? commitsColumns
            : cardsColumns

  /** 刷新提示文案（原始数据表用本地快照，popo 表用云端） */
  const isPopoTable = POPO_TABLES.includes(table)

  return (
    <div className="admin-panel">
      <div className="admin-head">
        <div>
          <div className="admin-title">数据管理后台</div>
        </div>
        <div className="admin-head-right">
          <Input.Search
            placeholder="搜索 key / id / 内容…"
            allowClear
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
          />
          <Button onClick={openImport} icon={<UploadOutlined />}>导入</Button>
          <Button onClick={openExport} icon={<DownloadOutlined />}>导出</Button>
          <Button onClick={() => void load()} loading={loading}>刷新数据</Button>
        </div>
      </div>

      <Segmented
        value={table}
        onChange={(v) => setTable(v as TableName)}
        options={[
          { value: 'event_meta', label: TABLE_NAMES.event_meta },
          { value: 'column_order', label: TABLE_NAMES.column_order },
          { value: 'reviews', label: TABLE_NAMES.reviews },
          { value: 'commits', label: TABLE_NAMES.commits },
          { value: 'cards', label: TABLE_NAMES.cards },
        ]}
        style={{ marginBottom: 12 }}
      />

      {!isPopoReady() && isPopoTable && (
        <div className="admin-mock-tip">当前为本地开发环境，popo 动态数据表展示 mock 数据用于调试 UI/交互。</div>
      )}

      {filtered.length === 0 ? (
        <Empty description={keyword ? '没有匹配的搜索结果' : '暂无记录'} style={{ marginTop: 48 }} />
      ) : (
        <Table<RawRecord>
          rowKey="id"
          size="small"
          loading={loading}
          dataSource={filtered}
          columns={columns}
          pagination={{
            current,
            pageSize,
            total: filtered.length,
            onChange: (p, ps) => {
              setCurrent(p)
              setPageSize(ps)
            },
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showQuickJumper: false,
            showTotal: (t) => `共 ${t} 条`,
            style: { justifyContent: 'center', margin: '8px 0 0' },
          }}
          expandable={{
            expandedRowRender: expandedRow,
            expandRowByClick: true,
            showExpandColumn: false,
            rowExpandable: () => true,
          }}
          scroll={{ x: 'max-content', y: 'calc(100vh - 300px)' }}
          locale={{ emptyText: '暂无记录' }}
        />
      )}

      {/* 导出选择弹窗 */}
      <Modal
        title="导出数据"
        open={exportOpen}
        onCancel={() => setExportOpen(false)}
        width={440}
        footer={
          <div className="admin-export-footer">
            <Button onClick={handleExportJson} loading={exporting}>导出 JSON</Button>
            <Button type="primary" onClick={handleExportExcel} loading={exporting}>导出 Excel</Button>
          </div>
        }
      >
        <div className="admin-export-desc">选择要导出的表（可全选），再点对应按钮生成文件。</div>
        <div className="admin-export-list">
          <Checkbox
            checked={exportSelected.length === ALL_TABLES.length}
            indeterminate={exportSelected.length > 0 && exportSelected.length < ALL_TABLES.length}
            onChange={(e) => setExportSelected(e.target.checked ? [...ALL_TABLES] : [])}
          >
            全选
          </Checkbox>
        </div>
        <div className="admin-export-list">
          {ALL_TABLES.map((t) => (
            <Checkbox
              key={t}
              checked={exportSelected.includes(t)}
              onChange={(e) =>
                setExportSelected((prev) => (e.target.checked ? [...prev, t] : prev.filter((x) => x !== t)))
              }
            >
              {TABLE_NAMES[t]}
            </Checkbox>
          ))}
        </div>
      </Modal>

      {/* 导入（恢复）弹窗 */}
      <Modal
        title="导入数据（恢复）"
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        width={480}
        footer={
          <div className="admin-export-footer">
            <Button onClick={() => setImportOpen(false)}>取消</Button>
            <Button type="primary" onClick={confirmImport} loading={importing}>开始导入恢复</Button>
          </div>
        }
      >
        <div className="admin-export-desc">
          选择之前导出的 JSON 文件，将 event_meta / column_order 数据还原写回 popo 数据库。
          仅支持 popo 线上环境执行（本地开发无 PopSDK）。
        </div>
        <label className="admin-import-file">
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleImportFile(f)
            }}
          />
          <span className={importFile ? 'admin-import-name' : 'admin-import-placeholder'}>
            {importFile ? `已选择：${importFile.name}` : '点击选择 JSON 文件…'}
          </span>
        </label>
      </Modal>
    </div>
  )
}
