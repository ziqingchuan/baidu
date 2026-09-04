import ReactEChartsCore from 'echarts-for-react/lib/core'
import { Card, Col, Row } from 'antd'
import type { BoardStats } from '../lib/boardStats'
import type { ExtraStats } from '../lib/extraStats'
import { CATEGORIES, UNASSIGNED_CATEGORY } from '../lib/categories'
import { BUSINESSES } from '../lib/business'
import { chartBase, barRadius, softFill, echarts } from '../lib/chartTheme'

/** 分类分布环形图（任务数，任务导向） */
function CategoryDonut({ stats }: { stats: BoardStats }) {
  const option = {
    ...chartBase,
    tooltip: { ...chartBase.tooltip, trigger: 'item', formatter: '{b}: {c} 件 ({d}%)' },
    legend: { orient: 'vertical', right: 8, top: 'center', textStyle: { fontSize: 12, color: '#8a93a5' } },
    series: [
      {
        type: 'pie',
        radius: ['46%', '72%'],
        center: ['38%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data: stats.categoryDist.map((c) => ({
          name: c.name,
          value: c.count,
          itemStyle: { color: c.color },
        })),
      },
    ],
  }
  return (
    <Card size="small" title="任务分类分布" className="charts-card">
      <ReactEChartsCore echarts={echarts} option={option} style={{ height: 280 }} notMerge />
    </Card>
  )
}

/** 月度任务占比（按分类堆叠，任务导向主图） */
function MonthlyEvents({ stats }: { stats: BoardStats }) {
  const cats = stats.categoryDist.filter((c) => c.count > 0)
  const option = {
    ...chartBase,
    tooltip: { ...chartBase.tooltip, trigger: 'axis' },
    legend: {
      top: 0,
      left: 'center',
      itemWidth: 14,
      itemHeight: 8,
      textStyle: { fontSize: 11, color: '#8a93a5' },
    },
    grid: { ...chartBase.grid, top: 48, left: 44, right: 20, bottom: 32 },
    xAxis: {
      type: 'category',
      data: stats.monthlyByCategory.map((m) => m.month),
      axisLabel: { fontSize: 11, color: '#8a93a5' },
      axisLine: { lineStyle: { color: 'rgba(120,135,165,0.2)' } },
    },
    yAxis: {
      type: 'value',
      name: '任务数',
      nameTextStyle: { fontSize: 11, color: '#8a93a5' },
      axisLabel: { fontSize: 11, color: '#8a93a5' },
      splitLine: { lineStyle: { color: 'rgba(120,135,165,0.12)' } },
    },
    series: cats.map((c) => ({
      name: c.name,
      type: 'bar',
      stack: 'total',
      barMaxWidth: 34,
      itemStyle: { color: softFill(c.color, 0.85), borderRadius: [4, 4, 0, 0] },
      data: stats.monthlyByCategory.map((m) => m.counts[c.category] ?? 0),
    })),
  }
  return (
    <Card size="small" title="月度任务占比" className="charts-card">
      <ReactEChartsCore echarts={echarts} option={option} style={{ height: 280 }} notMerge />
    </Card>
  )
}

/** 分类平均难度（横向分叉柱：以 3.0 为轴，高于=绿向右，低于=橙向左） */
function DifficultyBars({ stats }: { stats: BoardStats }) {
  const scored = stats.difficultyStats.filter((d) => d.scored > 0)
  if (!scored.length) {
    return (
      <Card size="small" title="任务平均难度" className="charts-card">
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a9b0bf', fontSize: 13 }}>
          给任务打分后这里会展示各分类的平均难度
        </div>
      </Card>
    )
  }
  const MID = 3 // 难度中等参照值
  const rows = scored
    .map((d) => ({ ...d, diff: d.avg - MID }))
    .sort((a, b) => b.diff - a.diff)
  // 重叠柱：透明基底固定撑到 3.0 轴，彩色段覆盖其上 → 绿(高于3)/橙(低于3)从轴线向两侧伸出
  const base = rows.map(() => MID)
  const option = {
    ...chartBase,
    tooltip: {
      ...chartBase.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (p: any) => {
        const d = rows[p[0]?.dataIndex]
        return `${d?.name}<br/>平均难度 ${d?.avg} / 5<br/>已打分 ${d?.scored} 件`
      },
    },
    grid: { ...chartBase.grid, top: 20, left: 90, right: 56, bottom: 24 },
    xAxis: {
      type: 'value',
      min: 0,
      max: 5,
      axisLabel: { fontSize: 10, color: '#a9b0bf' },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: true, lineStyle: { color: 'rgba(120,135,165,0.08)' } },
      name: '3.0 = 中等难度',
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: { color: '#8a93a5', fontSize: 11, fontWeight: 600 },
    },
    yAxis: {
      type: 'category',
      data: rows.map((d) => d.name),
      axisLabel: { fontSize: 12, color: '#3a4150' },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: '难度标尺',
        type: 'bar',
        barGap: '-100%',
        data: base,
        barMaxWidth: 24,
        itemStyle: { color: 'rgba(120,135,165,0.14)', borderRadius: 12 },
        tooltip: { show: false },
      },
      {
        name: '难度',
        type: 'bar',
        barGap: '-100%',
        data: rows.map((d) => d.avg),
        barMaxWidth: 24,
        itemStyle: {
          color: (p: any) => (rows[p.dataIndex]?.diff >= 0 ? 'rgba(146,203,170,0.85)' : 'rgba(244,178,160,0.85)'),
          borderRadius: 12,
        },
        // 数值不直接显示，hover tooltip 查看（label 在重叠柱上难以移出矩形）
        label: { show: false },
      },
    ],
  }
  return (
    <Card size="small" title="任务平均难度" className="charts-card">
      <ReactEChartsCore echarts={echarts} option={option} style={{ height: 280 }} notMerge />
    </Card>
  )
}

/** 代码量月度（次要展示，保留但收敛） */
function CodeVolume({ stats }: { stats: BoardStats }) {
  const option = {
    ...chartBase,
    tooltip: { ...chartBase.tooltip, trigger: 'axis' },
    legend: {
      top: 0,
      left: 'center',
      itemWidth: 14,
      itemHeight: 8,
      textStyle: { fontSize: 11, color: '#8a93a5' },
    },
    grid: { ...chartBase.grid, top: 48, left: 48, right: 20, bottom: 32 },
    xAxis: {
      type: 'category',
      data: stats.codeMonthly.map((m) => m.month),
      axisLabel: { fontSize: 11, color: '#8a93a5' },
      axisLine: { lineStyle: { color: 'rgba(120,135,165,0.2)' } },
    },
    yAxis: [
      {
        type: 'value',
        name: '行数',
        nameTextStyle: { fontSize: 11, color: '#8a93a5' },
        axisLabel: { fontSize: 11, color: '#8a93a5' },
        splitLine: { lineStyle: { color: 'rgba(120,135,165,0.12)' } },
      },
      {
        type: 'value',
        name: '任务',
        nameTextStyle: { fontSize: 11, color: '#8a93a5' },
        axisLabel: { fontSize: 11, color: '#8a93a5' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '新增',
        type: 'bar',
        data: stats.codeMonthly.map((m) => m.insertions),
        itemStyle: { color: softFill('#7aa7f0', 0.8), borderRadius: barRadius },
      },
      {
        name: '删除',
        type: 'bar',
        data: stats.codeMonthly.map((m) => m.deletions),
        itemStyle: { color: softFill('#f2a08d', 0.8), borderRadius: barRadius },
      },
      {
        name: '任务数',
        type: 'line',
        yAxisIndex: 1,
        data: stats.codeMonthly.map((m) => m.count),
        itemStyle: { color: '#8bcfa6' },
        lineStyle: { width: 2 },
        smooth: true,
      },
    ],
  }
  return (
    <Card size="small" title="月度代码量" className="charts-card">
      <ReactEChartsCore echarts={echarts} option={option} style={{ height: 280 }} notMerge />
    </Card>
  )
}

/** 产出日历热力图：每天一格，颜色深浅=任务数（Streak 一眼可见），范围跟随筛选 */
function YearCalendar({ extra }: { extra: ExtraStats }) {
  const max = Math.max(1, ...extra.daily.map((d) => d.count))
  // 范围：筛选到季度时只显示该季度月份；全部时显示全年
  const dates = extra.daily.map((d) => d.date).sort()
  const range = dates.length
    ? (() => {
        const min = dates[0]
        const max = dates[dates.length - 1]
        // 跨度超过 120 天视为全年视图，否则按实际起止月显示
        const span = (new Date(max).getTime() - new Date(min).getTime()) / 86400000
        return span > 120 ? extra.year : [min.slice(0, 7) + '-01', max]
      })()
    : extra.year
  const option = {
    ...chartBase,
    tooltip: {
      ...chartBase.tooltip,
      trigger: 'item',
      formatter: (p: any) => {
        const d = extra.daily.find((x) => x.date === p.data?.[0])
        return `${p.data?.[0] ?? ''}<br/>${d ? `${d.count} 个任务` : '无产出'}`
      },
    },
    visualMap: {
      min: 0,
      max,
      show: false,
      inRange: { color: ['#eef2f8', '#7aa7f0', '#5b6ee1'] },
    },
    calendar: {
      top: 30,
      left: 30,
      right: 20,
      cellSize: ['auto', 16],
      range,
      splitLine: { show: false },
      itemStyle: { color: '#f2f4f8', borderColor: '#fff', borderWidth: 2 },
      dayLabel: { color: '#a9b0bf', fontSize: 10 },
      monthLabel: { nameStyle: { color: '#8a93a5', fontSize: 11 } },
    },
    series: [
      {
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: extra.daily.map((d) => [d.date, d.count]),
      },
    ],
  }
  return (
    <Card size="small" title="产出日历" className="charts-card">
      {/* key 随筛选范围变化 → 切换季度时重挂载 + CSS 淡入（ECharts 日历热力图原生更新动画不可靠） */}
      <div key={JSON.stringify(range)} className="calendar-fade">
        <ReactEChartsCore echarts={echarts} option={option} style={{ height: 220 }} />
      </div>
    </Card>
  )
}

/** 24 小时工作节律：极坐标环形柱，深夜（22-4点）高亮 */
function HourClock({ extra }: { extra: ExtraStats }) {
  const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}时`)
  const isNight = (i: number) => i >= 22 || i < 4
  const option = {
    ...chartBase,
    tooltip: { ...chartBase.tooltip, trigger: 'item', formatter: (p: any) => `${p.name}<br/>${p.value} 个任务` },
    polar: { radius: ['18%', '72%'], center: ['50%', '52%'] },
    angleAxis: {
      type: 'category',
      data: hours,
      startAngle: 90,
      boundaryGap: false,
      axisLabel: { fontSize: 9, color: '#a9b0bf', interval: 1 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    radiusAxis: { min: 0, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false }, splitLine: { lineStyle: { color: 'rgba(120,135,165,0.08)' } } },
    series: [
      {
        type: 'bar',
        coordinateSystem: 'polar',
        data: extra.hourly.map((v, i) => ({
          value: v,
          itemStyle: { color: isNight(i) ? '#a78bfa' : '#7aa7f0', borderRadius: 3 },
        })),
      },
    ],
  }
  return (
    <Card size="small" title="24 小时工作节律" className="charts-card">
      <ReactEChartsCore echarts={echarts} option={option} style={{ height: 240 }} notMerge />
    </Card>
  )
}

/** 一周产出节奏雷达：周一~周日分布 */
function WeekdayRadar({ extra }: { extra: ExtraStats }) {
  const labels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const option = {
    ...chartBase,
    tooltip: { ...chartBase.tooltip, trigger: 'item' },
    radar: {
      indicator: labels.map((name) => ({ name, max: Math.max(1, ...extra.weekdayCounts) })),
      radius: '65%',
      splitArea: { areaStyle: { color: ['rgba(122,167,240,0.03)', 'rgba(122,167,240,0.06)'] } },
      axisName: { color: '#8a93a5', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(120,135,165,0.15)' } },
    },
    series: [
      {
        type: 'radar',
        data: [{ value: extra.weekdayCounts, name: '任务数' }],
        areaStyle: { color: 'rgba(122,167,240,0.25)' },
        lineStyle: { color: '#7aa7f0', width: 2 },
        itemStyle: { color: '#7aa7f0' },
        symbolSize: 4,
      },
    ],
  }
  return (
    <Card size="small" title="一周产出节奏" className="charts-card">
      <ReactEChartsCore echarts={echarts} option={option} style={{ height: 240 }} notMerge />
    </Card>
  )
}

/** 年度关键词气泡：频率决定气泡大小；显式防重叠（碰撞外扩）+ 字号随词长自适应 */
const BUBBLE_COLORS = ['#7aa7f0', '#a78bfa', '#6ccfcf', '#f2a08d', '#8bcfa6', '#f0b47e', '#e8849a', '#8a93a5']
function KeywordBubble({ extra }: { extra: ExtraStats }) {
  const kws = extra.keywords.slice(0, 10)
  const maxV = Math.max(1, ...kws.map((k) => k.value))

  // 按频率降序放置（大的在里圈），碰撞则向外扩张找角度，保证互不重叠
  const placed: { x: number; y: number; r: number }[] = []
  const data = kws.map((k, i) => {
    const r = 20 + (k.value / maxV) * 23
    let best = { x: 0, y: 0 }
    // 从内圈开始逐圈尝试，直到找到不与任何已放气泡相交的位置
    outer: for (let ring = 1; ring <= 24; ring++) {
      const R = (ring - 1) * 14 + r
      for (let a = 0; a < 360; a += 15) {
        const rad = (a * Math.PI) / 180
        const x = Math.cos(rad) * R
        const y = Math.sin(rad) * R
        let hit = false
        for (const p of placed) {
          const dist = Math.hypot(x - p.x, y - p.y)
          if (dist < r + p.r + 3) { hit = true; break }
        }
        if (!hit) { best = { x, y }; break outer }
      }
    }
    placed.push({ x: best.x, y: best.y, r })
    // 字号按气泡半径自适应：r 越小字越小，且整体偏小，保证长词不溢出
    // 中文约 1em 宽，半径需容纳 词长×字号/2，留 20% 余量
    const maxFont = (r * 1.6) / Math.max(k.name.length, 1)
    const fontSize = Math.max(8, Math.min(11, maxFont))
    return {
      name: k.name,
      value: [best.x, best.y, k.value],
      symbolSize: r * 2,
      itemStyle: { color: BUBBLE_COLORS[i % BUBBLE_COLORS.length] },
      label: { show: true, formatter: '{b}', position: 'inside', fontSize, color: '#fff', fontWeight: 600 },
    }
  })
  const option = {
    ...chartBase,
    tooltip: { ...chartBase.tooltip, trigger: 'item', formatter: (p: any) => `${p.name}<br/>出现 ${p.value[2]} 次` },
    xAxis: { type: 'value', min: -112, max: 112, show: false },
    yAxis: { type: 'value', min: -112, max: 112, show: false },
    series: [{ type: 'scatter', data }],
  }
  return (
    <Card size="small" title="我的关键词" className="charts-card">
      <ReactEChartsCore echarts={echarts} option={option} style={{ height: 240 }} notMerge />
    </Card>
  )
}

/** 各业务的工作类型分布（热力图矩阵） */
function BizCategoryHeatmap({ extra }: { extra: ExtraStats }) {
  const cats = [...CATEGORIES, UNASSIGNED_CATEGORY]
  const bizs = BUSINESSES.map((b) => b.name)
  const max = Math.max(1, ...extra.bizCategory.map((x) => x.count))
  const catIndex = new Map(cats.map((c, i) => [c.name, i]))
  const bizIndex = new Map(bizs.map((b, i) => [b, i]))
  const data = extra.bizCategory
    .filter((x) => catIndex.has(x.category) && bizIndex.has(x.biz))
    .map((x) => [catIndex.get(x.category), bizIndex.get(x.biz), x.count])
  const option = {
    ...chartBase,
    tooltip: {
      ...chartBase.tooltip,
      trigger: 'item',
      formatter: (p: any) => `${bizs[p.value[1]]} × ${cats[p.value[0]].name}<br/>${p.value[2]} 个任务`,
    },
    grid: { top: 30, left: 90, right: 30, bottom: 50 },
    xAxis: {
      type: 'category',
      data: cats.map((c) => c.name),
      axisLabel: { fontSize: 10, color: '#8a93a5' },
      axisLine: { show: false },
      axisTick: { show: false },
      splitArea: { show: true, areaStyle: { color: ['rgba(120,135,165,0.02)', 'rgba(120,135,165,0.05)'] } },
    },
    yAxis: {
      type: 'category',
      data: bizs,
      axisLabel: { fontSize: 11, color: '#3a4150' },
      axisLine: { show: false },
      axisTick: { show: false },
      splitArea: { show: true, areaStyle: { color: ['rgba(120,135,165,0.02)', 'rgba(120,135,165,0.05)'] } },
    },
    visualMap: {
      min: 0,
      max,
      show: false,
      inRange: { color: ['#eef2f8', '#a9c4f5', '#8fb4f5'] },
    },
    series: [{ type: 'heatmap', data, label: { show: true, color: '#3a4150', fontSize: 11 } }],
  }
  return (
    <Card size="small" title="各业务的工作类型分布" className="charts-card">
      <ReactEChartsCore echarts={echarts} option={option} style={{ height: 260 }} notMerge />
    </Card>
  )
}

/** 产出集中在哪些代码库（矩形树图：每个代码库一个矩形，大小 = 任务数，每个库独立配色） */
function BizRepoTreemap({ extra }: { extra: ExtraStats }) {
  // 每个代码库独立颜色（足够多的柔和色，按索引轮换，避免同业务撞色）
  const REPO_COLORS = [
    '#7aa7f0', '#a78bfa', '#6ccfcf', '#f2a08d', '#8bcfa6', '#f0b47e',
    '#e8849a', '#8a93a5', '#7fd0a8', '#b48ae8', '#e8b06e', '#6ab7e8',
  ]
  // hex → rgba（半透明，透明度 ~0.75）
  const alpha = (hex: string, a: number) => {
    const n = parseInt(hex.slice(1), 16)
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
  }
  const data = extra.repoCount.map((r, i) => ({
    name: r.repo,
    // 面积用 log1p 压缩（避免任务量悬殊导致小库矩形过小），大小关系仍保留
    value: Math.log1p(r.count),
    count: r.count,
    itemStyle: {
      color: alpha(REPO_COLORS[i % REPO_COLORS.length], 0.75),
      borderRadius: 10,
      borderColor: 'rgba(255,255,255,0.7)',
      borderWidth: 2,
    },
  }))
  const option = {
    ...chartBase,
    tooltip: { ...chartBase.tooltip, trigger: 'item', formatter: (p: any) => `${p.name}<br/>${p.data?.count ?? ''} 个任务` },
    series: [
      {
        type: 'treemap',
        data,
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        label: {
          color: '#fff',
          fontWeight: 600,
          fontSize: 12,
          formatter: '{b}',
          // treemap 默认 truncate 会截断成 personal-...；关闭截断，完整显示库名
          overflow: 'none',
        },
        upperLabel: { show: false },
        // 矩形之间的留白，让圆角与半透明效果可见
        gapWidth: 4,
        itemStyle: { borderColor: 'rgba(255,255,255,0.7)', borderWidth: 2, borderRadius: 10 },
        // 细长矩形：文本旋转 90° 竖排；正常矩形横向（必须显式 rotate:0，否则上次的 90° 残留不会转回来）
        labelLayout: (params: any) => {
          const w = params.rect?.width ?? params.width ?? 100
          const h = params.rect?.height ?? params.height ?? 30
          if (w < h * 0.7) {
            return { rotate: 90, fontSize: 10, align: 'center', verticalAlign: 'middle', overflow: 'none' }
          }
          return { rotate: 0, fontSize: 12, overflow: 'none' }
        },
      },
    ],
  }
  return (
    <Card size="small" title="产出集中在哪些代码库" className="charts-card">
      <ReactEChartsCore echarts={echarts} option={option} style={{ height: 260 }} notMerge />
    </Card>
  )
}

/** 图表区：自上而下 = 整体规模 → 业务分布 → 工作节奏 → 分类趋势 → 代码质量
 *  extra = 随季度筛选的数据（所有图都跟随筛选） */
export default function ChartsSection({
  stats,
  extra,
}: {
  stats: BoardStats
  extra: ExtraStats
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 整体规模：产出日历 + 关键词（跟随筛选） */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <YearCalendar extra={extra} />
        </Col>
        <Col xs={24} lg={8}>
          <KeywordBubble extra={extra} />
        </Col>
      </Row>
      {/* 业务分布：产出代码库 + 各业务工作类型（随季度变） */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <BizRepoTreemap extra={extra} />
        </Col>
        <Col xs={24} lg={12}>
          <BizCategoryHeatmap extra={extra} />
        </Col>
      </Row>
      {/* 工作节奏：周节奏 + 24h 节律（随季度变） */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <WeekdayRadar extra={extra} />
        </Col>
        <Col xs={24} lg={8}>
          <HourClock extra={extra} />
        </Col>
        <Col xs={24} lg={8}>
          <CategoryDonut stats={stats} />
        </Col>
      </Row>
      {/* 分类趋势 + 难度 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <MonthlyEvents stats={stats} />
        </Col>
        <Col xs={24} lg={8}>
          <DifficultyBars stats={stats} />
        </Col>
      </Row>
      {/* 代码质量 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={24}>
          <CodeVolume stats={stats} />
        </Col>
      </Row>
    </div>
  )
}
