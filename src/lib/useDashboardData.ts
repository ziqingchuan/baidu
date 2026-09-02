import { useMemo } from 'react'
import dashboardJson from '../data/dashboard.json'
import type { DashboardData } from '../types'
import { buildEvents } from './aggregate'

/** 全局数据 hook：读取快照 + 预计算任务归并 */
export function useDashboardData() {
  return useMemo(() => {
    const data = dashboardJson as DashboardData
    const events = buildEvents(data)
    return { data, events, fetchedAt: data.fetchedAt }
  }, [])
}
