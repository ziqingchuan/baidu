/**
 * 产出看板数据导出脚本
 *
 * 调用 icode-cli / icafe-cli 拉取真实数据，聚合成前端可读的 JSON 快照，
 * 输出到 src/data/ 目录（进 git，可离线查看）。
 *
 * 用法：node scripts/export-data.ts
 * 前置：已登录 icode-cli 与 icafe-cli（各自 login 过）
 */
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'src', 'data')

interface Review {
  number: number
  project: string
  branch: string
  subject: string
  status: string
  insertions: number
  deletions: number
  updated: string
  revision: string
}

interface Commit {
  commitId: string
  author: string
  commitTime: string
  addLines: number
  deleteLines: number
  subject: string
}

interface Card {
  space: string
  sequence: number
  title: string
  status: string
  type: string
  assignee: string
  isFinished: boolean
  lastModified: string
  parent?: string
}

/** 兼容 smart-find 与 card query 两种返回结构的字段映射 */
function normalizeCard(raw: any): Card | null {
  const space = raw.spacePrefixCode ?? raw.space
  const sequence = raw.sequence
  const title = raw.title
  if (!space || !sequence || !title) return null
  const typeObj = raw.type
  return {
    space,
    sequence,
    title,
    status: raw.status ?? '',
    type: typeof typeObj === 'object' && typeObj ? typeObj.name : String(typeObj ?? ''),
    assignee: raw.assignee ?? raw.responsiblePeople?.[0]?.username ?? '',
    isFinished: !!raw.isFinishedStatus,
    lastModified: raw.lastModifiedTime ?? raw.lastModified ?? '',
    parent: raw.parent?.title,
  }
}

/** 从 subject 前缀提取 icafe 空间，如 "dododododoit-2197 [Story]..." -> "dododododoit" */
function extractSpacePrefix(subject: string): string | null {
  const token = subject.trim().split(/\s+/)[0]
  if (!token) return null
  const m = token.match(/^([A-Za-z][A-Za-z0-9]*(?:-[A-Za-z]+)*)-(\d+)$/)
  return m ? m[1] : null
}

/** 拉取 icafe 卡片：CR/commit 前缀反推空间 + smart-find，每个空间分页拉全我负责的卡片 */
function fetchCards(reviews: Review[], commits: Commit[]): Card[] {
  const out: Card[] = []
  const spaces = new Set<string>()

  // 1. 从 CR/commit subject 前缀反推空间（覆盖 dodo/bunnydo/DevOps-iScan 等）
  for (const r of reviews) {
    const p = extractSpacePrefix(r.subject)
    if (p) spaces.add(p)
  }
  for (const c of commits) {
    const p = extractSpacePrefix(c.subject)
    if (p) spaces.add(p)
  }
  // 2. smart-find 兜底（活跃空间）
  const smart = runJson('icafe-cli card smart-find --limit 50')
  for (const s of smart?.stats?.bySpace ?? []) {
    if (s?.space) spaces.add(s.space)
  }
  for (const c of smart?.cards ?? []) {
    if (c?.space || c?.spacePrefixCode) spaces.add(c.spacePrefixCode ?? c.space)
  }
  // 3. 显式补充已知工作空间（dodo 曾因 smart-find 未返回而漏掉）
  spaces.add('dododododoit')
  spaces.add('bunnydo')

  for (const space of spaces) {
    // 分页拉全我负责的卡片（每页最多 100）
    for (let page = 1; page <= 10; page++) {
      const json = runJson(
        `icafe-cli card query --space ${space} --iql "负责人 = currentUser" --page ${page} --max-records 100 --brief`,
      )
      const cards = Array.isArray(json?.cards) ? json.cards : []
      if (!cards.length) break
      for (const c of cards) {
        const n = normalizeCard(c)
        if (n) out.push(n)
      }
      if (cards.length < 100) break
    }
  }
  // 去重
  const seen = new Set<string>()
  const dedup = out.filter((c) => {
    const k = `${c.space}-${c.sequence}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  dedup.sort((a, b) => (a.lastModified < b.lastModified ? 1 : -1))
  return dedup
}

interface DashboardData {
  fetchedAt: string
  reviews: Review[]
  commits: Commit[]
  cards: Card[]
}

/** 执行一条命令并解析 JSON 输出；失败返回 null（不阻塞其他数据源） */
function runJson(cmd: string): any {
  try {
    const raw = execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] })
    return JSON.parse(raw)
  } catch (e) {
    console.warn(`[warn] 命令执行失败: ${cmd}`)
    console.warn(`       ${(e as Error).message.split('\n')[0]}`)
    return null
  }
}

/** 拉取某个状态下的全部评审（分页） */
function fetchReviews(): Review[] {
  const out: Review[] = []
  for (const status of ['OPEN', 'MERGED', 'ABANDONED']) {
    let start = 0
    // 最多拉 10 页，防止死循环
    for (let page = 0; page < 10; page++) {
      const json = runJson(`icode-cli api get_my_reviews --status ${status} --with-diff-info --start-from ${start} -o json`)
      if (!json?.data?.changes?.length) break
      for (const c of json.data.changes) {
        out.push({
          number: c._number,
          project: c.project,
          branch: c.branch,
          subject: c.subject,
          status,
          insertions: c.insertions ?? 0,
          deletions: c.deletions ?? 0,
          updated: c.updated,
          revision: c.current_revision,
        })
      }
      if (!json.data.hasMore) break
      start += json.data.changes.length
    }
  }
  // 按更新时间倒序
  out.sort((a, b) => (a.updated < b.updated ? 1 : -1))
  return out
}

/** 按月拉取提交流水（按 commitId 去重） */
function fetchCommits(): Commit[] {
  const seen = new Set<string>()
  const out: Commit[] = []
  const START = new Date('2026-01-01')
  const END = new Date()
  for (let d = new Date(START); d <= END; d.setMonth(d.getMonth() + 1)) {
    const begin = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    const endY = d.getMonth() === END.getMonth() && d.getFullYear() === END.getFullYear() ? END : new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const end = `${endY.getFullYear()}-${String(endY.getMonth() + 1).padStart(2, '0')}-${String(endY.getDate()).padStart(2, '0')}`
    let pageNo = 1
    for (let page = 0; page < 10; page++) {
      const json = runJson(
        `icode-cli api get_person_commit -b ${begin} -e ${end} -p ${pageNo} -s 50 -o json`,
      )
      const results = json?.data?.results ?? []
      if (!results.length) break
      for (const r of results) {
        if (!r.commitId || seen.has(r.commitId)) continue
        seen.add(r.commitId)
        out.push({
          commitId: r.commitId,
          author: r.author,
          commitTime: r.commitTime,
          addLines: r.addLines ?? 0,
          deleteLines: r.deleteLines ?? 0,
          subject: r.subject,
        })
      }
      const total = json?.data?.page?.totalCount ?? results.length
      if (pageNo * 50 >= total) break
      pageNo++
    }
  }
  out.sort((a, b) => (a.commitTime < b.commitTime ? 1 : -1))
  return out
}

function main() {
  const reviews = fetchReviews()
  const commits = fetchCommits()
  const cards = fetchCards(reviews, commits)

  const data: DashboardData = {
    fetchedAt: new Date().toISOString(),
    reviews,
    commits,
    cards,
  }

  mkdirSync(DATA_DIR, { recursive: true })
  const file = join(DATA_DIR, 'dashboard.json')
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`[ok] 写入 ${file}`)
  console.log(`     reviews=${reviews.length} commits=${commits.length} cards=${cards.length}`)
}

main()
