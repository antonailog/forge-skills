import { Component, type ReactNode } from 'react'

/** 页面渲染出错时显示一句读者能照做的话，不留一片白 */
export class Boundary extends Component<{ children: ReactNode; hint?: string }, { error?: Error }> {
  state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    return this.state.error
      ? <p className="p-8 text-sm text-muted-foreground">{this.props.hint ?? '这篇没有显示出来，让 AI 重新生成一次再打开。'}</p>
      : this.props.children
  }
}
