import { useEffect, useState } from 'react'
import type { DashboardSummary } from '../../shared/types'

const EMPTY_SUMMARY: DashboardSummary = {
  totalMediaItems: 0,
  totalFiles: 0,
  totalSizeBytes: 0,
  mediaNeedingVerification: 0
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** exponent).toFixed(1)} ${units[exponent]}`
}

export default function Dashboard(): JSX.Element {
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY)

  useEffect(() => {
    void window.discdock.dashboard.getSummary().then((result) => {
      if (result.ok) setSummary(result.data)
    })
  }, [])

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <div className="dashboard__cards">
        <div className="card">
          <span className="card__value">{summary.totalMediaItems}</span>
          <span className="card__label">Total Media Items</span>
        </div>
        <div className="card">
          <span className="card__value">{summary.totalFiles}</span>
          <span className="card__label">Total Files Catalogued</span>
        </div>
        <div className="card">
          <span className="card__value">{formatBytes(summary.totalSizeBytes)}</span>
          <span className="card__label">Total Catalogued Size</span>
        </div>
        <div className="card">
          <span className="card__value">{summary.mediaNeedingVerification}</span>
          <span className="card__label">Media Needing Verification</span>
        </div>
      </div>
    </div>
  )
}
