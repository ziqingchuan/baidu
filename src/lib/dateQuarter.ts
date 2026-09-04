/** 由日期推导季度，如 2026-05 -> "2026-Q2"；无法解析返回空串 */
export function dateQuarter(date: string): string {
  const m = Number(date.slice(5, 7))
  const y = date.slice(0, 4)
  if (!Number.isFinite(m) || m < 1 || m > 12 || y.length < 4) return ''
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`
}
