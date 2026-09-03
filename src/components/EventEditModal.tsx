import { useEffect, useState } from 'react'
import { Input, Modal, Rate, Tag, Typography, Space } from 'antd'
import type { EventItem, EventMeta } from '../types'
import { categoryById, softTint } from '../lib/categories'
import { businessById, BUSINESSES, type BusinessId } from '../lib/business'
import { AWARDS, type AwardId } from '../lib/awards'
import { effectiveCategory } from '../lib/boardStats'
import Button from './ui/Button'

const { TextArea } = Input

interface Props {
  event?: EventItem
  meta?: EventMeta
  open: boolean
  onClose: () => void
  onSave: (difficulty: number, reflection: string) => void
  onBusinessChange: (business: BusinessId) => void
  onAwardChange: (award: AwardId | null) => void
}

const DIFFICULTY_HINTS = ['', '很轻松', '较简单', '一般', '有挑战', '高难度']

/** 难度打分星星：与 star.svg 同一星形，currentColor 跟随 Rate 选中色 */
const STAR_PATH =
  'M313.991837 914.285714c-20.37551 0-40.228571-6.269388-56.946939-18.808163-30.302041-21.942857-44.930612-58.514286-38.661225-95.085714l24.032654-141.061225c3.134694-18.285714-3.134694-36.571429-16.195919-49.110204L123.297959 509.910204c-26.644898-26.122449-36.04898-64.261224-24.555102-99.787755 11.493878-35.526531 41.795918-61.126531 78.889796-66.35102l141.583674-20.375511c18.285714-2.612245 33.959184-14.106122 41.795918-30.30204l63.216326-128.522449C440.946939 130.612245 474.383673 109.714286 512 109.714286s71.053061 20.897959 87.24898 54.334694L662.987755 292.571429c8.359184 16.195918 24.032653 27.689796 41.795918 30.30204l141.583674 20.375511c37.093878 5.22449 67.395918 30.82449 78.889796 66.35102 11.493878 35.526531 2.089796 73.665306-24.555102 99.787755l-102.4 99.787755c-13.061224 12.538776-19.330612 31.346939-16.195919 49.110204l24.032654 141.061225c6.269388 37.093878-8.359184 73.142857-38.661225 95.085714-30.302041 21.942857-69.485714 24.555102-102.4 7.314286L538.122449 836.440816c-16.195918-8.359184-35.526531-8.359184-51.722449 0l-126.955102 66.87347c-14.628571 7.314286-30.302041 10.971429-45.453061 10.971428z'

const starIcon = (
  <svg viewBox="0 0 1024 1024" width="1em" height="1em" aria-hidden="true">
    <path d={STAR_PATH} fill="currentColor" />
  </svg>
)

/** 完成状态 → 彩色标签 */
function statusColor(status: string): string {
  if (/MERGED|已完成|关闭/.test(status)) return 'green'
  if (/OPEN|新建|待/.test(status)) return 'blue'
  if (/ABANDONED/.test(status)) return 'default'
  if (/开发|测试|评审/.test(status)) return 'orange'
  return 'geekblue'
}

/** 任务详情弹窗：查看任务信息 + 难度打分 + 所属业务 + 总结反思 */
export default function EventEditModal({ event, meta, open, onClose, onSave, onBusinessChange, onAwardChange }: Props) {
  const [difficulty, setDifficulty] = useState(0)
  const [reflection, setReflection] = useState('')
  const [award, setAward] = useState<AwardId | null>(null)

  useEffect(() => {
    if (open) {
      setDifficulty(meta?.difficulty ?? 0)
      setReflection(meta?.reflection ?? '')
      setAward(meta?.award ?? null)
    }
  }, [open, meta])

  if (!event) return null
  const cat = categoryById(effectiveCategory(event, meta ? { [event.key]: meta } : {}))
  const biz = businessById(meta?.business ?? event.business)

  const handleOk = () => {
    onSave(difficulty, reflection)
    onAwardChange(award)
    onClose()
  }

  return (
    <Modal
      title={event.title}
      open={open}
      onCancel={onClose}
      width={680}
      className="app-modal"
      styles={{ body: { paddingTop: 20, paddingBottom: 8 } }}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleOk}>保存</Button>
        </Space>
      }
    >
      {/* 属性标签区：分类/状态/类型/所属业务/卡片/CR */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
        <Tag
          style={{
            fontSize: 13,
            padding: '3px 12px',
            borderRadius: 999,
            color: cat.color,
            background: softTint(cat.color, 0.12),
            borderColor: 'transparent',
          }}
        >
          {cat.name}
        </Tag>
        <Tag color={statusColor(event.status)} style={{ fontSize: 13, padding: '3px 12px', borderRadius: 999 }}>
          {event.status}
        </Tag>
        {event.cardNumber && (
          <Tag color="geekblue" style={{ fontSize: 13, padding: '3px 12px', borderRadius: 999 }}>
            卡片 {event.cardNumber}
          </Tag>
        )}
        {event.reviewNumber && (
          <Tag color="cyan" style={{ fontSize: 13, padding: '3px 12px', borderRadius: 999 }}>
            CR #{event.reviewNumber}
          </Tag>
        )}
        {event.commitCount ? (
          <Tag color="gold" style={{ fontSize: 13, padding: '3px 12px', borderRadius: 999 }}>
            {event.commitCount} 次提交
          </Tag>
        ) : null}
      </div>

      {/* 代码量 + 元信息 */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 20, fontSize: 13, color: '#7c818c' }}>
        <span>新增 <b style={{ color: '#67b26f' }}>{event.insertions}</b> 行</span>
        <span>删除 <b style={{ color: '#e88b7c' }}>{event.deletions}</b> 行</span>
        <span>{event.date}</span>
        <span>{event.repo}</span>
      </div>

      {/* 所属业务 */}
      <div style={{ margin: '18px 0' }}>
        <div style={{ fontSize: 13, marginBottom: 10, color: '#4a4f58' }}>所属业务</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {BUSINESSES.map((b) => {
            const active = biz?.id === b.id
            return (
              <Tag
                key={b.id}
                style={{
                  fontSize: 13,
                  padding: '3px 14px',
                  borderRadius: 999,
                  cursor: 'pointer',
                  background: active ? b.color : softTint(b.color, 0.1),
                  color: active ? '#fff' : b.color,
                  borderColor: 'transparent',
                  boxShadow: active ? `0 4px 12px ${softTint(b.color, 0.35)}` : 'none',
                }}
                onClick={() => onBusinessChange(b.id)}
              >
                {b.name}
              </Tag>
            )
          })}
        </div>
      </div>

      {/* 难度打分 */}
      <div style={{ margin: '18px 0' }}>
        <div style={{ fontSize: 13, marginBottom: 10, color: '#4a4f58' }}>任务难度打分</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Rate value={difficulty} onChange={setDifficulty} count={5} character={starIcon} style={{ fontSize: 24, color: '#f2cb51' }} />
          <span style={{ fontSize: 13, color: '#a9b0bf' }}>
            {DIFFICULTY_HINTS[difficulty] ?? '点击星星打分'}
          </span>
        </div>
      </div>

      {/* 关键成果奖牌 */}
      <div style={{ margin: '18px 0' }}>
        <div style={{ fontSize: 13, marginBottom: 10, color: '#4a4f58' }}>标记为关键成果（三种等级）</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {AWARDS.map((a) => {
            const active = award === a.id
            return (
              <button
                key={a.id}
                type="button"
                title={a.name}
                onClick={() => {
                  const next = active ? null : a.id
                  setAward(next)
                  onAwardChange(next) // 点选即持久化，不依赖保存按钮
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: 0,
                  opacity: active ? 1 : 0.3,
                  transition: 'opacity 0.2s ease',
                }}
              >
                <img src={a.icon} alt={a.name} width={36} height={44} />
              </button>
            )
          })}
        </div>
      </div>

      {/* 总结反思 */}
      <div style={{ margin: '18px 0 4px' }}>
        <div style={{ fontSize: 13, marginBottom: 10, color: '#4a4f58' }}>总结与反思</div>
        <TextArea
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder={'这段工作的收获与反思：\n- 做了什么 / 解决什么难点\n- 方案怎么选的\n- 踩了什么坑\n- 哪些经验可复用'}
          autoSize={{ minRows: 5, maxRows: 12 }}
          style={{ fontSize: 13, borderRadius: 10 }}
        />
      </div>

      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
        {meta ? `上次更新：${meta.updatedAt.slice(0, 16).replace('T', ' ')}` : '尚未打分/反思'}
      </Typography.Text>
    </Modal>
  )
}
