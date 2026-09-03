/** 关键成果奖牌：金银铜三级，用于标记任务的突出程度 */
import goldSvg from '../assets/gold.svg'
import silverSvg from '../assets/silver.svg'
import copperSvg from '../assets/copper.svg'

export type AwardId = 'gold' | 'silver' | 'copper'

export interface Award {
  id: AwardId
  name: string
  /** 光效/强调主色（对应奖牌材质色） */
  color: string
  /** 奖牌图标（svg url） */
  icon: string
}

export const AWARDS: Award[] = [
  { id: 'gold', name: '金牌', color: '#f0c53a', icon: goldSvg },
  { id: 'silver', name: '银牌', color: '#c3c9d6', icon: silverSvg },
  { id: 'copper', name: '铜牌', color: '#e08a3c', icon: copperSvg },
]

export function awardById(id?: AwardId): Award | undefined {
  return AWARDS.find((a) => a.id === id)
}
