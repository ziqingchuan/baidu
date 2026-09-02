import ReactECharts from 'echarts-for-react'
import { Card, Col, Row } from 'antd'
import type { BoardStats } from '../lib/boardStats'
import { chartBase, barRadius, softFill } from '../lib/chartTheme'

/** 行数 → K 单位显示，如 4931 -> "4.9k" */
function formatK(n: number): string {
  return `${Math.round((n / 1000) * 10) / 10}k`
}

/** 平均难度星条：5 个空心灰色星星，按分值比例填充黄色（进度条式），分数横排旁边 */
function DifficultyStars({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100))
  return (
    <div style={{ position: 'relative', display: 'inline-block', fontSize: 20, lineHeight: 1, letterSpacing: 2, color: '#cfd4de' }}>
      {'☆☆☆☆☆'}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          overflow: 'hidden',
          width: `${pct}%`,
          color: '#f5a623',
          whiteSpace: 'nowrap',
        }}
      >
        {'★★★★★'}
      </div>
    </div>
  )
}

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
      <ReactECharts option={option} style={{ height: 280 }} notMerge />
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
      itemStyle: { color: c.color, borderRadius: [4, 4, 0, 0] },
      data: stats.monthlyByCategory.map((m) => m.counts[c.category] ?? 0),
    })),
  }
  return (
    <Card size="small" title="月度任务占比" className="charts-card">
      <ReactECharts option={option} style={{ height: 280 }} notMerge />
    </Card>
  )
}

/** 分类 × 难度柱状（已打分任务的平均难度） */
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
  const option = {
    ...chartBase,
    tooltip: {
      ...chartBase.tooltip,
      trigger: 'axis',
      formatter: (p: any) => {
        const d = scored[p[0]?.dataIndex]
        return `${d?.name}<br/>平均难度 ${d?.avg} / 5<br/>已打分 ${d?.scored} 件`
      },
    },
    grid: { ...chartBase.grid, top: 24, left: 40, right: 24, bottom: 32 },
    xAxis: {
      type: 'category',
      data: scored.map((d) => d.name),
      axisLabel: { fontSize: 12, color: '#8a93a5' },
      axisLine: { lineStyle: { color: 'rgba(120,135,165,0.2)' } },
    },
    yAxis: {
      type: 'value',
      max: 5,
      name: '难度',
      nameTextStyle: { fontSize: 11, color: '#8a93a5' },
      axisLabel: { fontSize: 11, color: '#8a93a5' },
      splitLine: { lineStyle: { color: 'rgba(120,135,165,0.12)' } },
    },
    series: [
      {
        type: 'bar',
        data: scored.map((d) => d.avg),
        barMaxWidth: 40,
        itemStyle: {
          color: (p: any) => scored[p.dataIndex]?.color,
          borderRadius: barRadius,
        },
        label: { show: true, position: 'top', formatter: (p: any) => scored[p.dataIndex]?.avg, color: '#8a93a5' },
      },
    ],
  }
  return (
    <Card size="small" title="任务平均难度" className="charts-card">
      <ReactECharts option={option} style={{ height: 280 }} notMerge />
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
      <ReactECharts option={option} style={{ height: 280 }} notMerge />
    </Card>
  )
}

/** 图表区：任务导向为主，代码量为辅 */
export default function ChartsSection({ stats }: { stats: BoardStats }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card size="small" className="charts-card">
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)', marginBottom: 8 }}>任务总量</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#3a4150' }}>
              {stats.classified + stats.unclassified} 件
            </div>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" className="charts-card">
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)', marginBottom: 8 }}>平均难度</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 600, color: '#3a4150' }}>
              <DifficultyStars value={stats.avgDifficulty} />
              <span>{stats.avgDifficulty ? `${stats.avgDifficulty} 分` : '未打分'}</span>
            </div>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" className="charts-card">
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)', marginBottom: 8 }}>覆盖业务</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#6b9be8' }}>
              {stats.businessCoverage} 个
            </div>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" className="charts-card">
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)', marginBottom: 8 }}>代码变更</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#3a4150' }}>
              <span style={{ color: '#67b26f' }}>+{formatK(stats.totalInsertions)}</span>
              <span style={{ margin: '0 6px', color: '#c8cdd6' }}>/</span>
              <span style={{ color: '#e88b7c' }}>-{formatK(stats.totalDeletions)}</span>
            </div>
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <CategoryDonut stats={stats} />
        </Col>
        <Col xs={24} lg={16}>
          <MonthlyEvents stats={stats} />
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <DifficultyBars stats={stats} />
        </Col>
        <Col xs={24} lg={14}>
          <CodeVolume stats={stats} />
        </Col>
      </Row>
    </div>
  )
}
