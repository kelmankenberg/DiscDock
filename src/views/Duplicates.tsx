import { useEffect, useState } from 'react'
import type { DuplicateReport } from '../../shared/types'
import './Duplicates.css'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** exponent).toFixed(1)} ${units[exponent]}`
}

const EMPTY_REPORT: DuplicateReport = { groups: [], totalGroups: 0, totalFiles: 0, reclaimableBytes: 0 }

export default function Duplicates(): JSX.Element {
  const [report, setReport] = useState<DuplicateReport>(EMPTY_REPORT)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void window.discdock.duplicates.report({}).then((result) => {
      setLoading(false)
      if (result.ok) setReport(result.data)
    })
  }, [])

  return (
    <div className="duplicates-view">
      <h1>Duplicates</h1>

      {loading ? (
        <p className="duplicates-view__status">Scanning catalog for duplicates…</p>
      ) : report.totalGroups === 0 ? (
        <div className="empty-state">
          <p>
            No duplicate files found. Duplicate detection requires files to be scanned with hashing
            enabled (Quick or Full).
          </p>
        </div>
      ) : (
        <>
          <p className="duplicates-view__summary">
            {report.totalGroups} duplicate group{report.totalGroups === 1 ? '' : 's'} · {report.totalFiles}{' '}
            files involved · {formatBytes(report.reclaimableBytes)} reclaimable if only one copy of each
            were kept
          </p>
          {report.groups.map((group) => (
            <div key={group.hashValue} className="duplicate-group">
              <div className="duplicate-group__header">
                <span>{formatBytes(group.sizeBytes)}</span>
                <span className="duplicate-group__hash">{group.hashValue.slice(0, 16)}…</span>
                <span>{group.occurrences.length} copies</span>
              </div>
              <ul className="duplicate-group__occurrences">
                {group.occurrences.map((occurrence, index) => (
                  <li key={index}>
                    <strong>{occurrence.mediaLabel}</strong> — {occurrence.path}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
