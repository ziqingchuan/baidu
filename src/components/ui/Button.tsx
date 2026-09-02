import { Button as AntButton, type ButtonProps } from 'antd'

/**
 * 统一按钮：柔和圆润、有内边距、低对比阴影。
 * 通过 size="middle" 保证内边距，封装默认样式，避免各页面散落自定义。
 */
export default function Button(props: ButtonProps) {
  return (
    <AntButton
      {...props}
      className={`app-btn${props.className ? ` ${props.className}` : ''}`}
    />
  )
}
