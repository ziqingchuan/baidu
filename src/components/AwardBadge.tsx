import type { AwardId } from '../lib/awards'
import { awardById } from '../lib/awards'

/** 奖牌徽章：小尺寸图标，用于看板卡 / 反思卡标题前 */
export default function AwardBadge({ award, size = 18 }: { award: AwardId; size?: number }) {
  const a = awardById(award)
  if (!a) return null
  return <img src={a.icon} alt={a.name} width={size} height={size} className="award-badge" />
}
