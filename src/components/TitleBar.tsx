import { useEffect, useState } from 'react'
import './TitleBar.css'

interface WindowState {
  maximized: boolean
}

// Custom title bar replacing the OS-native one, since the BrowserWindow is created with frame: false.
export default function TitleBar(): JSX.Element {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void window.discdock.window.isMaximized().then((result) => {
      if (result.ok) setMaximized(result.data.maximized)
    })
    return window.discdock.window.onStateChanged((state: WindowState) => setMaximized(state.maximized))
  }, [])

  return (
    <header className="title-bar">
      <div className="title-bar__drag-region">
        <span className="title-bar__icon" aria-hidden="true">
          💿
        </span>
        <span className="title-bar__title">DiscDock</span>
      </div>
      <div className="title-bar__controls">
        <button
          type="button"
          className="title-bar__button"
          aria-label="Minimize"
          onClick={() => void window.discdock.window.minimize()}
        >
          &#x2212;
        </button>
        <button
          type="button"
          className="title-bar__button"
          aria-label={maximized ? 'Restore' : 'Maximize'}
          onClick={() => void window.discdock.window.maximize()}
        >
          {maximized ? '❐' : '☐'}
        </button>
        <button
          type="button"
          className="title-bar__button title-bar__button--close"
          aria-label="Close"
          onClick={() => void window.discdock.window.close()}
        >
          &#x2715;
        </button>
      </div>
    </header>
  )
}
