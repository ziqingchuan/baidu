import { useMemo, useState } from 'react'
import { ConfigProvider, App as AntApp, Segmented, Tooltip, Select, theme, Modal, Input, Popconfirm } from 'antd'
import { DownloadOutlined, CloudUploadOutlined } from '@ant-design/icons'
import zhCN from 'antd/locale/zh_CN'
import { useDashboardData } from './lib/useDashboardData'
import { useBoardState } from './hooks/useBoardState'
import { buildBoardStats } from './lib/boardStats'
import { buildExtraStats } from './lib/extraStats'
import { exportBoardMarkdown, downloadText } from './lib/export'
import { isAuthed, setAuthed, checkPassword } from './lib/mockAuth'
import KanbanBoard from './components/KanbanBoard'
import ChartsSection from './components/ChartsSection'
import Button from './components/ui/Button'
import type { EventItem } from './types'
import type { BusinessId } from './lib/business'

type View = 'board' | 'charts'

/** 由日期推导季度，如 2026-05 -> "2026-Q2" */
function dateQuarter(date: string): string {
  const m = Number(date.slice(5, 7))
  const y = date.slice(0, 4)
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`
}

/** 从任务列表推导可选季度（倒序） */
function listQuarters(events: EventItem[]): string[] {
  return [...new Set(events.map((e) => dateQuarter(e.date)))].sort().reverse()
}

export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{ algorithm: theme.defaultAlgorithm, token: { borderRadius: 10, colorPrimary: '#7aa7f0', colorText: '#3a4150' } }}
    >
      <AntApp>
        <AppContent />
      </AntApp>
    </ConfigProvider>
  )
}

/** 内容组件：在 <AntApp> 提供者内部运行，才能用 useApp() 拿到 message 等 context */
function AppContent() {
  const dash = useDashboardData()
  // 任务的自动推断业务，作为云端 business 的默认值（手动覆盖优先）
  const businessDefaults = useMemo(() => {
    const m = {} as Record<string, BusinessId>
    for (const e of dash.events) m[e.key] = e.business
    return m
  }, [dash.events])
  const board = useBoardState(businessDefaults)
  const { message } = AntApp.useApp()
  const [view, setView] = useState<View>('charts')
  const [quarter, setQuarter] = useState<string>('all')
  const [syncing, setSyncing] = useState(false)
  // 同步到云端的逻辑保留，按钮暂不显示（置为 true 即恢复显示）
  const showSyncButton = false
  // mock 登录态：未登录只读，登录后可拖拽/分类/打分/沉淀
  const [authed, setAuthedState] = useState<boolean>(isAuthed)
  const [loginOpen, setLoginOpen] = useState(false)
  const [pwd, setPwd] = useState('')

  const quarters = useMemo(() => listQuarters(dash.events), [dash.events])

  /** 登录：校验密码（读 VITE_MOCK_LOGIN_PASSWORD） */
  const handleLogin = () => {
    if (checkPassword(pwd)) {
      setAuthed(true)
      setAuthedState(true)
      setPwd('')
      setLoginOpen(false)
      message.success('登录成功')
    } else {
      message.error('密码错误')
    }
  }

  /** 退出登录 */
  const handleLogout = () => {
    setAuthed(false)
    setAuthedState(false)
    message.info('已退出登录')
  }

  /** 手动把本地数据同步到 Supabase 云端 */
  const handleSyncToCloud = async () => {
    setSyncing(true)
    try {
      const ok = await board.syncLocalToCloud()
      if (ok) message.success('已同步本地数据到云端')
      else message.error('同步失败，请检查控制台')
    } finally {
      setSyncing(false)
    }
  }

  /** 按季度过滤任务（all 为全部） */
  const filteredEvents = useMemo(() => {
    if (quarter === 'all') return dash.events
    return dash.events.filter((e) => dateQuarter(e.date) === quarter)
  }, [dash.events, quarter])

  const stats = useMemo(
    () => buildBoardStats(filteredEvents, board.metas),
    [filteredEvents, board.metas],
  )

  // 附加统计：基于全部任务（不随季度过滤），供图表页展示
  const extra = useMemo(
    () => buildExtraStats(dash.events, board.metas),
    [dash.events, board.metas],
  )

  const handleExport = () => {
    const md = exportBoardMarkdown(filteredEvents, board.metas)
    const suffix = quarter === 'all' ? '全部' : quarter
    downloadText(`个人产出看板-${suffix}-${new Date().toISOString().slice(0, 10)}.md`, md)
  }

  return (
    <>
      <div className="app-shell">
      <header className="app-header">
            <div className="app-header-title">
              <svg
                className="app-header-icon"
                viewBox="0 0 1024 1024"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M206.5777475 584.50443167c-52.79593594 0-94.10316656-62.16020344-94.10316656-141.57764625S153.78343812 301.34913917 206.5777475 301.34913917s94.0991025 62.15979656 94.0991025 141.57764625-41.31007594 141.57764625-94.0991025 141.57764625z m188.10553781-188.07912c-52.69310719 0-94.00643531-61.97324344-94.00643531-141.06025406S341.99017812 114.30764886 394.68328531 114.30764886s94.01171906 61.97324344 94.01171907 141.05740875-41.31414094 141.06025406-94.01171907 141.06025406z m235.34956782 0c-52.78780688 0-94.10194781-61.97324344-94.10194688-141.06025406S577.24504625 114.30764886 630.03285312 114.30764886s94.10194781 61.97324344 94.10194782 141.05740875-41.31414094 141.06025406-94.10194782 141.06025406zM818.23674875 584.50443167c-52.79187094 0-94.10194781-62.16020344-94.10194781-141.57764625s41.31007594-141.57764625 94.10194781-141.57764625S912.33869563 363.50893573 912.33869563 442.92678542s-41.31007594 141.57764625-94.10194688 141.57764625zM677.08585906 866.61924917c-40.84267594 0-68.45994937-13.82286188-92.78916093-25.99966125-22.58154094-11.28670594-42.06198094-21.02082938-71.89026282-21.02082938-29.69009344 0-49.16646937 9.73412344-71.75207437 21.02082938-24.42106688 12.17679937-52.08873844 25.99966125-92.92613063 25.99966125-26.16142219 0-50.76660469-14.24555438-67.61375062-39.07468219-29.49744281-43.54140563-29.968095-109.5993225-1.31725688-181.25791687 51.61727344-128.92938187 136.72968656-202.83962719 233.564505-202.83962813s181.98950062 73.91024531 233.55800157 202.83962813c28.65368344 71.65859438 28.18221844 137.71651125-1.31685 181.25791687-16.7979675 24.82912781-41.45232844 39.07468219-67.61456438 39.07468219h0.09754406zM512.40643531 772.57826698"
                  fill="#f16553"
                />
                <path
                  d="M434.34282781 649.18046886q23.81710406 2.07282 25.74320063 44.30550375-1.9265025 41.224725-25.74320063 43.27722281-27.66279469 0-26.69507156-43.27722281-0.96081281-44.29127813 26.69507156-44.30550375z m-7.62716343-25.75986469q-53.40558844 3.09094031-57.20331844 70.06536844 3.79813687 65.95224375 53.38973719 68.00474156 26.68328531 0 37.18394531-20.60626594 0 3.08890781 0.95105906 9.2707875v9.27485157h37.18475813q-0.96325125-12.36375938-0.95512219-26.78814563v-163.83403875h-37.180695v73.15834031q-12.40643531-17.50922906-33.37036406-18.54563906z m228.2397975 136.98086344v-12.36375938q-1.03641-7.2-1.02828188-11.33547844v-109.2213375h-40.18425v80.36850094q-1.04250656 27.82455562-23.69923781 29.8811175-22.67908594 0-23.69923875-29.8811175v-80.36850094h-39.15596907v86.55444469q0 12.36375938 2.06062688 20.60626594 8.23641 24.72751875 44.30550375 27.82049156 26.78408156 0 40.188315-18.54563906l2.06062594 16.48501219h39.15190593z"
                  fill="#f16553"
                />
              </svg>
              <span>个人工作看板</span>
            </div>
            <div className="app-header-right">
              <Select
                value={quarter}
                onChange={setQuarter}
                style={{ minWidth: 150 }}
                options={[
                  { value: 'all', label: '全部季度' },
                  ...quarters.map((q) => ({ value: q, label: q })),
                ]}
              />
              <Segmented
                value={view}
                onChange={(v) => setView(v as View)}
                options={[
                  { value: 'charts', label: '数据图表' },
                  { value: 'board', label: '任务看板' },
                ]}
              />
              {showSyncButton && (
                <Tooltip title="把本地 localStorage 数据上传到 Supabase 云端">
                  <Button icon={<CloudUploadOutlined />} onClick={handleSyncToCloud} loading={syncing}>
                    同步到云端
                  </Button>
                </Tooltip>
              )}
              <Button icon={<DownloadOutlined />} onClick={handleExport} type="primary">
                导出总结
              </Button>
              {authed ? (
                <Popconfirm title="确定退出登录？" onConfirm={handleLogout} okText="退出" cancelText="取消">
                  <button type="button" className="auth-avatar" title="退出登录">
                    <img src="/avatar.png" alt="已登录" />
                  </button>
                </Popconfirm>
              ) : (
                <Tooltip title="点击登录">
                  <button type="button" className="auth-avatar" onClick={() => setLoginOpen(true)}>
                    <img src="/notsigned.png" alt="未登录" />
                  </button>
                </Tooltip>
              )}
            </div>
          </header>

          <main className="app-main">
            {view === 'board' ? (
              <KanbanBoard
                events={filteredEvents}
                metas={board.metas}
                columnOrder={board.columnOrder}
                setCategory={board.setCategory}
                setDifficulty={board.setDifficulty}
                setReflection={board.setReflection}
                setBusiness={board.setBusiness}
                saveColumnOrder={board.saveColumnOrder}
                editable={authed}
              />
            ) : (
              <ChartsSection stats={stats} extra={extra} />
            )}
          </main>

          <footer className="app-footer">
            数据来源：iCode（CR/提交）+ iCafe（卡片）· 快照更新于 {dash.fetchedAt.slice(0, 10)} · 拖拽卡片到对应分类即可归类
          </footer>
      </div>

      <Modal
        open={loginOpen}
        title="登录"
        okText="登录"
        cancelText="取消"
        onOk={handleLogin}
        onCancel={() => setLoginOpen(false)}
          destroyOnHidden
      >
        <Input.Password
          placeholder="请输入密码"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          onPressEnter={handleLogin}
          autoFocus
        />
      </Modal>
    </>
  )
}
