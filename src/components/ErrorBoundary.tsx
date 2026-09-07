import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface State {
  hasError: boolean
  /** 是否属于"懒加载 chunk 404 / 资源版本失效"类错误 */
  isChunkError: boolean
}

/**
 * 全局错误边界：捕获渲染/懒加载错误，避免白屏。
 * - 懒加载 chunk 失效（部署后旧 hash 404）：提示"资源已更新"，一键刷新
 * - 其他错误：提示刷新重试
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, isChunkError: false }

  static getDerivedStateFromError(error: unknown): State {
    const msg = error instanceof Error ? error.message : String(error)
    const isChunkError =
      /dynamically imported module|Failed to fetch dynamically|Loading chunk|Importing a module script failed|Error loading module/i.test(
        msg,
      )
    return { hasError: true, isChunkError }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[error-boundary]', error, info)
  }

  handleReload = () => window.location.reload()

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="boundary-fallback">
        <div className="boundary-title">{this.state.isChunkError ? '页面资源已更新' : '页面出错了'}</div>
        <div className="boundary-desc">
          {this.state.isChunkError
            ? '检测到新版本已发布，当前缓存里的旧资源已失效。点击下方按钮刷新即可恢复。'
            : '页面发生了一个错误，点击下方按钮刷新重试。'}
        </div>
        <button type="button" className="boundary-btn" onClick={this.handleReload}>
          刷新页面
        </button>
      </div>
    )
  }
}
