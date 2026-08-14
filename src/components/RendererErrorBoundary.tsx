import { Component, type ErrorInfo, type ReactNode } from 'react'

interface RendererErrorBoundaryState {
  error: Error | null
}

export default class RendererErrorBoundary extends Component<
  { children: ReactNode },
  RendererErrorBoundaryState
> {
  state: RendererErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): RendererErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('DiscDock renderer error', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children

    return (
      <main className="renderer-error" role="alert">
        <h1>DiscDock encountered an error</h1>
        <p>The current view could not be displayed. Restart DiscDock and try again.</p>
        <button type="button" className="button button--primary" onClick={() => window.location.reload()}>
          Reload DiscDock
        </button>
      </main>
    )
  }
}