import { useEffect, useState } from 'react'
import { Input, Modal, Rate, Tag, Typography, Space } from 'antd'
import type { EventItem, EventMeta } from '../types'
import { categoryById, softTint } from '../lib/categories'
import { businessById, BUSINESSES, type BusinessId } from '../lib/business'
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
}

const DIFFICULTY_HINTS = ['', '很轻松', '较简单', '一般', '有挑战', '高难度']

/** 完成状态 → 彩色标签 */
function statusColor(status: string): string {
  if (/MERGED|已完成|关闭/.test(status)) return 'green'
  if (/OPEN|新建|待/.test(status)) return 'blue'
  if (/ABANDONED/.test(status)) return 'default'
  if (/开发|测试|评审/.test(status)) return 'orange'
  return 'geekblue'
}

/** 任务详情弹窗：查看任务信息 + 难度打分 + 所属业务 + 总结反思 */
export default function EventEditModal({ event, meta, open, onClose, onSave, onBusinessChange }: Props) {
  const [difficulty, setDifficulty] = useState(0)
  const [reflection, setReflection] = useState('')

  useEffect(() => {
    if (open) {
      setDifficulty(meta?.difficulty ?? 0)
      setReflection(meta?.reflection ?? '')
    }
  }, [open, meta])

  if (!event) return null
  const cat = categoryById(effectiveCategory(event, meta ? { [event.key]: meta } : {}))
  const biz = businessById(meta?.business ?? event.business)

  const handleOk = () => {
    onSave(difficulty, reflection)
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
          <Rate value={difficulty} onChange={setDifficulty} count={5} style={{ fontSize: 22, color: '#f0b47e' }} />
          <span style={{ fontSize: 13, color: '#a9b0bf' }}>
            {DIFFICULTY_HINTS[difficulty] ?? '点击星星打分'}
          </span>
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
